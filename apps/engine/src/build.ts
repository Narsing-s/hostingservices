import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);

export type BuildRequest = { repo: string; ref?: string; image: string };

export async function buildFromGit(request: BuildRequest) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexus-build-'));
  try {
    const cloneArgs = ['clone', '--depth', '1'];
    if (request.ref) cloneArgs.push('--branch', request.ref);
    cloneArgs.push(request.repo, dir);

    await exec('git', cloneArgs, { timeout: 120000 });
    await exec('docker', ['build', '-t', request.image, dir], { timeout: 900000 });

    return {
      image: request.image,
      repository: request.repo,
      ref: request.ref ?? 'default',
      status: 'built'
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
