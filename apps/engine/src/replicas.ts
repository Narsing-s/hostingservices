import Docker from 'dockerode';
import { waitForHealthyContainer, type HealthMode } from './health.js';
import { switchTraffic, switchWeightedTraffic } from './router.js';

export type AutoscaleSpec = { min: number; max: number; cpuPercent: number; intervalSeconds?: number };
export type DeploymentStrategy = 'rolling' | 'blue_green' | 'canary';
export type ReplicaSpec = {
  name: string; image: string; replicas: number; containerPort?: number; env?: Record<string, string>; command?: string[];
  healthPath?: string; healthMode?: HealthMode; public?: boolean; domain?: string; zeroDowntime?: boolean; rollbackOnFailure?: boolean;
  strategy?: DeploymentStrategy; deploymentId?: string; generationId?: string; canarySteps?: number[];
  autoscale?: AutoscaleSpec;
};
function dockerClient() { if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) }); if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' }); return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' }); }
async function network(docker: Docker) { const name = process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime'; const value = docker.getNetwork(name); try { await value.inspect(); return value; } catch { return docker.createNetwork({ Name: name, Driver: 'bridge' }); } }
async function remove(docker: Docker, name: string) { try { const c = docker.getContainer(name); await c.stop({ t: 10 }).catch(() => undefined); await c.remove({ force: true }).catch(() => undefined); } catch {} }
async function hostPort(container: Docker.Container, port: number) { const info = await container.inspect(); return Number(info.NetworkSettings?.Ports?.[`${port}/tcp`]?.[0]?.HostPort ?? 0); }
function generation(spec: ReplicaSpec) { return (spec.generationId || spec.deploymentId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48); }
async function createReplica(docker: Docker, spec: ReplicaSpec, name: string, index: number, gen: string) {
  const port = spec.containerPort ?? 80;
  return docker.createContainer({ name, Image: spec.image, Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`), Cmd: spec.command, ExposedPorts: { [`${port}/tcp`]: {} }, HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, PortBindings: { [`${port}/tcp`]: [{ HostPort: '0' }] } }, NetworkingConfig: { EndpointsConfig: { [process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime']: {} } }, Labels: { 'nexus.managed': 'true', 'nexus.runtime': spec.name, 'nexus.replica': 'true', 'nexus.replica-index': String(index), 'nexus.generation': gen, 'nexus.deployment-id': spec.deploymentId ?? '', 'nexus.public': String(spec.public !== false) } });
}
function names(spec: ReplicaSpec, gen: string, count: number) { return Array.from({ length: count }, (_, i) => `${spec.name}-${gen}-replica-${i + 1}`); }
async function healthy(spec: ReplicaSpec, started: Docker.Container[], replicaNames: string[], ports: number[]) {
  const results = [];
  for (let i = 0; i < started.length; i++) { const httpUrl = spec.healthPath && ports[i] ? `http://127.0.0.1:${ports[i]}${spec.healthPath}` : undefined; results.push(await waitForHealthyContainer(replicaNames[i], { mode: spec.healthMode ?? (httpUrl ? 'http' : 'process'), httpUrl, timeoutMs: 120_000 })); }
  return results;
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function deployReplicas(spec: ReplicaSpec) {
  const docker = dockerClient(); await network(docker); const count = Math.max(1, Math.min(20, Math.floor(spec.replicas))); const port = spec.containerPort ?? 80;
  const gen = generation(spec); const candidateNames = names(spec, gen, count); const started: Docker.Container[] = []; const ports: number[] = [];
  const old = await docker.listContainers({ all: true, filters: { label: [`nexus.runtime=${spec.name}`, 'nexus.managed=true', 'nexus.replica=true'] } });
  const oldRunning = old.filter((item) => item.State === 'running').map((item) => item.Names?.[0]?.replace(/^\//, '') || item.Id);
  const oldGeneration = old.find((item) => item.Labels?.['nexus.generation'])?.Labels?.['nexus.generation'];
  let trafficSwitched = false;
  const strategy = spec.strategy ?? 'rolling';
  try {
    for (const name of candidateNames) { const container = await createReplica(docker, spec, name, started.length + 1, gen); await container.start(); started.push(container); ports.push(await hostPort(container, port)); }
    const health = await healthy(spec, started, candidateNames, ports);
    let route;
    if (spec.public !== false && process.env.TRAEFIK_ENABLED !== 'false') {
      if (strategy === 'canary' && oldRunning.length) {
        const steps = (spec.canarySteps?.length ? spec.canarySteps : [5, 25, 50, 100]).filter((x) => Number.isFinite(x) && x >= 1 && x <= 100).map(Math.round);
        for (const weight of [...new Set(steps)].sort((a, b) => a - b)) { route = await switchWeightedTraffic(spec.name, oldRunning, candidateNames, port, weight, spec.healthPath, spec.domain); trafficSwitched = true; await sleep(Math.max(1, Number(process.env.CANARY_STEP_DELAY_SECONDS ?? 5)) * 1000); await healthy(spec, started, candidateNames, ports); }
      } else { route = await switchTraffic(spec.name, candidateNames, port, spec.healthPath, spec.domain); trafficSwitched = true; }
    }
    for (const item of old) { const oldName = item.Names?.[0]?.replace(/^\//, '') || item.Id; await remove(docker, oldName); }
    if (spec.autoscale) startAutoscaler({ ...spec, generationId: gen });
    return { replicas: count, strategy, generationId: gen, previousGenerationId: oldGeneration ?? null, zeroDowntime: true, rollbackOnFailure: spec.rollbackOnFailure !== false, containers: started.map((c, i) => ({ id: c.id, name: candidateNames[i], index: i + 1, hostPort: ports[i] })), health, autoscale: spec.autoscale ?? null, ...route };
  } catch (error) {
    if (trafficSwitched && oldRunning.length && spec.public !== false && process.env.TRAEFIK_ENABLED !== 'false') { try { await switchTraffic(spec.name, oldRunning, port, spec.healthPath, spec.domain); } catch (rollbackError) { console.error(`[rollback] ${spec.name}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); } }
    for (const container of started) await remove(docker, container.id);
    throw error;
  }
}

const controllers = new Map<string, NodeJS.Timeout>(); const lastScale = new Map<string, number>();
async function averageCpuPercent(docker: Docker, containers: Docker.ContainerInfo[]) { if (!containers.length) return 0; const values = await Promise.all(containers.map(async (item) => { try { const raw = await docker.getContainer(item.Id).stats({ stream: false }); const stats: any = Buffer.isBuffer(raw) ? JSON.parse(raw.toString()) : raw; const cpuDelta = Number(stats.cpu_stats?.cpu_usage?.total_usage ?? 0) - Number(stats.precpu_stats?.cpu_usage?.total_usage ?? 0); const systemDelta = Number(stats.cpu_stats?.system_cpu_usage ?? 0) - Number(stats.precpu_stats?.system_cpu_usage ?? 0); const cpus = Number(stats.cpu_stats?.online_cpus ?? stats.cpu_stats?.cpu_usage?.percpu_usage?.length ?? 1) || 1; return systemDelta > 0 ? (cpuDelta / systemDelta) * cpus * 100 : 0; } catch { return 0; } })); return values.reduce((a, b) => a + b, 0) / values.length; }
async function reconcileScale(spec: ReplicaSpec, target: number) {
  const docker = dockerClient(); await network(docker); const port = spec.containerPort ?? 80; const gen = generation(spec); const items = await docker.listContainers({ all: false, filters: { label: [`nexus.runtime=${spec.name}`, 'nexus.managed=true', 'nexus.replica=true', `nexus.generation=${spec.generationId ?? gen}`] } }); const current = items.length; const bounded = Math.max(1, Math.min(20, target)); if (bounded === current) return current;
  if (bounded > current) for (let i = current; i < bounded; i++) { const name = names(spec, spec.generationId ?? gen, bounded)[i]; const c = await createReplica(docker, spec, name, i + 1, spec.generationId ?? gen); await c.start(); const hp = await hostPort(c, port); const httpUrl = spec.healthPath && hp ? `http://127.0.0.1:${hp}${spec.healthPath}` : undefined; await waitForHealthyContainer(name, { mode: spec.healthMode ?? (httpUrl ? 'http' : 'process'), httpUrl, timeoutMs: 120_000 }); }
  else { const removable = items.sort((a, b) => Number(b.Labels?.['nexus.replica-index'] ?? 0) - Number(a.Labels?.['nexus.replica-index'] ?? 0)).slice(0, current - bounded); for (const item of removable) await remove(docker, item.Names?.[0]?.replace(/^\//, '') || item.Id); }
  if (spec.public !== false && process.env.TRAEFIK_ENABLED !== 'false') { const active = await docker.listContainers({ all: false, filters: { label: [`nexus.runtime=${spec.name}`, 'nexus.managed=true', 'nexus.replica=true', `nexus.generation=${spec.generationId ?? gen}`] } }); await switchTraffic(spec.name, active.map((x) => x.Names?.[0]?.replace(/^\//, '') || x.Id), port, spec.healthPath, spec.domain); }
  return bounded;
}
export function startAutoscaler(spec: ReplicaSpec) { if (!spec.autoscale) return; const existing = controllers.get(spec.name); if (existing) clearInterval(existing); const interval = Math.max(10, Math.min(300, spec.autoscale.intervalSeconds ?? 30)) * 1000; const tick = async () => { try { const docker = dockerClient(); const items = await docker.listContainers({ all: false, filters: { label: [`nexus.runtime=${spec.name}`, 'nexus.managed=true', 'nexus.replica=true', `nexus.generation=${spec.generationId ?? ''}`] } }); if (!items.length) return; const cpu = await averageCpuPercent(docker, items); const now = Date.now(); if (now - (lastScale.get(spec.name) ?? 0) < interval * 2) return; const current = items.length; let target = current; if (cpu > spec.autoscale!.cpuPercent + 10 && current < spec.autoscale!.max) target = current + 1; else if (cpu < spec.autoscale!.cpuPercent - 20 && current > spec.autoscale!.min) target = current - 1; if (target !== current) { await reconcileScale(spec, target); lastScale.set(spec.name, now); console.log(`[autoscaler] ${spec.name}: cpu=${cpu.toFixed(1)}% replicas ${current}->${target}`); } } catch (error) { console.error(`[autoscaler] ${spec.name}: ${error instanceof Error ? error.message : String(error)}`); } }; const timer = setInterval(() => { void tick(); }, interval); timer.unref?.(); controllers.set(spec.name, timer); void tick(); }
export function stopAutoscaler(name: string) { const timer = controllers.get(name); if (timer) clearInterval(timer); controllers.delete(name); lastScale.delete(name); }
