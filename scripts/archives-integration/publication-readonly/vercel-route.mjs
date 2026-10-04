import { createReadonlyHandler } from './handler.mjs';

/** Bind prevalidated data once at application startup, then export the returned handler from a Vercel API route. */
export function createVercelRoute(data) {
  return createReadonlyHandler(data).handler;
}
