import { createDeploymentWorker } from './redis-queue.js';
import { deployRuntime, rollbackRuntime } from './deploy.js';
import { deployReplicas } from './replicas.js';
import { startNodeAgent } from './node-agent.js';

const callbackUrl=process.env.ENGINE_CALLBACK_URL??'http://127.0.0.1:4000';
const callbackSecret=process.env.ENGINE_CALLBACK_SECRET??'';

async function reportStatus(deploymentId:string|undefined,status:'starting'|'ready'|'failed'|'rolling_back',runtime?:unknown){if(!deploymentId)return;try{const response=await fetch(`${callbackUrl}/api/v1/deployments/${encodeURIComponent(deploymentId)}/status`,{method:'POST',headers:{'content-type':'application/json',...(callbackSecret?{'x-engine-secret':callbackSecret}:{})},body:JSON.stringify({status,runtime})});if(!response.ok)console.error(`[deployment] lifecycle callback failed: ${response.status}`);}catch(error){console.error(`[deployment] lifecycle callback error: ${error instanceof Error?error.message:String(error)}`);}}

async function reportPhase(deploymentId:string|undefined,phase:string,job:{attemptsMade:number;data:any},extra:Record<string,unknown>={}){if(!deploymentId)return;try{const response=await fetch(`${callbackUrl}/api/internal/deployments/${encodeURIComponent(deploymentId)}/state`,{method:'POST',headers:{'content-type':'application/json',...(callbackSecret?{'x-engine-secret':callbackSecret}:{})},body:JSON.stringify({phase,attempt:job.attemptsMade,strategy:job.data.strategy??'rolling',generationId:job.data.generationId,desiredGenerationId:job.data.generationId,metadata:{nodeName:process.env.NODE_NAME??'local',jobId:job.data.id??undefined,...extra}})});if(!response.ok)console.error(`[deployment] durable state callback failed: ${response.status}`);}catch(error){console.error(`[deployment] durable state callback error: ${error instanceof Error?error.message:String(error)}`);}}

createDeploymentWorker(async(job)=>{
  const {deploymentId}=job.data;
  const rollback=job.data.operation==='rollback';
  await reportStatus(deploymentId,rollback?'rolling_back':'starting');
  await reportPhase(deploymentId,rollback?'ROLLING_BACK':'DEPLOYING',job);
  try{
    const runtimeSpec={name:job.data.name,image:job.data.image,containerPort:job.data.containerPort,hostPort:job.data.hostPort,env:job.data.env,command:job.data.command,healthMode:job.data.healthMode,public:job.data.public,healthPath:job.data.healthPath,domain:job.data.domain,autoscale:job.data.autoscale,cpuNanoCpus:job.data.cpuNanoCpus,memoryBytes:job.data.memoryBytes,pidsLimit:job.data.pidsLimit,volumeBinds:job.data.volumeBinds,deploymentId,generationId:job.data.generationId,strategy:job.data.strategy,canarySteps:job.data.canarySteps};
    let runtime:any;
    if(rollback){if(!job.data.previousImage)throw new Error('previousImage is required for rollback');runtime=await rollbackRuntime({...runtimeSpec,previousImage:job.data.previousImage});}
    else if((job.data.replicas??1)>1||job.data.autoscale||job.data.strategy){await reportPhase(deploymentId,'HEALTH_CHECK',job);runtime=await deployReplicas({...runtimeSpec,replicas:job.data.replicas??job.data.autoscale?.min??1,zeroDowntime:job.data.zeroDowntime,rollbackOnFailure:job.data.rollbackOnFailure});}
    else{await reportPhase(deploymentId,'HEALTH_CHECK',job);runtime=await deployRuntime(runtimeSpec);}
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

void startNodeAgent();
console.log(`Nexus deployment worker started on node ${process.env.NODE_NAME??'local'}`);
