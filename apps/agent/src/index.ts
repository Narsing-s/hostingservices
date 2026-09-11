import Fastify from 'fastify';
import { DockerProvider } from '../../../packages/providers/src/index';

const app = Fastify({ logger: true });
const provider = new DockerProvider();
app.get('/health', async () => ({ ok: true, service: 'nexus-agent', docker: await provider.health() }));
app.listen({ port: Number(process.env.PORT ?? 4200), host: '0.0.0.0' }).catch((error) => { app.log.error(error); process.exit(1); });
