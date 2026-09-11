import Docker from 'dockerode';
import { waitForHealthyContainer } from './health.js';
import { switchTraffic, runtimeHost } from './router.js';

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

async function ensureNetwork(docker: Docker) {
  const name = process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime';
  try { return docker.getNetwork(name); } catch { /* create below */ }
  try { return await docker.createNetwork({ Name: name, Driver: 'bridge' }); } catch { return docker.getNetwork(name); }
}

async function removeContainer(docker: Docker, name: string) {
  try {
    const container = docker.getContainer(name);
    await container.stop({ t: 10 }).catch(() => undefined);
    await container.remove({ force: true }).catch(() => undefined);
  } catch { /* not found */ }
}

async function createAndStart(docker: Docker, spec: RuntimeSpec, containerName: string, hostPort: number) {
  const port = spec.containerPort ?? 80;
  const network = await ensureNetwork(docker);
  const portBindings = hostPort > 0 ? { [`${port}/tcp`]: [{ HostPort: String(hostPort) }] } : { [`${port}/tcp`]: [{ HostPort: '' }] };
  const container = await docker.createContainer({
    name: containerName,
    Image: spec.image,
    Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`),
    ExposedPorts: { [`${port}/tcp`]: {} },
    HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, PortBindings: portBindings },
    NetworkingConfig: { EndpointsConfig: { [process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime']: {} } },
    Labels: {
      'nexus.managed': 'true',
      'nexus.runtime': spec.name,
      'nexus.deployment-container': containerName,
      'traefik.enable': 'false',
      'traefik.docker.network': network.id,
    },
  });
  await container.start();
  return container;
}

async function inspectHostPort(container: Docker.Container, containerPort: number) {
  const info = await container.inspect();
  const binding = info.NetworkSettings?.Ports?.[`${containerPort}/tcp`]?.[0];
  return Number(binding?.HostPort ?? 0);
}

export async function deployRuntime(spec: RuntimeSpec) {
  const docker = dockerClient();
  const port = spec.containerPort ?? 80;
  const requestedHostPort = spec.hostPort ?? port;
  const proxyEnabled = process.env.TRAEFIK_ENABLED !== 'false';
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
    } catch { /* first deployment */ }

    // The candidate always gets an ephemeral host port so it can be tested while
    // the active deployment remains online. Traefik routes over the shared network.
    const candidateHostPort = proxyEnabled ? 0 : (previousExists ? 0 : requestedHostPort);
    candidate = await createAndStart(docker, spec, candidateName, candidateHostPort);
    const actualCandidatePort = await inspectHostPort(candidate, port);
    const healthUrl = spec.healthPath && actualCandidatePort
      ? `http://127.0.0.1:${actualCandidatePort}${spec.healthPath}`
      : undefined;
    const health = await waitForHealthyContainer(candidateName, { httpUrl: healthUrl });

    if (proxyEnabled) {
      const route = await switchTraffic(spec.name, candidateName, port, spec.healthPath);
      // Traefik watches the dynamic file and switches the host rule to the healthy candidate.
      if (previousExists) await removeContainer(docker, previousName);
      await docker.getContainer(candidateName).rename({ name: previousName });
      return {
        id: candidate.id,
        name: previousName,
        url: route.url,
        host: route.host,
        health,
        replacedContainerId: previousId,
        candidateHealth: health,
      };
    }

    if (previousExists) {
      await removeContainer(docker, previousName);
      const final = await createAndStart(docker, spec, previousName, requestedHostPort);
      try {
        const finalPort = await inspectHostPort(final, port);
        const finalHealthUrl = spec.healthPath ? `http://127.0.0.1:${finalPort}${spec.healthPath}` : undefined;
        const finalHealth = await waitForHealthyContainer(previousName, { httpUrl: finalHealthUrl });
        await removeContainer(docker, candidateName);
        return { id: final.id, name: previousName, url: `http://localhost:${finalPort}`, health: finalHealth, replacedContainerId: previousId, candidateHealth: health };
      } catch (error) {
        await removeContainer(docker, previousName);
        throw error;
      }
    }

    await docker.getContainer(candidateName).rename({ name: previousName });
    return { id: candidate.id, name: previousName, url: `http://localhost:${actualCandidatePort}`, health, replacedContainerId: previousId };
  } catch (error) {
    if (candidate) await removeContainer(docker, candidateName);
    throw error;
  }
}

export async function rollbackRuntime(spec: RuntimeSpec & { previousImage: string }) {
  return deployRuntime({ ...spec, image: spec.previousImage });
}
