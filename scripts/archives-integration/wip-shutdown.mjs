// Snapshot failure must not strand a running listener, store or local lock.
export async function settleWipShutdown({ captureSnapshots, closeServer, closeStores, releaseLocks }) {
  let snapshots = null, snapshotFailed = false;
  try { snapshots = await captureSnapshots(); } catch { snapshotFailed = true; }
  const results = await Promise.allSettled([closeServer(), closeStores()]);
  const resourcesClosed = results.every(result => result.status === 'fulfilled');
  let locksReleased = false;
  if (resourcesClosed) { try { await releaseLocks(); locksReleased = true; } catch {} }
  return { snapshots, snapshot_failed: snapshotFailed, resources_closed: resourcesClosed, locks_released: locksReleased, clean_shutdown: !snapshotFailed && resourcesClosed && locksReleased };
}
