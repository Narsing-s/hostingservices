import Docker from 'dockerode';
import { waitForHealthyContainer, type HealthMode } from './health.js';
import { switchTraffic } from './router.js';

export type ReplicaSpec = {
  name: string;
  image: string;
  replicas: number;
  containerPort?: number;
  env?: Record<string, string>;
  command?: string[];
  healthPath?: string;
  healthMode?: HealthMode;
  public?: boolean;
  domain?: string;
};

function dockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}

async function network(docker: Docker) {
  const name = process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime';
  const value = docker.getNetwork(name);
  try { await value.inspect(); return value; } catch { return docker.createNetwork({ Name: name, Driver: 'bridge' }); }
}

async function remove(docker: Docker, name: string) {
  try { const c = docker.getContainer(name); await c.stop({ t: 10 }).catch(() => undefined); await c.remove({ force: true }).catch(() => undefined); } catch {}
}

export async function deployReplicas(spec: ReplicaSpec) {
  const docker = dockerClient();
  await network(docker);
  const count = Math.max(1, Math.min(20, Math.floor(spec.replicas)));
  const port = spec.containerPort ?? 80;
  const names = Array.from({ length: count }, (_, i) => `${spec.name}-replica-${i + 1}`);
  const started: Docker.Container[] = [];
  try {
    const old = await docker.listContainers({ all: true, filters: { label: [`nexus.runtime=${spec.name}`, 'nexus.managed=true'] } });
    for (const item of old) await remove(docker, item.Names?.[0]?.replace(/^\//, '') || item.Id);

    for (const name of names) {
      const container = await docker.createContainer({
        name,
        Image: spec.image,
        Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`),
        Cmd: spec.command,
        ExposedPorts: { [`${port}/tcp`]: {} },
        HostConfig: { RestartPolicy: { Name: 'unless-stopped' } },
        NetworkingConfig: { EndpointsConfig: { [process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime']: {} } },
        Labels: { 'nexus.managed': 'true', 'nexus.runtime': spec.name, 'nexus.replica': 'true', 'nexus.replica-index': String(started.length + 1), 'nexus.public': String(spec.public !== false) }
      });
      await container.start();
      started.push(container);
    }

    const health = [];
    for (const container of started) {
      const value = await waitForHealthyContainer(container.id, { mode: spec.healthMode, httpUrl: undefined, timeoutMs: 120_000 });
      health.push(value);
    }

    let route;
    if (spec.public !== false && process.env.TRAEFIK_ENABLED !== 'false') {
      route = await switchTraffic(spec.name, names, port, spec.healthPath, spec.domain);
    }
    return { replicas: count, containers: started.map((c, i) => ({ id: c.id, name: names[i], index: i + 1 })), health, ...route };
  } catch (error) {
    for (const container of started) await remove(docker, container.id);
    throw error;
  }
}
