#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { parse } = require('yaml');

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);
const ENGINE_URL = process.env.NEXUS_ENGINE_URL || 'http://localhost:4100';
const API_URL = process.env.NEXUS_API_URL || 'http://localhost:4000';

function usage() { console.log(`Nexus CLI 0.6.0\n\nCommands:\n  nexus build <repo> @ <ref> [--service <name>]\n  nexus services <repo> @ <ref>\n  nexus validate [nexus.yaml]\n  nexus deploy [nexus.yaml]\n\nEnvironment:\n  NEXUS_ENGINE_URL  Engine URL (default: http://localhost:4100)\n  NEXUS_API_URL     API URL (default: http://localhost:4000)`); }
function parseRepoRef(values) { const at = values.indexOf('@'); const repo = at >= 0 ? values.slice(0, at).join(' ') : values.find((v) => /^https?:\/\//.test(v)); const ref = at >= 0 ? values[at + 1] : 'main'; if (!repo) throw new Error('Repository URL is required. Example: nexus build https://github.com/owner/repo @ main'); return { repo, ref: ref || 'main' }; }
function option(values, name) { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : undefined; }
async function request(base, route, options = {}) { const response = await fetch(`${base}${route}`, options); const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error || value.detail || `Nexus returned HTTP ${response.status}`); return value; }
async function post(base, route, body) { return request(base, route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function validateManifest(manifest) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Manifest must be a YAML object');
  assert(manifest.version === 1, 'version must be 1');
  assert(typeof manifest.name === 'string' && manifest.name.trim(), 'name is required');
  const service = manifest.service;
  assert(service && typeof service === 'object', 'service is required');
  assert(['web','worker','cron','private'].includes(service.type), 'service.type must be web, worker, cron or private');
  const source = service.source;
  assert(source && typeof source === 'object', 'service.source is required');
  assert(source.type === 'git', 'Only service.source.type=git is currently supported by nexus deploy');
  assert(typeof source.repo === 'string' && /^https?:\/\//.test(source.repo), 'service.source.repo must be an http(s) repository URL');
  if (source.ref !== undefined) assert(typeof source.ref === 'string' && source.ref.length > 0, 'service.source.ref must be a non-empty string');
  if (service.build !== undefined) { assert(typeof service.build === 'object', 'service.build must be an object'); if (service.build.runtime !== undefined) assert(service.build.runtime === 'auto', 'service.build.runtime currently supports only auto'); if (service.build.service !== undefined) assert(typeof service.build.service === 'string' && /^[a-zA-Z0-9._-]+$/.test(service.build.service), 'service.build.service contains invalid characters'); }
  if (service.runtime !== undefined) { assert(typeof service.runtime === 'object', 'service.runtime must be an object'); if (service.runtime.port !== undefined) assert(Number.isInteger(service.runtime.port) && service.runtime.port >= 1 && service.runtime.port <= 65535, 'service.runtime.port must be 1-65535'); if (service.runtime.health !== undefined) { assert(typeof service.runtime.health === 'object', 'service.runtime.health must be an object'); if (service.runtime.health.path !== undefined) assert(typeof service.runtime.health.path === 'string' && service.runtime.health.path.startsWith('/'), 'health.path must start with /'); if (service.runtime.health.mode !== undefined) assert(['auto','http','docker','process'].includes(service.runtime.health.mode), 'health.mode is invalid'); } }
  const deploy = service.deploy || {};
  assert(typeof deploy === 'object' && !Array.isArray(deploy), 'service.deploy must be an object');
  if (deploy.replicas !== undefined) assert(Number.isInteger(deploy.replicas) && deploy.replicas >= 1 && deploy.replicas <= 20, 'deploy.replicas must be an integer from 1 to 20');
  for (const key of ['zeroDowntime','rollbackOnFailure']) if (deploy[key] !== undefined) assert(typeof deploy[key] === 'boolean', `service.deploy.${key} must be boolean`);
  if (manifest.env !== undefined) assert(manifest.env && typeof manifest.env === 'object' && !Array.isArray(manifest.env), 'env must be a key/value object');
  if (manifest.secrets !== undefined) { assert(Array.isArray(manifest.secrets), 'secrets must be an array'); for (const secret of manifest.secrets) assert(typeof secret === 'string' && /^[A-Z0-9_]+$/i.test(secret), 'secret names must contain only letters, numbers and underscores'); }
  return manifest;
}
async function readManifest(file = 'nexus.yaml') { const filename = path.resolve(process.cwd(), file); const source = await fs.readFile(filename, 'utf8'); try { return { file: filename, manifest: validateManifest(parse(source)) }; } catch (error) { if (error?.name === 'YAMLParseError') throw new Error(`Invalid YAML in ${file}: ${error.message}`); throw error; } }
async function deployManifest(file) {
  const { file: filename, manifest } = await readManifest(file); const service = manifest.service; const source = service.source; const project = await post(API_URL, '/api/v1/projects', { name: manifest.name, repo: source.repo });
  const runtime = service.runtime || {}; const health = runtime.health || {}; const deploy = service.deploy || {};
  const deployment = await post(API_URL, '/api/v1/deployments', { projectId: project.id, repo: source.repo, ref: source.ref || 'main', service: service.build?.service, serviceType: service.type, public: service.type === 'web', healthMode: health.mode, containerPort: runtime.port || 80, healthPath: health.path, replicas: deploy.replicas || 1, zeroDowntime: deploy.zeroDowntime ?? true, rollbackOnFailure: deploy.rollbackOnFailure ?? true, env: manifest.env || {} });
  console.log(`✓ Manifest valid: ${filename}`); console.log(`✓ Project created: ${project.name} (${project.id})`); console.log(`✓ Deployment accepted: ${deployment.id}`); console.log(`  Service: ${service.type}${service.build?.service ? ` / ${service.build.service}` : ''}`); console.log(`  Ref: ${source.ref || 'main'}`); console.log(`  Replicas: ${deploy.replicas || 1}`); console.log(`  Zero downtime: ${deploy.zeroDowntime ?? true}`); console.log(`  Rollback on failure: ${deploy.rollbackOnFailure ?? true}`); if (manifest.secrets?.length) console.log(`  Secrets declared: ${manifest.secrets.join(', ')} (configure values in Nexus; none were committed)`); return deployment;
}
async function main() {
  if (!command || command === '--help' || command === '-h') return usage();
  if (command === 'validate' || command === 'deploy') { const file = rest[0] || 'nexus.yaml'; const { file: filename, manifest } = await readManifest(file); if (command === 'validate') { console.log(`✓ Valid Nexus manifest: ${filename}`); console.log(`  Name: ${manifest.name}`); console.log(`  Type: ${manifest.service.type}`); console.log(`  Source: ${manifest.service.source.repo} @ ${manifest.service.source.ref || 'main'}`); console.log(`  Replicas: ${manifest.service.deploy?.replicas || 1}`); console.log(`  Zero downtime: ${manifest.service.deploy?.zeroDowntime ?? true}`); console.log(`  Rollback on failure: ${manifest.service.deploy?.rollbackOnFailure ?? true}`); return; } await deployManifest(file); return; }
  if (command !== 'build' && command !== 'services') throw new Error(`Unknown command '${command}'. Run nexus --help.`);
  const { repo, ref } = parseRepoRef(rest); const service = option(rest, '--service');
  if (command === 'services') { const value = await post(ENGINE_URL, '/api/v1/runtime/detect', { repo, ref }); console.log(`Repository: ${repo}`); console.log(`Ref: ${ref}`); console.log(`Runtime: ${value.runtime}`); if (value.availableServices?.length) { console.log('Services:'); for (const item of value.availableServices) console.log(`  - ${item}`); } else console.log('Services: root application'); return; }
  const image = `nexus/cli:${Date.now().toString(36)}`; console.log(`$ nexus build ${repo} @ ${ref}${service ? ` --service ${service}` : ''}`); const value = await post(ENGINE_URL, '/api/v1/runtime/build', { repo, ref, image, service }); console.log(`\n✓ Build completed: ${value.image}`); console.log(`  Runtime: ${value.runtime}`); if (value.service) console.log(`  Service: ${value.service}`); if (value.availableServices?.length) console.log(`  Available services: ${value.availableServices.join(', ')}`);
}
main().catch((error) => { console.error(`\n✗ ${error.message}`); process.exitCode = 1; });
