import Docker from 'dockerode';
import { waitForHealthyContainer } from './health.js';

export type RuntimeSpec = {
  name: string;
  image: string;
  containerPort?: number;
  hostPort?: number;
  env?: Record<string, string>;
};

function dockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}

export async function deployRuntime(spec: RuntimeSpec) {
  const docker = dockerClient();
  let oldId: string | undefined;
  try {
    const old = docker.getContainer(spec.name);
    const info = await old.inspect();
    oldId = info.Id;
    await old.stop({ t: 10 }).catch(() => undefined);
    await old.remove({ force: true }).catch(() => undefined);
  } catch {
    // First deployment: no existing container is expected.
  }

  const port = spec.containerPort ?? 80;
  const hostPort = spec.hostPort ?? port;
  const container = await docker.createContainer({
    name: spec.name,
    Image: spec.image,
    Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`),
    ExposedPorts: { [`${port}/tcp`]: {} },
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      PortBindings: { [`${port}/tcp`]: [{ HostPort: String(hostPort) }] },
    },
    Labels: { 'nexus.managed': 'true', 'nexus.runtime': spec.name },
  });

  try {
    await container.start();
    const health = await waitForHealthyContainer(spec.name);
    return { id: container.id, name: spec.name, url: `http://localhost:${hostPort}`, health, replacedContainerId: oldId };
  } catch (error) {
    await container.remove({ force: true }).catch(() => undefined);
    throw error;
  }
}

export async function rollbackRuntime(spec: RuntimeSpec & { previousImage: string }) {
  return deployRuntime({ ...spec, image: spec.previousImage });
}
