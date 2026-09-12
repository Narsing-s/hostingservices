const INSECURE_DEFAULTS = new Set([
  'change-this-secret-in-production',
  'local-auth-secret-change-before-production',
  'local-engine-internal-secret',
  'local-engine-callback-secret',
]);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in production`);
  if (INSECURE_DEFAULTS.has(value)) throw new Error(`${name} is using an insecure development default`);
  return value;
}

function assertPublicUrl(name: string): string {
  const value = required(name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production`);
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsed.hostname)) {
    throw new Error(`${name} cannot point to localhost in production`);
  }
  return value;
}

export function assertProductionConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') return;

  required('DATABASE_URL');
  required('AUTH_SECRET');
  required('ENGINE_INTERNAL_SECRET');
  required('ENGINE_CALLBACK_SECRET');
  required('SECRETS_ENCRYPTION_KEY');
  assertPublicUrl('WEB_URL');
  assertPublicUrl('PUBLIC_API_URL');

  const engineUrl = required('ENGINE_URL');
  if (!/^https?:\/\//i.test(engineUrl)) {
    throw new Error('ENGINE_URL must be an absolute HTTP(S) URL in production');
  }

  if (process.env.GITHUB_CLIENT_ID && !process.env.GITHUB_CLIENT_SECRET) {
    throw new Error('GITHUB_CLIENT_SECRET is required when GITHUB_CLIENT_ID is configured');
  }
  if (process.env.GITHUB_CLIENT_SECRET && !process.env.GITHUB_CLIENT_ID) {
    throw new Error('GITHUB_CLIENT_ID is required when GITHUB_CLIENT_SECRET is configured');
  }
  if (process.env.GITHUB_WEBHOOK_SECRET && process.env.GITHUB_WEBHOOK_SECRET.length < 32) {
    throw new Error('GITHUB_WEBHOOK_SECRET must be at least 32 characters in production');
  }
}
