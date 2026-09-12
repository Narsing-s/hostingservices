import Docker from 'dockerode';
import { randomBytes } from 'node:crypto';

const docker = process.platform === 'win32' ? new Docker({ socketPath: '\\\\.\\pipe\\docker_engine' }) : new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
const networkName = process.env.RUNTIME_NETWORK ?? 'nexus-runtime';
const secret=(size=24)=>randomBytes(size).toString('base64url');
const hostPort=()=>20000+Math.floor(Math.random()*9000);
async function ensureNetwork(){const found=(await docker.listNetworks({filters:{name:[networkName]}}))[0];if(found)return found.Id;return (await docker.createNetwork({Name:networkName,Driver:'bridge'})).Id;}

export async function provisionManagedData(input:{instanceId:string;engine:'postgres'|'redis';version?:string;name?:string}){
  const networkId=await ensureNetwork();
  const safe=input.instanceId.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,30);
  const containerName=`nexus-data-${safe}`;
  try{await docker.getContainer(containerName).remove({force:true});}catch{}
  const password=secret();
  const port=hostPort();
  const image=input.engine==='postgres'?`postgres:${input.version||'16-alpine'}`:`redis:${input.version||'7-alpine'}`;
  const dbName=(input.name||'app').replace(/[^a-zA-Z0-9_]/g,'_');
  const env=input.engine==='postgres'?[`POSTGRES_USER=nexus`,`POSTGRES_PASSWORD=${password}`,`POSTGRES_DB=${dbName}`]:[];
  const binds=input.engine==='postgres'?[`nexus-data-${safe}:/var/lib/postgresql/data`]:[`nexus-data-${safe}:/data`];
  const cmd=input.engine==='redis'?['redis-server','--appendonly','yes','--requirepass',password]:undefined;
  const container=await docker.createContainer({name:containerName,image,Env:env,Cmd:cmd,HostConfig:{RestartPolicy:{Name:'unless-stopped'},Binds:binds,PortBindings:input.engine==='postgres'?{'5432/tcp':[ {HostPort:String(port)} ]}:{'6379/tcp':[ {HostPort:String(port)} ]},Memory:512*1024*1024,PidsLimit:256},ExposedPorts:input.engine==='postgres'?{'5432/tcp':{}}:{'6379/tcp':{}}});
  await container.start();
  try{await docker.getNetwork(networkId).connect({Container:container.id});}catch{}
  const endpoint=`${process.env.PUBLIC_ENGINE_HOST||'127.0.0.1'}:${port}`;
  const connectionUri=input.engine==='postgres'?`postgresql://nexus:${encodeURIComponent(password)}@${endpoint}/${dbName}`:`redis://:${encodeURIComponent(password)}@${endpoint}`;
  return {containerName,endpoint,connectionUri,port,network:networkName};
}
export async function destroyManagedData(containerName:string){const container=docker.getContainer(containerName);try{await container.stop({t:10});}catch{}try{await container.remove({force:true});}catch{}}
