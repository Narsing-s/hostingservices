import fs from 'node:fs/promises';
import path from 'node:path';

const dynamicDir = process.env.TRAEFIK_DYNAMIC_DIR ?? path.resolve(process.cwd(), 'infra/docker/dynamic');
const publicDomain = process.env.NEXUS_PUBLIC_DOMAIN ?? 'localhost';
const tlsEnabled = process.env.NEXUS_TLS_ENABLED === 'true';
const certResolver = process.env.NEXUS_TLS_CERT_RESOLVER ?? 'letsencrypt';

function safe(value: string) { return value.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'service'; }
function validDomain(value: string) { return /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(value); }

export function runtimeHost(name: string) { return `${safe(name)}.${publicDomain}`; }

export async function switchTraffic(name: string, containerName: string, containerPort: number, healthPath?: string, domain?: string) {
  await fs.mkdir(dynamicDir, { recursive: true });
  const id = safe(name);
  const host = domain && validDomain(domain) ? domain : runtimeHost(name);
  const service = `${id}-active`;
  const router = `${id}-router`;
  const health = healthPath ? `\n        healthCheck:\n          path: ${JSON.stringify(healthPath)}\n          interval: 5s\n          timeout: 2s` : '';
  const tls = tlsEnabled ? `\n      tls:\n        certResolver: ${certResolver}` : '';
  const entryPoints = tlsEnabled ? '        - websecure' : '        - web';
  const scheme = tlsEnabled ? 'https' : 'http';
  const config = `http:\n  routers:\n    ${router}:\n      entryPoints:\n${entryPoints}\n      rule: "Host(\`${host}\`)"\n      service: ${service}${tls}\n  services:\n    ${service}:\n      loadBalancer:\n        servers:\n          - url: "http://${containerName}:${containerPort}"${health}\n`;
  const target = path.join(dynamicDir, `${id}.yml`);
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, config, 'utf8');
  await fs.rename(temp, target);
  return { host, url: `${scheme}://${host}`, configFile: target, tls: tlsEnabled };
}

export async function removeTraffic(name: string) { await fs.rm(path.join(dynamicDir, `${safe(name)}.yml`), { force: true }); }
