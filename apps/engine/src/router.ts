import fs from 'node:fs/promises';
import path from 'node:path';

const dynamicDir = process.env.TRAEFIK_DYNAMIC_DIR ?? path.resolve(process.cwd(), 'infra/docker/dynamic');
const publicDomain = process.env.NEXUS_PUBLIC_DOMAIN ?? 'localhost';
const tlsEnabled = process.env.NEXUS_TLS_ENABLED === 'true';
const certResolver = process.env.NEXUS_TLS_CERT_RESOLVER ?? 'letsencrypt';

function safe(value: string) { return value.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'service'; }
function validDomain(value: string) { return /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,63}$/.test(value); }

export function runtimeHost(name: string) { return `${safe(name)}.${publicDomain}`; }

function header(name: string, domain?: string) {
  const host = domain && validDomain(domain) ? domain : runtimeHost(name);
  const router = `${safe(name)}-router`;
  const tls = tlsEnabled ? `\n      tls:\n        certResolver: ${certResolver}` : '';
  const entryPoints = tlsEnabled ? '        - websecure' : '        - web';
  return { host, router, tls, entryPoints };
}

export async function switchTraffic(name: string, containerName: string | string[], containerPort: number, healthPath?: string, domain?: string) {
  await fs.mkdir(dynamicDir, { recursive: true });
  const id = safe(name); const { host, router, tls, entryPoints } = header(name, domain);
  const service = `${id}-active`;
  const health = healthPath ? `\n        healthCheck:\n          path: ${JSON.stringify(healthPath)}\n          interval: 5s\n          timeout: 2s` : '';
  const names = Array.isArray(containerName) ? containerName : [containerName];
  const servers = names.map((container) => `          - url: "http://${container}:${containerPort}"`).join('\n');
  const config = `http:\n  routers:\n    ${router}:\n      entryPoints:\n${entryPoints}\n      rule: "Host(\\`${host}\\`)"\n      service: ${service}${tls}\n  services:\n    ${service}:\n      loadBalancer:\n        servers:\n${servers}${health}\n`;
  const target = path.join(dynamicDir, `${id}.yml`); const temp = `${target}.tmp`;
  await fs.writeFile(temp, config, 'utf8'); await fs.rename(temp, target);
  return { host, url: `${tlsEnabled ? 'https' : 'http'}://${host}`, configFile: target, tls: tlsEnabled, replicas: names.length };
}

export async function switchWeightedTraffic(name: string, stable: string[], candidate: string[], containerPort: number, candidateWeight: number, healthPath?: string, domain?: string) {
  await fs.mkdir(dynamicDir, { recursive: true });
  const id = safe(name); const { host, router, tls, entryPoints } = header(name, domain);
  const weight = Math.max(0, Math.min(100, Math.round(candidateWeight)));
  const health = healthPath ? `\n        healthCheck:\n          path: ${JSON.stringify(healthPath)}\n          interval: 5s\n          timeout: 2s` : '';
  const servers = (names: string[]) => names.map((container) => `          - url: "http://${container}:${containerPort}"`).join('\n');
  const config = `http:\n  routers:\n    ${router}:\n      entryPoints:\n${entryPoints}\n      rule: "Host(\\`${host}\\`)"\n      service: ${id}-weighted${tls}\n  services:\n    ${id}-stable:\n      loadBalancer:\n        servers:\n${servers(stable)}${health}\n    ${id}-candidate:\n      loadBalancer:\n        servers:\n${servers(candidate)}${health}\n    ${id}-weighted:\n      weighted:\n        services:\n          - name: ${id}-stable\n            weight: ${100 - weight}\n          - name: ${id}-candidate\n            weight: ${weight}\n`;
  const target = path.join(dynamicDir, `${id}.yml`); const temp = `${target}.tmp`;
  await fs.writeFile(temp, config, 'utf8'); await fs.rename(temp, target);
  return { host, url: `${tlsEnabled ? 'https' : 'http'}://${host}`, configFile: target, tls: tlsEnabled, candidateWeight: weight, stableReplicas: stable.length, candidateReplicas: candidate.length };
}

export async function removeTraffic(name: string) { await fs.rm(path.join(dynamicDir, `${safe(name)}.yml`), { force: true }); }
