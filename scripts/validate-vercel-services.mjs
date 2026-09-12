import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'vercel.json');
const config = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!config.services || typeof config.services !== 'object') throw new Error('vercel.json must define services');
const names = new Set(Object.keys(config.services));
if (!names.has('web')) throw new Error('Vercel Services config must define web');
if (!names.has('api')) throw new Error('Vercel Services config must define api');

for (const [name, service] of Object.entries(config.services)) {
  if (!service.root) throw new Error(`Service ${name} is missing root`);
  const serviceRoot = path.join(root, service.root);
  if (!fs.existsSync(serviceRoot)) throw new Error(`Service ${name} root does not exist: ${service.root}`);
  if (service.bindings) {
    for (const binding of service.bindings) {
      if (binding.type !== 'service') throw new Error(`Unsupported binding type on ${name}: ${binding.type}`);
      if (!names.has(binding.service)) throw new Error(`Service ${name} binds to unknown service: ${binding.service}`);
      if (!binding.env) throw new Error(`Service ${name} has a binding without env`);
    }
  }
}

const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
const destinationServices = rewrites
  .map((rule) => rule?.destination?.service)
  .filter(Boolean);
for (const service of destinationServices) {
  if (!names.has(service)) throw new Error(`Rewrite points to unknown service: ${service}`);
}
if (!destinationServices.includes('web')) throw new Error('Vercel routing must expose the web service');

console.log(`Vercel Services configuration OK: ${Object.keys(config.services).join(', ')}`);
