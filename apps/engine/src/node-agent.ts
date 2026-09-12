import Docker from 'dockerode';
import { createHmac } from 'node:crypto';

const apiUrl = process.env.ENGINE_CALLBACK_URL ?? 'http://127.0.0.1:4000';
const secret = process.env.ENGINE_INTERNAL_SECRET ?? '';
const name = process.env.NODE_NAME ?? 'local';
const endpoint = process.env.NODE_ENDPOINT ?? `http://127.0.0.1:${process.env.PORT ?? 4100}`;
const region = process.env.NODE_REGION ?? 'local';
const docker = process.platform === 'win32' ? new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' }) : new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });

function authHeader(){return createHmac('sha256',secret).update('nexus-engine').digest('hex');}

async function capacity(){
  const info=await docker.info() as any;
  const cpus=Number(info.NCPU??1);
  const memory=Number(info.MemTotal??0);
  const containers=await docker.listContainers({all:false});
  let usedCpuMillis=0; let usedMemoryBytes=0;
  for(const item of containers){
    try{const c=docker.getContainer(item.Id);const stats=await c.stats({stream:false});const usage=Number(stats.memory_stats?.usage??0);usedMemoryBytes+=usage;const inspect=await c.inspect() as any;const nano=Number(inspect.HostConfig?.NanoCpus??0);usedCpuMillis+=nano?nano/1_000_000:0;}catch{}
  }
  return {capacityCpuMillis:cpus*1000,capacityMemoryBytes:memory,usedCpuMillis,usedMemoryBytes};
}

async function register(){
  if(!secret)return;
  const c=await capacity();
  const response=await fetch(`${apiUrl}/api/v1/runtime/nodes`,{method:'POST',headers:{'content-type':'application/json','x-engine-secret':authHeader()},body:JSON.stringify({name,endpoint,region,...c})});
  if(!response.ok)throw new Error(`node registration failed: ${response.status}`);
}
async function heartbeat(){
  if(!secret)return;
  try{const c=await capacity();await fetch(`${apiUrl}/api/v1/runtime/nodes/${encodeURIComponent(name)}/heartbeat`,{method:'POST',headers:{'content-type':'application/json','x-engine-secret':authHeader()},body:JSON.stringify(c)});}catch(error){console.error(`[node:${name}] heartbeat failed`,error);}
}

export async function startNodeAgent(){
  if(!secret){console.warn(`[node:${name}] ENGINE_INTERNAL_SECRET is not configured; node agent disabled`);return;}
  try{await register();console.log(`[node:${name}] registered in ${region}`);}catch(error){console.error(`[node:${name}] initial registration failed`,error);}
  const interval=Number(process.env.NODE_HEARTBEAT_INTERVAL_MS??15000);
  setInterval(heartbeat,Math.max(5000,interval));
}
