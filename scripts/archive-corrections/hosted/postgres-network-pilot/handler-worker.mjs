import { createServer } from 'node:http';
import { join } from 'node:path';
import { config, Pool, poolOptions, tracedDriver, twoTcpClients, writeNew } from './common.mjs';
import { ServerlessStore } from '../serverless/store.mjs';
import { SharedSessions } from '../serverless/sessions.mjs';
import { createHandler } from '../serverless/handler.mjs';

const [configFile, label] = process.argv.slice(2);
if (!['A', 'B'].includes(label)) throw new Error('Two declared fixture worker labels only.');
const value = config(configFile);
const pool = new Pool(poolOptions(value, value.main_database, label, true));
const events = [];
pool.on('error', () => {});
const driver = tracedDriver(pool, label, events);
const store = new ServerlessStore(driver, { schema: value.schema });
const sessions = new SharedSessions(store, value.hmac_key);
let server, closed = false;
async function stop() {
  if (closed) return;
  closed = true;
  if (server) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
  await driver.close();
  writeNew(join(value.run_directory, 'worker-' + label + '-transactions.json'), { label, node_pid: process.pid, simulation: true, events });
}
process.on('message', async message => {
  if (message?.action === 'stop') {
    try { await stop(); process.send?.({ stopped: true, label }); process.disconnect?.(); }
    catch { process.exitCode = 1; process.send?.({ stopped: false, label, error: 'fixture-worker-stop-failed' }); process.disconnect?.(); }
  }
});
process.on('disconnect', () => { stop().catch(() => { process.exitCode = 1; }); });
try {
  const clients = await twoTcpClients(pool);
  await store.initialize({ seed: false });
  server = createServer(createHandler({ store, sessions, origin: value.origin }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  process.send?.({ ready: true, label, node_pid: process.pid, port: server.address().port, postgres_clients: clients });
} catch (error) {
  process.send?.({ ready: false, label, error_code: typeof error.code === 'string' ? error.code : 'worker-start-failed' });
  try { await stop(); } catch { /* no secret diagnostic */ }
  process.disconnect?.(); process.exitCode = 1;
}
