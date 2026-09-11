import Docker from 'dockerode';
import { waitForHealthyContainer } from './health.js';
import { switchTraffic } from './router.js';

export type RuntimeSpec = { name: string; image: string; containerPort?: number; hostPort?: number; env?: Record<string, string>; command?: string[]; healthPath?: string; domain?: string };

function dockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}
async function ensureNetwork(docker: Docker) { const name = process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime'; const existing = docker.getNetwork(name); try { await existing.inspect(); return existing; } catch { return docker.createNetwork({ Name: name, Driver: 'bridge' }); } }
async function removeContainer(docker: Docker, name: string) { try { const container = docker.getContainer(name); await container.stop({ t: 10 }).catch(() => undefined); await container.remove({ force: true }).catch(() => undefined); } catch {} }
async function createAndStart(docker: Docker, spec: RuntimeSpec, containerName: string, hostPort: number) {
  const port = spec.containerPort ?? 80;
  await ensureNetwork(docker);
  const networkName = process.env.NEXUS_RUNTIME_NETWORK ?? 'nexus-runtime';
  const bindings = hostPort > 0 ? { [`${port}/tcp`]: [{ HostPort: String(hostPort) }] } : undefined;
  const container = await docker.createContainer({ name: containerName, Image: spec.image, Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`), Cmd: spec.command, ExposedPorts: { [`${port}/tcp`]: {} }, HostConfig: { RestartPolicy: { Name: 'unless-stopped' }, ...(bindings ? { PortBindings: bindings } : {}) }, NetworkingConfig: { EndpointsConfig: { [networkName]: {} } }, Labels: { 'nexus.managed': 'true', 'nexus.runtime': spec.name, 'nexus.deployment-container': containerName, 'traefik.enable': 'false' } });
  await container.start();
  return container;
}
async function inspectHostPort(container: Docker.Container, containerPort: number) { const info = await container.inspect(); const binding = info.NetworkSettings?.Ports?.[`${containerPort}/tcp`]?.[0]; return Number(binding?.HostPort ?? 0); }
async function findActiveContainer(docker: Docker, runtimeName: string) { const containers = await docker.listContainers({ all: true, filters: { label: [`nexus.runtime=${runtimeName}`, 'nexus.managed=true'] } }); return containers.find((item) => item.State === 'running' && !item.Names.some((name) => name.includes('-candidate-'))) ?? containers.find((item) => item.State === 'running'); }

export async function deployRuntime(spec: RuntimeSpec) {
  const docker = dockerClient(); const port = spec.containerPort ?? 80; const requestedHostPort = spec.hostPort ?? port; const proxyEnabled = process.env.TRAEFIK_ENABLED !== 'false'; const candidateName = `${spec.name}-candidate-${Date.now()}`; let previousName: string | undefined; let previousId: string | undefined; let candidate: Docker.Container | undefined;
  try {
    const previous = proxyEnabled ? await findActiveContainer(docker, spec.name) : undefined;
    if (previous) { const info = await previous.inspect(); previousName = info.Name?.replace(/^\//, '') || previous.id; previousId = info.Id; }
    const candidateHostPort = proxyEnabled ? 0 : (previousName ? 0 : requestedHostPort);
    candidate = await createAndStart(docker, spec, candidateName, candidateHostPort);
    const actualCandidatePort = await inspectHostPort(candidate, port);
    const healthUrl = spec.healthPath && actualCandidatePort ? `http://127.0.0.1:${actualCandidatePort}${spec.healthPath}` : undefined;
    const health = await waitForHealthyContainer(candidateName, { httpUrl: healthUrl });
    if (proxyEnabled) {
      const route = await switchTraffic(spec.name, candidateName, port, spec.healthPath, spec.domain);
      if (previousName) await removeContainer(docker, previousName);
      return { id: candidate.id, name: candidateName, url: route.url, host: route.host, tls: route.tls, health, replacedContainerId: previousId, candidateHealth: health };
    }
    if (previousName) { await removeContainer(docker, previousName); const final = await createAndStart(docker, spec, previousName, requestedHostPort); try { const finalPort = await inspectHostPort(final, port); const finalHealthUrl = spec.healthPath ? `http://127.0.0.1:${finalPort}${spec.healthPath}` : undefined; const finalHealth = await waitForHealthyContainer(previousName, { httpUrl: finalHealthUrl }); await removeContainer(docker, candidateName); return { id: final.id, name: previousName, url: `http://localhost:${finalPort}`, health: finalHealth, replacedContainerId: previousId, candidateHealth: health }; } catch (error) { await removeContainer(docker, previousName); throw error; } }
    await docker.getContainer(candidateName).rename({ name: spec.name });
    return { id: candidate.id, name: spec.name, url: `http://localhost:${actualCandidatePort}`, health, replacedContainerId: previousId };
  } catch (error) { if (candidate) await removeContainer(docker, candidateName); throw error; }
}

export async function rollbackRuntime(spec: RuntimeSpec & { previousImage: string }) { return deployRuntime({ ...spec, image: spec.previousImage }); }
