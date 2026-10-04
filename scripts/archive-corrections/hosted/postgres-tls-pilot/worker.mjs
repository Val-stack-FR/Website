import { createServer } from 'node:http';
import { join } from 'node:path';
import { config, strictDriver, tlsProof, observeTransactions, writeNew } from './common.mjs';
import { ServerlessStore } from '../serverless/store.mjs';
import { SharedSessions } from '../serverless/sessions.mjs';
import { createHandler } from '../serverless/handler.mjs';
const [file, label] = process.argv.slice(2);
if (!['A', 'B'].includes(label)) throw new Error('Declared new fixture worker required.');
const value = config(file), events = [];
observeTransactions(events, label);
const driver = strictDriver(value, value.main_database, true);
const store = new ServerlessStore(driver, { schema: value.schema });
const sessions = new SharedSessions(store, value.hmac_key);
let server, closed = false;
async function stop() {
  if (closed) return; closed = true;
  if (server) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
  await driver.close();
  writeNew(join(value.run_directory, 'worker-' + label + '-transactions.json'), { simulation: true, label, node_pid: process.pid, events });
}
process.on('message', async message => {
  if (message?.action === 'stop') {
    try { await stop(); process.disconnect?.(); }
    catch { process.exitCode = 1; process.disconnect?.(); }
  }
});
process.on('disconnect', () => { stop().catch(() => { process.exitCode = 1; }); });
try {
  const tls = await tlsProof(driver);
  if (!tls.ssl) throw new Error('TLS backend required.');
  await store.initialize({ seed: false });
  server = createServer(createHandler({ store, sessions, origin: value.origin }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  process.send?.({ ready: true, label, node_pid: process.pid, port: server.address().port, postgres_tls: tls });
} catch (error) {
  process.send?.({ ready: false, label, error_code: typeof error.code === 'string' ? error.code : 'worker-start-failed' });
  try { await stop(); } catch { /* no private diagnostics */ }
  process.disconnect?.(); process.exitCode = 1;
}
