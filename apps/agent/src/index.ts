import Fastify from 'fastify';
import Docker from 'dockerode';

const app = Fastify({ logger: true });

function createDockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}

const docker = createDockerClient();

app.get('/health', async () => {
  try {
    await docker.ping();
    return { ok: true, service: 'nexus-agent', docker: true };
  } catch {
    return { ok: true, service: 'nexus-agent', docker: false };
  }
});

app.listen({ port: Number(process.env.PORT ?? 4200), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
