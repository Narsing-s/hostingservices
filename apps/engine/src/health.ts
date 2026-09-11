import Docker from 'dockerode';
import http from 'node:http';

function dockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}

export type HealthOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  httpUrl?: string;
};

function httpProbe(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 400));
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

export async function waitForHealthyContainer(name: string, options: HealthOptions = {}) {
  const docker = dockerClient();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 1_500;
  const started = Date.now();
  let lastError = 'not ready';

  while (Date.now() - started < timeoutMs) {
    try {
      const info = await docker.getContainer(name).inspect();
      if (!info.State?.Running) throw new Error(`Container ${name} stopped before becoming healthy`);

      const health = info.State.Health;
      if (health) {
        if (health.Status === 'healthy') return { healthy: true, healthcheck: 'passed' as const };
        if (health.Status === 'unhealthy') throw new Error(`Container ${name} Docker health check failed`);
        lastError = `Docker health status: ${health.Status}`;
      } else if (options.httpUrl) {
        if (await httpProbe(options.httpUrl, Math.min(intervalMs, 5_000))) {
          return { healthy: true, healthcheck: 'http' as const };
        }
        lastError = `HTTP health probe failed: ${options.httpUrl}`;
      } else if (process.env.REQUIRE_HEALTHCHECK === 'false') {
        return { healthy: true, healthcheck: 'not-configured' as const };
      } else {
        throw new Error(`Container ${name} has no Docker HEALTHCHECK and no HTTP health URL was configured`);
      }
    } catch (error) {
      if (error instanceof Error) {
        lastError = error.message;
        if (error.message.includes('stopped before') || error.message.includes('health check failed') || error.message.includes('no Docker HEALTHCHECK')) throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${name} to become healthy: ${lastError}`);
}
