import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';

const app=Fastify({logger:true});
await app.register(cors,{origin:true});
const ENGINE_URL=process.env.ENGINE_URL??'http://localhost:4100';
type Project={id:string;name:string;repo?:string;createdAt:string};
type Deployment={id:string;projectId:string;status:string;runtime?:unknown;createdAt:string};
const projects=new Map<string,Project>(); const deployments=new Map<string,Deployment>();

app.get('/health',async()=>({ok:true,service:'nexus-api',engine:ENGINE_URL,timestamp:new Date().toISOString()}));
app.get('/api/v1/projects',async()=>[...projects.values()]);
app.post('/api/v1/projects',async(req,reply)=>{const body=z.object({name:z.string().min(1),repo:z.string().url().optional()}).parse(req.body);const project={id:crypto.randomUUID(),...body,createdAt:new Date().toISOString()};projects.set(project.id,project);return reply.code(201).send(project);});
app.get('/api/v1/deployments',async()=>[...deployments.values()]);
app.post('/api/v1/deployments',async(req,reply)=>{
 const body=z.object({projectId:z.string(),image:z.string().default('nginx:alpine'),hostPort:z.number().int().min(1).max(65535).optional()}).parse(req.body);
 if(!projects.has(body.projectId))return reply.code(404).send({error:'Project not found'});
 const id=crypto.randomUUID(); const d:Deployment={id,projectId:body.projectId,status:'building',createdAt:new Date().toISOString()}; deployments.set(id,d);
 try{const r=await fetch(`${ENGINE_URL}/api/v1/runtime/deploy`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:`nexus-${id.slice(0,8)}`,image:body.image,hostPort:body.hostPort})});const runtime=await r.json();if(!r.ok)throw new Error(JSON.stringify(runtime));d.status='ready';d.runtime=runtime;return reply.code(201).send(d);}catch(error){d.status='failed';return reply.code(502).send({error:'Runtime deployment failed',detail:String(error),deployment:d});}
});
await app.listen({host:'0.0.0.0',port:Number(process.env.PORT??4000)});
