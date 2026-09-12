import Docker from 'dockerode';
import { waitForHealthyContainer, type HealthMode } from './health.js';
import { switchTraffic } from './router.js';

export type ReplicaSpec = { name: string; image: string; replicas: number; containerPort?: number; env?: Record<string, string>; command?: string[]; healthPath?: string; healthMode?: HealthMode; public?: boolean; domain?: string; zeroDowntime?: boolean; rollbackOnFailure?: boolean };
function dockerClient() { if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) }); if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' }); return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' }); }
async function network(docker: Docker) { const name = process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime'; const value = docker.getNetwork(name); try { await value.inspect(); return value; } catch { return docker.createNetwork({ Name: name, Driver: 'bridge' }); } }
async function remove(docker: Docker, name: string) { try { const c = docker.getContainer(name); await c.stop({ t: 10 }).catch(() => undefined); await c.remove({ force: true }).catch(() => undefined); } catch {} }
async function hostPort(container: Docker.Container, port: number) { const info = await container.inspect(); return Number(info.NetworkSettings?.Ports?.[`${port}/tcp`]?.[0]?.HostPort ?? 0); }

export async function deployReplicas(spec: ReplicaSpec) {
  const docker = dockerClient(); await network(docker);
  const count = Math.max(1, Math.min(20, Math.floor(spec.replicas))); const port = spec.containerPort ?? 80;
  const names = Array.from({ length: count }, (_, i) => `${spec.name}-replica-${i + 1}`); const started: Docker.Container[] = []; const ports: number[] = [];
  const old = await docker.listContainers({ all: true, filters: { label: [`nexus.runtime=${spec.name}`, 'nexus.managed=true'] } });
  const oldNames = old.map((item) => item.Names?.[0]?.replace(/^\//, '') || item.Id);
  try {
    if (spec.zeroDowntime === false) for (const name of oldNames) await remove(docker, name);
    for (const name of names) {
      const container = await docker.createContainer({ name, Image: spec.image, Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`), Cmd: spec.command, ExposedPorts: { [`${port}/tcp`]: {} }, HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, PortBindings: { [`${port}/tcp`]: [{ HostPort: '0' }] } }, NetworkingConfig: { EndpointsConfig: { [process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime']: {} } }, Labels: { 'nexus.managed': 'true', 'nexus.runtime': spec.name, 'nexus.replica': 'true', 'nexus.replica-index': String(started.length + 1), 'nexus.public': String(spec.public !== false) } });
      await container.start(); started.push(container); ports.push(await hostPort(container, port));
    }
    const health = [];
    for (let i = 0; i < started.length; i++) { const httpUrl = spec.healthPath && ports[i] ? `http://127.0.0.1:${ports[i]}${spec.healthPath}` : undefined; const mode = spec.healthMode ?? (httpUrl ? 'http' : 'process'); health.push(await waitForHealthyContainer(names[i], { mode, httpUrl, timeoutMs: 120_000 })); }
    let route;
    if (spec.public !== false && process.env.TRAEFIK_ENABLED !== 'false') route = await switchTraffic(spec.name, names, port, spec.healthPath, spec.domain);
    if (spec.zeroDowntime !== false) for (const name of oldNames) await remove(docker, name);
    return { replicas: count, zeroDowntime: spec.zeroDowntime !== false, rollbackOnFailure: spec.rollbackOnFailure !== false, containers: started.map((c, i) => ({ id: c.id, name: names[i], index: i + 1, hostPort: ports[i] })), health, ...route };
  } catch (error) {
    for (const container of started) await remove(docker, container.id);
    if (spec.zeroDowntime !== false && spec.rollbackOnFailure !== false) { /* Previous containers were retained until every candidate passed health checks. */ }
    throw error;
  }
}
