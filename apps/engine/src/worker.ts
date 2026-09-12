import { createDeploymentWorker, enqueueDeployment, findDeploymentJob, type DeploymentJob } from './redis-queue.js';
import { deployRuntime, rollbackRuntime } from './deploy.js';
import { deployReplicas } from './replicas.js';
import { startNodeAgent } from './node-agent.js';

const callbackUrl=process.env.ENGINE_CALLBACK_URL??'http://127.0.0.1:4000';
const callbackSecret=process.env.ENGINE_CALLBACK_SECRET??'';
const nodeName=process.env.NODE_NAME??'local';

async function reportStatus(deploymentId:string|undefined,status:'starting'|'ready'|'failed'|'rolling_back',runtime?:unknown){if(!deploymentId)return;try{const response=await fetch(`${callbackUrl}/api/internal/deployments/${encodeURIComponent(deploymentId)}/status`,{method:'POST',headers:{'content-type':'application/json',...(callbackSecret?{'x-engine-secret':callbackSecret}:{})},body:JSON.stringify({status,runtime})});if(!response.ok)console.error(`[deployment] lifecycle callback failed: ${response.status}`);}catch(error){console.error(`[deployment] lifecycle callback error: ${error instanceof Error?error.message:String(error)}`);}}

async function reportPhase(deploymentId:string|undefined,phase:string,job:{id?:string;attemptsMade:number;data:any},extra:Record<string,unknown>={}){if(!deploymentId)return;try{const response=await fetch(`${callbackUrl}/api/internal/deployments/${encodeURIComponent(deploymentId)}/state`,{method:'POST',headers:{'content-type':'application/json',...(callbackSecret?{'x-engine-secret':callbackSecret}:{})},body:JSON.stringify({phase,attempt:job.attemptsMade,strategy:job.data.strategy??'rolling',generationId:job.data.generationId,desiredGenerationId:job.data.generationId,metadata:{nodeName,jobId:job.id??undefined,...extra}})});if(!response.ok)console.error(`[deployment] durable state callback failed: ${response.status}`);}catch(error){console.error(`[deployment] durable state callback error: ${error instanceof Error?error.message:String(error)}`);}}

function runtimeSpecFromJob(job: {data: DeploymentJob;}){return {name:job.data.name,image:job.data.image,containerPort:job.data.containerPort,hostPort:job.data.hostPort,env:job.data.env,command:job.data.command,healthMode:job.data.healthMode,public:job.data.public,healthPath:job.data.healthPath,domain:job.data.domain,autoscale:job.data.autoscale,cpuNanoCpus:job.data.cpuNanoCpus,memoryBytes:job.data.memoryBytes,pidsLimit:job.data.pidsLimit,volumeBinds:job.data.volumeBinds,deploymentId:job.data.deploymentId,generationId:job.data.generationId,strategy:job.data.strategy,canarySteps:job.data.canarySteps,replicas:job.data.replicas,zeroDowntime:job.data.zeroDowntime,rollbackOnFailure:job.data.rollbackOnFailure,nodeName:job.data.nodeName};}

createDeploymentWorker(async(job)=>{
  const {deploymentId}=job.data;
  const rollback=job.data.operation==='rollback';
  const runtimeSpec=runtimeSpecFromJob(job);
  await reportStatus(deploymentId,rollback?'rolling_back':'starting');
  await reportPhase(deploymentId,rollback?'ROLLING_BACK':'DEPLOYING',job,{deploymentSpec:runtimeSpec,operation:job.data.operation});
  try{
    let runtime:any;
    if(rollback){if(!job.data.previousImage)throw new Error('previousImage is required for rollback');runtime=await rollbackRuntime({...runtimeSpec,previousImage:job.data.previousImage});}
    else if((job.data.replicas??1)>1||job.data.autoscale||job.data.strategy){await reportPhase(deploymentId,'HEALTH_CHECK',job,{deploymentSpec:runtimeSpec});runtime=await deployReplicas({...runtimeSpec,replicas:job.data.replicas??job.data.autoscale?.min??1,zeroDowntime:job.data.zeroDowntime,rollbackOnFailure:job.data.rollbackOnFailure});}
    else{await reportPhase(deploymentId,'HEALTH_CHECK',job,{deploymentSpec:runtimeSpec});runtime=await deployRuntime(runtimeSpec);}
    await reportPhase(deploymentId,'TRAFFIC_SHIFT',job,{runtime});
    await reportPhase(deploymentId,'LIVE',job,{runtime,finished:true});
    await reportStatus(deploymentId,'ready',runtime);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await reportPhase(deploymentId,rollback?'FAILED':'DIAGNOSING',job,{error:message});
    const finalAttempt=job.attemptsMade+1>=(job.opts.attempts??1);
    if(finalAttempt){await reportPhase(deploymentId,'FAILED',job,{error:message,finished:true});await reportStatus(deploymentId,'failed',{error:message});}
    throw error;
  }
});

async function recoverLostJobs(){
  if(process.env.DEPLOYMENT_RECOVERY_ENABLED==='false')return;
  try{
    const response=await fetch(`${callbackUrl}/api/internal/deployments/recoverable`,{headers:{...(callbackSecret?{'x-engine-secret':callbackSecret}:{})},signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error(`recovery API returned ${response.status}`);
    const payload=await response.json() as {deployments?:any[]};
    for(const deployment of payload.deployments??[]){
      const spec=deployment.metadata?.deploymentSpec;
      if(!deployment.id||!spec||String(spec.nodeName??nodeName)!==nodeName)continue;
      if(['LIVE','FAILED','STOPPED'].includes(String(deployment.phase)))continue;
      const existing=await findDeploymentJob(String(deployment.id),nodeName);
      if(existing)continue;
      const job:DeploymentJob={operation:deployment.metadata?.operation==='rollback'?'rollback':'deploy',...spec,deploymentId:String(deployment.id),nodeName};
      const recovered=await enqueueDeployment(job,`recovery:${deployment.id}`);
      console.log(`[deployment:${nodeName}] recovered ${deployment.id} as job ${recovered.id}`);
    }
  }catch(error){console.error(`[deployment:${nodeName}] recovery scan failed: ${error instanceof Error?error.message:String(error)}`);}
}

void startNodeAgent();
void recoverLostJobs();
setInterval(() => { void recoverLostJobs(); }, Number(process.env.DEPLOYMENT_RECOVERY_INTERVAL_MS??30000)).unref();
console.log(`Nexus deployment worker started on node ${nodeName}`);
