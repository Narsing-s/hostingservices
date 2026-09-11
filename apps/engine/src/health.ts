import Docker from 'dockerode';

function dockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}

export async function waitForHealthyContainer(name: string, timeoutMs = 120_000, intervalMs = 1500) {
  const docker = dockerClient();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const container = docker.getContainer(name);
    try {
      const info = await container.inspect();
      if (!info.State?.Running) throw new Error(`Container ${name} stopped before becoming healthy`);
      const health = info.State.Health;
      if (!health) return { healthy: true, healthcheck: 'not-configured' as const };
      if (health.Status === 'healthy') return { healthy: true, healthcheck: 'passed' as const };
      if (health.Status === 'unhealthy') throw new Error(`Container ${name} health check failed`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('health check failed')) throw error;
      if (error instanceof Error && error.message.includes('stopped')) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${name} to become healthy`);
}
