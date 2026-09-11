import Docker from 'dockerode';
import http from 'node:http';

const docker = new Docker();
const port = Number(process.env.PORT ?? 4100);

async function health() {
  try { await docker.ping(); return { ok:true, docker:true }; }
  catch { return { ok:false, docker:false }; }
}

http.createServer(async (req,res)=>{
  res.setHeader('content-type','application/json');
  if (req.url === '/health') { res.end(JSON.stringify(await health())); return; }
  if (req.url === '/api/v1/runtime/containers') {
    try { res.end(JSON.stringify(await docker.listContainers({all:true}))); }
    catch (e) { res.statusCode=503; res.end(JSON.stringify({error:String(e)})); }
    return;
  }
  res.statusCode=404; res.end(JSON.stringify({error:'Not found'}));
}).listen(port,'0.0.0.0',()=>console.log(`Nexus engine listening on ${port}`));
