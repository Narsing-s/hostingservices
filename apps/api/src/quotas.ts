import pg from 'pg';
import { ensureMarketSchema } from './market-schema.js';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL??'postgres://nexus:nexus_dev_only@127.0.0.1:5432/nexus'});

export async function ensureQuotaSchema(){await pool.query(`CREATE TABLE IF NOT EXISTS organization_quotas(organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,max_services integer NOT NULL DEFAULT 25,max_projects integer NOT NULL DEFAULT 10,max_runtime_cpu_millis integer NOT NULL DEFAULT 4000,max_runtime_memory_bytes bigint NOT NULL DEFAULT 4294967296,max_storage_bytes bigint NOT NULL DEFAULT 107374182400,max_members integer NOT NULL DEFAULT 10,updated_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION enforce_deployment_resource_quota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org_id uuid; quota record; requested_cpu bigint; requested_memory bigint; used_cpu bigint; used_memory bigint;
BEGIN
  SELECT organization_id INTO org_id FROM projects WHERE id=NEW.project_id;
  IF org_id IS NULL THEN
    IF current_setting('app.environment',true)='production' THEN RAISE EXCEPTION 'Project is not attached to an organization'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.runtime IS NULL OR NEW.status IN ('failed','rolled_back') THEN RETURN NEW; END IF;
  SELECT * INTO quota FROM organization_quotas WHERE organization_id=org_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO organization_quotas(organization_id) VALUES(org_id) ON CONFLICT DO NOTHING;
    SELECT * INTO quota FROM organization_quotas WHERE organization_id=org_id FOR UPDATE;
  END IF;
  requested_cpu:=GREATEST(0,COALESCE((NEW.runtime->>'cpuNanoCpus')::bigint,0)/1000000);
  requested_memory:=GREATEST(0,COALESCE((NEW.runtime->>'memoryBytes')::bigint,0));
  SELECT COALESCE(SUM(GREATEST(0,COALESCE((d.runtime->>'cpuNanoCpus')::bigint,0)/1000000)),0),COALESCE(SUM(GREATEST(0,COALESCE((d.runtime->>'memoryBytes')::bigint,0))),0)
    INTO used_cpu,used_memory
    FROM deployments d JOIN projects p ON p.id=d.project_id
   WHERE p.organization_id=org_id AND d.id<>NEW.id AND d.status NOT IN ('failed','rolled_back') AND d.runtime IS NOT NULL;
  IF requested_cpu<0 OR requested_memory<0 THEN RAISE EXCEPTION 'Invalid deployment resources'; END IF;
  IF used_cpu+requested_cpu>quota.max_runtime_cpu_millis THEN RAISE EXCEPTION 'CPU quota exceeded (% millicores)',quota.max_runtime_cpu_millis; END IF;
  IF used_memory+requested_memory>quota.max_runtime_memory_bytes THEN RAISE EXCEPTION 'Memory quota exceeded (% bytes)',quota.max_runtime_memory_bytes; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS deployments_resource_quota_guard ON deployments;
CREATE TRIGGER deployments_resource_quota_guard BEFORE INSERT OR UPDATE OF runtime,status,project_id ON deployments FOR EACH ROW EXECUTE FUNCTION enforce_deployment_resource_quota();`);await ensureMarketSchema()}
export async function ensureDefaultQuota(orgId:string){await pool.query(`INSERT INTO organization_quotas(organization_id) VALUES($1) ON CONFLICT DO NOTHING`,[orgId])}
export async function quotaFor(orgId:string){await ensureDefaultQuota(orgId);const {rows}=await pool.query(`SELECT * FROM organization_quotas WHERE organization_id=$1`,[orgId]);return rows[0]}
export async function organizationIdForProject(projectId:string){const {rows}=await pool.query(`SELECT organization_id AS "organizationId" FROM projects WHERE id=$1`,[projectId]);return rows[0]?.organizationId as string|undefined}
export async function assertServiceQuota(orgId:string){const q=await quotaFor(orgId);const {rows}=await pool.query(`SELECT COUNT(*)::int AS count FROM services s JOIN environments e ON e.id=s.environment_id JOIN projects p ON p.id=e.project_id WHERE p.organization_id=$1`,[orgId]);if(rows[0].count>=q.max_services)throw new Error(`Service quota exceeded (${q.max_services})`)}
export async function assertProjectQuota(orgId:string){const q=await quotaFor(orgId);const {rows}=await pool.query(`SELECT COUNT(*)::int AS count FROM projects WHERE organization_id=$1`,[orgId]);if(rows[0].count>=q.max_projects)throw new Error(`Project quota exceeded (${q.max_projects})`)}
export async function assertDeploymentResources(orgId:string,cpuMillis:number,memoryBytes:number,storageBytes=0){const q=await quotaFor(orgId);if(cpuMillis<=0||memoryBytes<=0||storageBytes<0)throw new Error('Invalid resource request');const usage=await pool.query(`SELECT COALESCE(SUM(COALESCE((d.runtime->>'cpuNanoCpus')::bigint,0)/1000000),0)::bigint AS cpu,COALESCE(SUM(COALESCE((d.runtime->>'memoryBytes')::bigint,0)),0)::bigint AS memory FROM deployments d JOIN projects p ON p.id=d.project_id WHERE p.organization_id=$1 AND d.status NOT IN ('failed','rolled_back')`,[orgId]);const storage=await pool.query(`SELECT COALESCE(SUM(v.size_bytes),0)::bigint AS bytes FROM volumes v JOIN services s ON s.id=v.service_id JOIN environments e ON e.id=s.environment_id JOIN projects p ON p.id=e.project_id WHERE p.organization_id=$1`,[orgId]);if(Number(usage.rows[0].cpu)+cpuMillis>q.max_runtime_cpu_millis)throw new Error(`CPU quota exceeded (${q.max_runtime_cpu_millis} millicores)`);if(Number(usage.rows[0].memory)+memoryBytes>Number(q.max_runtime_memory_bytes))throw new Error(`Memory quota exceeded (${q.max_runtime_memory_bytes} bytes)`);if(Number(storage.rows[0].bytes)+storageBytes>Number(q.max_storage_bytes))throw new Error(`Storage quota exceeded (${q.max_storage_bytes} bytes)`)}
export async function assertProjectDeploymentResources(projectId:string,cpuMillis:number,memoryBytes:number,storageBytes=0){const orgId=await organizationIdForProject(projectId);if(!orgId){if(process.env.NODE_ENV==='production')throw new Error('Project is not attached to an organization');return}await assertDeploymentResources(orgId,cpuMillis,memoryBytes,storageBytes)}
export async function recordUsage(orgId:string,metric:string,quantity:number,unit:string,projectId?:string,serviceId?:string){if(quantity<0)throw new Error('quantity must be non-negative');await pool.query(`INSERT INTO usage_events(id,organization_id,project_id,service_id,metric,quantity,unit) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6)`,[orgId,projectId??null,serviceId??null,metric,quantity,unit])}
