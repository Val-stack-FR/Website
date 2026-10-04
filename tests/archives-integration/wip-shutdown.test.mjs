import test from 'node:test';
import assert from 'node:assert/strict';
import { settleWipShutdown } from '../../scripts/archives-integration/wip-shutdown.mjs';
test('snapshot failure still closes both resource groups and releases locks', async () => {
  const calls = [];
  const result = await settleWipShutdown({ captureSnapshots: async () => { throw Error('unavailable'); }, closeServer: async () => calls.push('server'), closeStores: async () => calls.push('stores'), releaseLocks: async () => calls.push('locks') });
  assert.deepEqual(calls.sort(), ['locks', 'server', 'stores']);
  assert.equal(result.snapshot_failed, true); assert.equal(result.resources_closed, true); assert.equal(result.locks_released, true); assert.equal(result.clean_shutdown, false);
});
test('a store close failure preserves locks while still closing the listener', async () => {
  let serverClosed = false, released = false;
  const result = await settleWipShutdown({ captureSnapshots: async () => ({ preserved: true }), closeServer: async () => { serverClosed = true; }, closeStores: async () => { throw Error('close failed'); }, releaseLocks: async () => { released = true; } });
  assert.equal(serverClosed, true); assert.equal(released, false); assert.equal(result.resources_closed, false); assert.equal(result.clean_shutdown, false);
});
