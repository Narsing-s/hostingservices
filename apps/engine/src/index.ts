import Docker from 'dockerode';
import http from 'node:http';

const docker = new Docker();
const port = Number(process.env.PORT ?? 4100);

type DeployBody={name:string;image:string;containerPort?:number;hostPort?:number;env?:Record<string,string>};
function readBody(req:http.IncomingMessage):Promise<string>{return new Promise((resolve,reject)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>resolve(body));req.on('error',reject);});}
async function deploy(body:DeployBody){
  const name=body.name.replace(/[^a-zA-Z0-9_.-]/g,'-').toLowerCase();
  try{await docker.getContainer(name).remove({force:true});}catch{}
  try{await docker.getImage(body.image).inspect();}
  catch{await new Promise<void>((resolve,reject)=>docker.pull(body.image,(err,stream)=>{if(err||!stream)return reject(err);docker.modem.followProgress(stream,e=>e?reject(e):resolve());}));}
  const exposed=body.containerPort??80;
  const bindings=body.hostPort?{[`${exposed}/tcp`]:[{HostPort:String(body.hostPort)}]}:undefined;
  const container=await docker.createContainer({name,image:body.image,Env:Object.entries(body.env??{}).map(([k,v])=>`${k}=${v}`),ExposedPorts:{[`${exposed}/tcp`]:{}},HostConfig:{PortBindings:bindings,restartPolicy:{Name:'unless-stopped'}}});
  await container.start();
  return {id:container.id,name,image:body.image,status:'running',port:body.hostPort??null};
}

http.createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');
  try{
    if(req.url==='/health'){res.end(JSON.stringify({ok:true,docker:!!(await docker.ping())}));return;}
    if(req.url==='/api/v1/runtime/containers'&&req.method==='GET'){res.end(JSON.stringify(await docker.listContainers({all:true})));return;}
    if(req.url==='/api/v1/runtime/deploy'&&req.method==='POST'){
      const body=JSON.parse(await readBody(req)) as DeployBody;
      if(!body.name||!body.image){res.statusCode=400;res.end(JSON.stringify({error:'name and image are required'}));return;}
      res.statusCode=201;res.end(JSON.stringify(await deploy(body)));return;
    }
    if(req.url?.startsWith('/api/v1/runtime/logs/')&&req.method==='GET'){
      const name=decodeURIComponent(req.url.split('/').pop()!); const c=docker.getContainer(name); const logs=await c.logs({stdout:true,stderr:true,tail:200}); res.end(JSON.stringify({name,logs:logs.toString()}));return;
    }
    res.statusCode=404;res.end(JSON.stringify({error:'Not found'}));
  }catch(error){res.statusCode=500;res.end(JSON.stringify({error:String(error)}));}
}).listen(port,'0.0.0.0',()=>console.log(`Nexus engine listening on ${port}`));
