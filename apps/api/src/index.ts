import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

type Project={id:string;name:string;repo?:string;createdAt:string};
type Deployment={id:string;projectId:string;status:'queued'|'building'|'ready'|'failed';createdAt:string};
const projects=new Map<string,Project>();
const deployments=new Map<string,Deployment>();

app.get('/health',async()=>({ok:true,service:'nexus-api',timestamp:new Date().toISOString()}));
app.get('/api/v1/projects',async()=>[...projects.values()]);
app.post('/api/v1/projects',async(req,reply)=>{
 const body=z.object({name:z.string().min(1),repo:z.string().url().optional()}).parse(req.body);
 const project={id:crypto.randomUUID(),...body,createdAt:new Date().toISOString()}; projects.set(project.id,project); return reply.code(201).send(project);
});
app.get('/api/v1/deployments',async()=>[...deployments.values()]);
app.post('/api/v1/deployments',async(req,reply)=>{
 const {projectId}=z.object({projectId:z.string()}).parse(req.body);
 if(!projects.has(projectId)) return reply.code(404).send({error:'Project not found'});
 const d:Deployment={id:crypto.randomUUID(),projectId,status:'queued',createdAt:new Date().toISOString()}; deployments.set(d.id,d);
 return reply.code(202).send(d);
});

await app.listen({host:'0.0.0.0',port:Number(process.env.PORT??4000)});
