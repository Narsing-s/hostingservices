import Docker from 'dockerode';
import { randomBytes } from 'node:crypto';

const docker = process.platform === 'win32'
  ? new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' })
  : new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
const networkName = process.env.RUNTIME_NETWORK ?? 'nexus-runtime';

function secret(size=24){ return randomBytes(size).toString('base64url'); }
function hostPort(){ return 20000 + Math.floor(Math.random()*9000); }

async function ensureNetwork(){
  const found=(await docker.listNetworks({filters:{name:[networkName]}}))[0];
  if(found) return found.Id;
  return (await docker.createNetwork({Name:networkName,Driver:'bridge'})).Id;
}

export async function provisionManagedData(input:{instanceId:string;engine:'postgres'|'redis';version?:string;name?:string}){
  const networkId=await ensureNetwork();
  const safe=input.instanceId.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,30);
  const containerName=`nexus-data-${safe}`;
  try { await docker.getContainer(containerName).remove({force:true}); } catch {}
  const password=secret();
  const port=hostPort();
  const image=input.engine==='postgres'?`postgres:${input.version||'16-alpine'}`:`redis:${input.version||'7-alpine'}`;
  const env=input.engine==='postgres' ? [`POSTGRES_USER=nexus`,`POSTGRES_PASSWORD=${password}`,`POSTGRES_DB=${(input.name||'app').replace(/[^a-zA-Z0-9_]/g,'_')}`] : [];
  const binds=[`nexus-data-${safe}:/var/lib/${input.engine==='postgres'?'postgresql/data':'redis'}`];
  const container=await docker.createContainer({name:containerName,image,Env:env,Cmd:input.engine==='redis'?['redis-server','--appendonly','yes']:undefined,HostConfig:{RestartPolicy:{Name:'unless-stopped'},Binds:binds,PortBindings:input.engine==='postgres'?{'5432/tcp':[ {HostPort:String(port)} ]}:{'6379/tcp':[ {HostPort:String(port)} ]},Memory:512*1024*1024,PidsLimit:256},ExposedPorts:input.engine==='postgres'?{'5432/tcp':{}}:{'6379/tcp':{}}});
  await container.start();
  try { await docker.getNetwork(networkId).connect({Container:container.id}); } catch {}
  const endpoint=`${process.env.PUBLIC_ENGINE_HOST||'127.0.0.1'}:${port}`;
  const connectionUri=input.engine==='postgres'?`postgresql://nexus:${encodeURIComponent(password)}@${endpoint}/${(input.name||'app').replace(/[^a-zA-Z0-9_]/g,'_')}`:`redis://:${encodeURIComponent(password)}@${endpoint}`;
  return {containerName,endpoint,connectionUri,port,network:networkName};
}

export async function destroyManagedData(containerName:string){
  const container=docker.getContainer(containerName);
  try { await container.stop({t:10}); } catch {}
  try { await container.remove({force:true}); } catch {}
}
