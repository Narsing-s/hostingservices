#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);
const ENGINE_URL = process.env.NEXUS_ENGINE_URL || 'http://localhost:4100';

function usage() {
  console.log(`Nexus CLI 0.4.0\n\nCommands:\n  nexus build <repo> @ <ref> [--service <name>]\n  nexus services <repo> @ <ref>\n\nEnvironment:\n  NEXUS_ENGINE_URL  Engine URL (default: http://localhost:4100)`);
}

function parseRepoRef(values) {
  const at = values.indexOf('@');
  const repo = at >= 0 ? values.slice(0, at).join(' ') : values.find((v) => v.startsWith('http://') || v.startsWith('https://'));
  const ref = at >= 0 ? values[at + 1] : 'main';
  if (!repo) throw new Error('Repository URL is required. Example: nexus build https://github.com/owner/repo @ main');
  return { repo, ref: ref || 'main' };
}

function option(values, name) {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
}

async function post(path, body) {
  const response = await fetch(`${ENGINE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || value.detail || `Nexus engine returned HTTP ${response.status}`);
  return value;
}

async function main() {
  if (!command || command === '--help' || command === '-h') return usage();
  if (command !== 'build' && command !== 'services') throw new Error(`Unknown command '${command}'. Run nexus --help.`);

  const { repo, ref } = parseRepoRef(rest);
  const service = option(rest, '--service');
  if (command === 'services') {
    const value = await post('/api/v1/runtime/detect', { repo, ref });
    console.log(`Repository: ${repo}`);
    console.log(`Ref: ${ref}`);
    console.log(`Runtime: ${value.runtime}`);
    if (value.availableServices?.length) {
      console.log('Services:');
      for (const item of value.availableServices) console.log(`  - ${item}`);
    } else {
      console.log('Services: root application');
    }
    return;
  }

  const image = `nexus/cli:${Date.now().toString(36)}`;
  console.log(`$ nexus build ${repo} @ ${ref}${service ? ` --service ${service}` : ''}`);
  const value = await post('/api/v1/runtime/build', { repo, ref, image, service });
  console.log(`\n✓ Build completed: ${value.image}`);
  console.log(`  Runtime: ${value.runtime}`);
  if (value.service) console.log(`  Service: ${value.service}`);
  if (value.availableServices?.length) console.log(`  Available services: ${value.availableServices.join(', ')}`);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
});
