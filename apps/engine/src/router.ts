import fs from 'node:fs/promises';
import path from 'node:path';

const dynamicDir = process.env.TRAEFIK_DYNAMIC_DIR ?? path.resolve(process.cwd(), 'infra/docker/dynamic');
const publicDomain = process.env.NEXUS_PUBLIC_DOMAIN ?? 'localhost';

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'service';
}

export function runtimeHost(name: string) {
  return `${safe(name)}.${publicDomain}`;
}

export async function switchTraffic(name: string, containerName: string, containerPort: number, healthPath?: string) {
  await fs.mkdir(dynamicDir, { recursive: true });
  const id = safe(name);
  const host = runtimeHost(name);
  const service = `${id}-active`;
  const router = `${id}-router`;
  const health = healthPath ? `\n            healthCheck:\n              path: ${JSON.stringify(healthPath)}\n              interval: 5s\n              timeout: 2s` : '';
  const config = `http:\n  routers:\n    ${router}:\n      entryPoints:\n        - web\n      rule: "Host(\`${host}\`)"\n      service: ${service}\n  services:\n    ${service}:\n      loadBalancer:\n        servers:\n          - url: "http://${containerName}:${containerPort}"${health}\n`;
  const target = path.join(dynamicDir, `${id}.yml`);
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, config, 'utf8');
  await fs.rename(temp, target);
  return { host, url: `http://${host}`, configFile: target };
}

export async function removeTraffic(name: string) {
  const target = path.join(dynamicDir, `${safe(name)}.yml`);
  await fs.rm(target, { force: true });
}
