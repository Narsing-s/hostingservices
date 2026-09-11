ALTER TYPE "DeploymentStatus" ADD VALUE IF NOT EXISTS 'ROLLING_BACK';
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "previousDeploymentId" TEXT;
CREATE INDEX IF NOT EXISTS "Deployment_serviceId_createdAt_idx" ON "Deployment"("serviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "DeploymentLog_deploymentId_createdAt_idx" ON "DeploymentLog"("deploymentId", "createdAt");
