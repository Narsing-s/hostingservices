import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { addDeploymentEvent } from './db.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://nexus:nexus_dev_only@127.0.0.1:5432/nexus' });

type GateConfig = { id:string; name:string; kind:string; required:boolean; config:any };
type GateResult = { name:string; kind:string; required:boolean; status:'passed'|'failed'|'skipped'; message:string };

async function configs(projectId:string):Promise<GateConfig[]> {
  const r=await pool.query('SELECT id,name,kind,required,config FROM release_gate_configs WHERE project_id=$1 ORDER BY created_at',[projectId]);
  return r.rows;
}
async function ensureResult(deploymentId:string, gate:GateConfig, result:GateResult) {
  await pool.query(`INSERT INTO release_gate_results(id,deployment_id,gate_id,name,status,message) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(deployment_id,name) DO UPDATE SET status=EXCLUDED.status,message=EXCLUDED.message,updated_at=NOW()`,
    [randomUUID(),deploymentId,gate.id,gate.name,result.status,result.message]);
}
async function runOne(deploymentId:string, gate:GateConfig, ctx:any):Promise<GateResult> {
  const kind=gate.kind.toLowerCase().replace(/[- ]/g,'_');
  try {
    if(kind==='env_validation' || kind==='environment') {
      const required=Array.isArray(gate.config?.required) ? gate.config.required : [];
      const missing=required.filter((key:string)=>ctx.env?.[key]===undefined && process.env[key]===undefined);
      return missing.length ? {name:gate.name,kind:gate.kind,required:gate.required,status:'failed',message:`Missing required environment values: ${missing.join(', ')}`} : {name:gate.name,kind:gate.kind,required:gate.required,status:'passed',message:'Required environment values are present'};
    }
    if(kind==='build') return {name:gate.name,kind:gate.kind,required:gate.required,status:ctx.built?'passed':'failed',message:ctx.built?'Build completed successfully':'Build did not complete'};
    if(kind==='security' || kind==='security_scan') {
      const blocked=Array.isArray(ctx.securityFindings)?ctx.securityFindings:[];
      return blocked.length ? {name:gate.name,kind:gate.kind,required:gate.required,status:'failed',message:`Security gate found ${blocked.length} blocking finding(s)`} : {name:gate.name,kind:gate.kind,required:gate.required,status:'passed',message:'No blocking security findings were reported'};
    }
    if(kind==='github_checks' || kind==='github') {
      if(ctx.githubChecks===undefined) return {name:gate.name,kind:gate.kind,required:gate.required,status:'skipped',message:'GitHub check data is not available for this deployment'};
      return ctx.githubChecks===true ? {name:gate.name,kind:gate.kind,required:gate.required,status:'passed',message:'GitHub checks passed'} : {name:gate.name,kind:gate.kind,required:gate.required,status:'failed',message:'GitHub checks did not pass'};
    }
    if(kind==='health' || kind==='smoke') return {name:gate.name,kind:gate.kind,required:gate.required,status:'skipped',message:'This gate runs after the runtime becomes reachable'};
    if(kind==='approval' || kind==='human_approval') return {name:gate.name,kind:gate.kind,required:gate.required,status:'failed',message:'Deployment requires an explicit approval before release'};
    return {name:gate.name,kind:gate.kind,required:gate.required,status:'skipped',message:`Gate kind '${gate.kind}' is not executable yet`};
  } catch(error) { return {name:gate.name,kind:gate.kind,required:gate.required,status:'failed',message:String(error)}; }
}

export async function runPreReleaseGates(projectId:string,deploymentId:string,ctx:any) {
  const gates=await configs(projectId); const results:GateResult[]=[];
  for(const gate of gates) {
    const result=await runOne(deploymentId,gate,ctx); results.push(result); await ensureResult(deploymentId,gate,result);
    await addDeploymentEvent(deploymentId,'RELEASE_GATE',`${gate.name}: ${result.status} — ${result.message}`,{gate:gate.name,kind:gate.kind,required:gate.required});
  }
  const blocking=results.filter(r=>r.required && (r.status==='failed' || (r.status==='skipped' && r.kind.toLowerCase().replace(/[- ]/g,'_')!=='health' && r.kind.toLowerCase().replace(/[- ]/g,'_')!=='smoke')));
  if(blocking.length) throw new Error(`Required release gate failed: ${blocking.map(r=>r.name).join(', ')}`);
  return results;
}

export async function runPostReleaseGates(projectId:string,deploymentId:string,ctx:any) {
  const gates=await configs(projectId); const results:GateResult[]=[];
  for(const gate of gates) {
    const kind=gate.kind.toLowerCase().replace(/[- ]/g,'_');
    if(kind!=='health' && kind!=='smoke') continue;
    const result=await runOne(deploymentId,gate,ctx); results.push(result); await ensureResult(deploymentId,gate,result);
    await addDeploymentEvent(deploymentId,'RELEASE_GATE',`${gate.name}: ${result.status} — ${result.message}`,{gate:gate.name,kind:gate.kind,required:gate.required});
  }
  const blocking=results.filter(r=>r.required && r.status==='failed');
  if(blocking.length) throw new Error(`Required post-release gate failed: ${blocking.map(r=>r.name).join(', ')}`);
  return results;
}
