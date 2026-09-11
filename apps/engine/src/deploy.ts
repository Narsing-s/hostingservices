import Docker from 'dockerode';
import { waitForHealthyContainer } from './health.js';

export type RuntimeSpec = {
  name: string;
  image: string;
  containerPort?: number;
  hostPort?: number;
  env?: Record<string, string>;
  healthPath?: string;
};

function dockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}

async function removeContainer(docker: Docker, name: string) {
  try {
    const container = docker.getContainer(name);
    await container.stop({ t: 10 }).catch(() => undefined);
    await container.remove({ force: true }).catch(() => undefined);
  } catch {
    // Container does not exist.
  }
}

async function createAndStart(docker: Docker, spec: RuntimeSpec, containerName: string, hostPort: number) {
  const port = spec.containerPort ?? 80;
  const container = await docker.createContainer({
    name: containerName,
    Image: spec.image,
    Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`),
    ExposedPorts: { [`${port}/tcp`]: {} },
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      PortBindings: { [`${port}/tcp`]: [{ HostPort: String(hostPort) }] },
    },
    Labels: {
      'nexus.managed': 'true',
      'nexus.runtime': spec.name,
      'nexus.deployment-container': containerName,
    },
  });
  await container.start();
  return container;
}

async function inspectHostPort(docker: Docker, container: Docker.Container, containerPort: number) {
  const info = await container.inspect();
  const binding = info.NetworkSettings?.Ports?.[`${containerPort}/tcp`]?.[0];
  return Number(binding?.HostPort ?? 0);
}

export async function deployRuntime(spec: RuntimeSpec) {
  const docker = dockerClient();
  const port = spec.containerPort ?? 80;
  const requestedHostPort = spec.hostPort ?? port;
  const previousName = spec.name;
  const candidateName = `${spec.name}-candidate-${Date.now()}`;
  let previousId: string | undefined;
  let candidate: Docker.Container | undefined;

  try {
    let previousExists = false;
    try {
      const previous = docker.getContainer(previousName);
      const info = await previous.inspect();
      previousId = info.Id;
      previousExists = true;
    } catch {
      // First deployment.
    }

    // Keep the active container running while the candidate is built and checked.
    // A reverse proxy/router can later switch traffic atomically. Without one, the
    // final fixed-port handoff necessarily has a short restart window.
    const candidateHostPort = previousExists ? 0 : requestedHostPort;
    candidate = await createAndStart(docker, spec, candidateName, candidateHostPort);
    const actualCandidatePort = candidateHostPort === 0
      ? await inspectHostPort(docker, candidate, port)
      : candidateHostPort;

    const healthUrl = spec.healthPath
      ? `http://127.0.0.1:${actualCandidatePort}${spec.healthPath}`
      : undefined;
    const health = await waitForHealthyContainer(candidateName, { httpUrl: healthUrl });

    if (previousExists) {
      await removeContainer(docker, previousName);
      // Recreate the stable runtime name on the requested public port only after
      // the candidate has passed health checks.
      await removeContainer(docker, previousName);
      const final = await createAndStart(docker, spec, previousName, requestedHostPort);
      try {
        const finalHealthUrl = spec.healthPath
          ? `http://127.0.0.1:${requestedHostPort}${spec.healthPath}`
          : undefined;
        const finalHealth = await waitForHealthyContainer(previousName, { httpUrl: finalHealthUrl });
        await removeContainer(docker, candidateName);
        return {
          id: final.id,
          name: previousName,
          url: `http://localhost:${requestedHostPort}`,
          health: finalHealth,
          replacedContainerId: previousId,
          candidateHealth: health,
        };
      } catch (error) {
        await removeContainer(docker, previousName);
        // Keep the known-good candidate available for recovery if final handoff fails.
        throw error;
      }
    }

    await docker.getContainer(candidateName).rename({ name: previousName });
    return {
      id: candidate.id,
      name: previousName,
      url: `http://localhost:${actualCandidatePort}`,
      health,
      replacedContainerId: previousId,
    };
  } catch (error) {
    if (candidate) await removeContainer(docker, candidateName);
    throw error;
  }
}

export async function rollbackRuntime(spec: RuntimeSpec & { previousImage: string }) {
  return deployRuntime({ ...spec, image: spec.previousImage });
}
