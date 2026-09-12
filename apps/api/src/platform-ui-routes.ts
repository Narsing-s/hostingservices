import type { FastifyInstance } from 'fastify';

/**
 * Compatibility registration retained for older imports.
 * Platform control-plane routes now live in platform-routes.ts and
 * platform-advanced-routes.ts so each Fastify route has one owner.
 */
export async function registerPlatformUiRoutes(_app: FastifyInstance) {
  return;
}
