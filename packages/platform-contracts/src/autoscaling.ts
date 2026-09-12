export type AutoscalingMetrics = { cpuPercent?: number; memoryPercent?: number; requestsPerSecond?: number; queueDepth?: number };
export type AutoscalingDecision = { action: 'scale-out' | 'scale-in' | 'hold'; targetReplicas: number; reason: string };

export function decideAutoscaling(currentReplicas: number, policy: { min: number; max: number; cpuPercent?: number; memoryPercent?: number; requestsPerSecond?: number; queueDepth?: number }, metrics: AutoscalingMetrics): AutoscalingDecision {
  const reasons: string[] = [];
  if (policy.cpuPercent !== undefined && (metrics.cpuPercent ?? 0) >= policy.cpuPercent) reasons.push(`CPU ${metrics.cpuPercent}% >= ${policy.cpuPercent}%`);
  if (policy.memoryPercent !== undefined && (metrics.memoryPercent ?? 0) >= policy.memoryPercent) reasons.push(`memory ${metrics.memoryPercent}% >= ${policy.memoryPercent}%`);
  if (policy.requestsPerSecond !== undefined && (metrics.requestsPerSecond ?? 0) >= policy.requestsPerSecond) reasons.push(`RPS ${metrics.requestsPerSecond} >= ${policy.requestsPerSecond}`);
  if (policy.queueDepth !== undefined && (metrics.queueDepth ?? 0) >= policy.queueDepth) reasons.push(`queue ${metrics.queueDepth} >= ${policy.queueDepth}`);
  if (reasons.length && currentReplicas < policy.max) return { action: 'scale-out', targetReplicas: currentReplicas + 1, reason: reasons.join('; ') };
  const belowAll = [policy.cpuPercent === undefined || (metrics.cpuPercent ?? 0) < policy.cpuPercent * 0.5, policy.memoryPercent === undefined || (metrics.memoryPercent ?? 0) < policy.memoryPercent * 0.5, policy.requestsPerSecond === undefined || (metrics.requestsPerSecond ?? 0) < policy.requestsPerSecond * 0.5, policy.queueDepth === undefined || (metrics.queueDepth ?? 0) < policy.queueDepth * 0.5].every(Boolean);
  if (belowAll && currentReplicas > policy.min) return { action: 'scale-in', targetReplicas: currentReplicas - 1, reason: 'All configured utilization signals are below 50% of their targets' };
  return { action: 'hold', targetReplicas: currentReplicas, reason: 'No scaling threshold crossed' };
}
