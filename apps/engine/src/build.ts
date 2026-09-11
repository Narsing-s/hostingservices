import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const exec=promisify(execFile);

export type BuildRequest={repo:string;ref?:string;image:string};
export async function buildFromGit(request:BuildRequest){
  const dir=await mkdtemp(path.join(tmpdir(),'nexus-build-'));
  try{
    await exec('git',['clone','--depth','1',request.repo,dir],{timeout:120000});
    if(request.ref) await exec('git',['-C',dir,'fetch','origin',request.ref],{timeout:120000});
    await exec('docker',['build','-t',request.image,dir],{timeout:900000});
    return {image:request.image,repository:request.repo,workspace:dir};
  } finally { await rm(dir,{recursive:true,force:true}); }
}
