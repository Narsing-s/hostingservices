export type BuildSandboxPolicy = {
  network: string;
  memory: string;
  cpus: string;
  pids: string;
  timeoutMs: number;
  noNewPrivileges: boolean;
  capDropAll: boolean;
};

function positiveNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function buildSandboxPolicy(): BuildSandboxPolicy {
  const production = process.env.NODE_ENV === 'production';
  const configuredNetwork = process.env.BUILD_NETWORK ?? (production ? 'bridge' : 'bridge');
  const network = configuredNetwork === 'host' ? 'bridge' : configuredNetwork;
  return {
    network,
    memory: process.env.BUILD_MEMORY ?? '2g',
    cpus: String(positiveNumber(process.env.BUILD_CPUS, 2, 0.25, 32)),
    pids: String(Math.floor(positiveNumber(process.env.BUILD_PIDS, 512, 64, 4096))),
    timeoutMs: Math.floor(positiveNumber(process.env.BUILD_TIMEOUT_MS, 900000, 30000, 3600000)),
    noNewPrivileges: true,
    capDropAll: true,
  };
}

export function dockerBuildArgs(policy: BuildSandboxPolicy, dockerfile: string, tag: string, context: string) {
  return [
    'build', '--pull', '--network', policy.network,
    '--memory', policy.memory, '--cpus', policy.cpus, '--pids-limit', policy.pids,
    '--security-opt', 'no-new-privileges', '--cap-drop', 'ALL',
    '-f', dockerfile, '-t', tag, context,
  ];
}
