import Docker from 'dockerode';
import type { DeploymentRecord } from '../../contracts/src/deployment';

export interface DeploymentResult { containerId: string; url?: string; }

export interface Provider {
  deploy(deployment: DeploymentRecord): Promise<DeploymentResult>;
  health(): Promise<boolean>;
}

function createDockerClient() {
  if (process.env.DOCKER_HOST) return new Docker({ host: process.env.DOCKER_HOST, port: Number(process.env.DOCKER_PORT ?? 2375) });
  if (process.platform === 'win32') return new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' });
  return new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
}

export class DockerProvider implements Provider {
  private readonly docker = createDockerClient();

  async health() { try { await this.docker.ping(); return true; } catch { return false; } }

  async deploy(deployment: DeploymentRecord): Promise<DeploymentResult> {
    const image = deployment.source?.image;
    if (!image) throw new Error('source.image is required for Docker deployment');
    const name = `nexus-${deployment.serviceId}-${deployment.id}`.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const container = await this.docker.createContainer({
      Image: image,
      name,
      Env: Object.entries(deployment.env ?? {}).map(([key, value]) => `${key}=${value}`),
      ExposedPorts: deployment.port ? { [`${deployment.port}/tcp`]: {} } : undefined,
      HostConfig: {
        AutoRemove: true,
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings: deployment.port ? { [`${deployment.port}/tcp`]: [{ HostPort: String(process.env.HOST_PORT ?? deployment.port) }] } : undefined,
      },
      Labels: { 'nexus.deployment': deployment.id, 'nexus.service': deployment.serviceId },
    });
    await container.start();
    return { containerId: container.id, url: deployment.port ? `http://localhost:${process.env.HOST_PORT ?? deployment.port}` : undefined };
  }
}
