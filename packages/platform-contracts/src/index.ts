export type DeploymentPhase = 'QUEUED' | 'CLONING' | 'DETECTING' | 'BUILDING' | 'TESTING' | 'SECURITY_SCAN' | 'PROVISIONING' | 'DEPLOYING' | 'HEALTH_CHECK' | 'TRAFFIC_SHIFT' | 'LIVE' | 'FAILED' | 'DIAGNOSING' | 'AUTO_RECOVERY' | 'ROLLING_BACK' | 'STOPPED';

export type DeploymentStrategy = 'rolling' | 'blue-green' | 'canary' | 'recreate';
export type ServiceKind = 'web' | 'worker' | 'cron' | 'private' | 'database' | 'cache';
export type ProviderKind = 'docker' | 'kubernetes' | 'aws' | 'gcp' | 'azure' | 'hetzner' | 'digitalocean' | 'cloudflare' | 'external';

export interface ResourcePolicy { cpuMillicores?: number; memoryMiB?: number; pids?: number; storageGiB?: number; }
export interface AutoscalingPolicy { min: number; max: number; cpuPercent?: number; memoryPercent?: number; requestsPerSecond?: number; queueDepth?: number; cooldownSeconds: number; }
export interface HealthPolicy { mode: 'http' | 'tcp' | 'process' | 'docker' | 'auto'; path?: string; port?: number; intervalSeconds: number; timeoutSeconds: number; failureThreshold: number; successThreshold: number; }
export interface DeploymentPolicy { strategy: DeploymentStrategy; health: HealthPolicy; autoscaling?: AutoscalingPolicy; rollbackOnFailure: boolean; canaryPercent?: number; }

export interface ApplicationNode { id: string; projectId: string; environmentId: string; serviceId: string; kind: ServiceKind; name: string; provider: ProviderKind; version?: string; status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'; }
export interface ApplicationEdge { id: string; from: string; to: string; protocol: 'http' | 'https' | 'tcp' | 'udp' | 'internal'; port?: number; }
export interface ApplicationGraph { nodes: ApplicationNode[]; edges: ApplicationEdge[]; }

export interface RecoveryPoint { id: string; projectId: string; environmentId: string; createdAt: string; gitRef?: string; imageRefs: string[]; configVersion: string; secretVersion?: string; databaseSnapshots: string[]; reason: 'deployment' | 'manual' | 'incident' | 'scheduled'; }
export interface CostUsage { cpuSeconds: number; memoryGiBSeconds: number; storageGiBHours: number; bandwidthGiB: number; buildMinutes: number; requestCount: number; }
export interface CostEstimate { currency: string; currentPeriodCents: number; projectedPeriodCents: number; recommendations: string[]; }

export interface ProviderCredentials { kind: ProviderKind; secretRef: string; region?: string; }
export interface DeploymentRequest { projectId: string; environmentId: string; serviceId: string; image?: string; git?: { repository: string; ref: string; rootDirectory?: string }; provider: ProviderCredentials; policy: DeploymentPolicy; resources: ResourcePolicy; envRefs?: string[]; }

export interface HostingProvider { readonly kind: ProviderKind; validate(request: DeploymentRequest): Promise<void>; deploy(request: DeploymentRequest): Promise<{ deploymentId: string; providerRef?: string }>; scale(serviceId: string, replicas: number): Promise<void>; rollback(deploymentId: string): Promise<void>; destroy(serviceId: string): Promise<void>; }

export interface PlatformEvent { id: string; type: string; projectId: string; environmentId?: string; serviceId?: string; deploymentId?: string; occurredAt: string; actor: string; metadata?: Record<string, unknown>; }
