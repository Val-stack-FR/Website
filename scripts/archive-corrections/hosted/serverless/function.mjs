import { createHandler, validateOrigin } from './handler.mjs';
import { SharedSessions, KEY_ENV } from './sessions.mjs';
import { ServerlessStore } from './store.mjs';
import { createNetworkDriver } from './network.mjs';
import { ApiError, canonical } from '../../contract.mjs';

let cached;
export function configuredHandler(env = process.env) {
  const origin = env.ARCHIVE_CORRECTIONS_PUBLIC_ORIGIN;
  validateOrigin(origin);
  // Validate schema/key before opening a network pool. No FS credential fallback, no auto-enroll/migrate.
  const store = new ServerlessStore(undefined, { schema: env.ARCHIVE_CORRECTIONS_SCHEMA });
  const sessions = new SharedSessions(store, env[KEY_ENV]);
  store.driver = createNetworkDriver(env.ARCHIVE_CORRECTIONS_DATABASE_URL);
  return createHandler({ store, sessions, origin });
}

export default async function handler(request, response) {
  try { cached ??= configuredHandler(); return await cached(request, response); }
  catch (error) {
    const known = error instanceof ApiError;
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(canonical({ api_version: 'archive-corrections/serverless-v1', data_kind: 'synthetic', simulation: true, identity_verified: false,
      error: { code: known ? error.code : 'configuration_unavailable', message: known ? error.message : 'The serverless pilot is not configured.' } }) + '\n');
  }
}
