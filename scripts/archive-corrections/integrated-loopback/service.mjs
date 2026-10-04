import { createServer, request } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, ensure } from '../contract.mjs';
import { loadConfig, writeNew, sha } from './config.mjs';
import { openIntegrated } from './app.mjs';

export async function startIntegrated(configFile, episode) {
  ensure(/^[a-z][a-z0-9-]{2,31}$/.test(episode), 422, 'episode_required', 'Use a new explicit episode name.');
  const app = await openIntegrated(configFile), value = app.config;
  const backend = `http://127.0.0.1:${value.listen_port}`;
  let closing = false;
  const server = createServer(async (req, res) => {
    if (req.url !== '/__d8_control__/stop') return app.handler(req, res);
    const actual = Buffer.from(req.headers['x-d8-control'] ?? ''), expected = Buffer.from(value.control_secret);
    const accepted = req.method === 'POST' && req.headers.host === new URL(backend).host
      && req.headers.origin === backend && ['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)
      && actual.length === expected.length && timingSafeEqual(actual, expected);
    res.writeHead(accepted ? 200 : 403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(canonical({ stopping: accepted, simulation: true, identity_verified: false }) + '\n');
    if (accepted) setImmediate(() => close().catch(() => { process.exitCode = 1; }));
  });
  async function close() {
    if (closing) return; closing = true;
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
    await app.close();
    writeNew(join(value.run_directory, 'service-stop-' + episode + '.json'), { episode, node_pid: process.pid,
      stopped_at: new Date().toISOString(), database_closed: true, lock_released: true, simulation: true });
    process.disconnect?.();
  }
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(value.listen_port, value.listen_host, resolve); });
    const ready = { ready: true, episode, node_pid: process.pid, started_at: new Date().toISOString(),
      backend, reader_origin: value.public_origin, listen_host: '127.0.0.1', engine: 'existing-persistent-PGlite-0.5.8',
      profiles: ['preview','fixture'], human_validation_enabled: false, simulation: true, identity_verified: false };
    writeNew(join(value.run_directory, 'service-start-' + episode + '.json'), ready);
    process.stdout.write(canonical(ready) + '\n'); process.send?.(ready);
    process.on('message', async message => {
      if (message?.action === 'stop') return close().catch(() => { process.exitCode = 1; });
      if (message?.action === 'export' && /^[a-z][a-z0-9-]{2,40}\.json$/.test(message.file ?? '')) {
        try {
          const snapshot = await app.exportEditorial(message.profile);
          writeNew(join(value.run_directory, message.file), snapshot);
          process.send?.({ exported: true, file: message.file, snapshot_sha256: snapshot.sha256,
            proposals: snapshot.proposals.length, decisions: snapshot.decisions.length, revisions: snapshot.revisions.length });
        } catch { process.send?.({ exported: false }); }
      }
    });
    process.once('SIGINT', () => { close().catch(() => { process.exitCode = 1; }); });
    process.once('SIGTERM', () => { close().catch(() => { process.exitCode = 1; }); });
    process.once('disconnect', () => { close().catch(() => { process.exitCode = 1; }); });
    return { ...ready, close };
  } catch (error) { await new Promise(resolve => server.close(resolve)); await app.close(); throw error; }
}
async function stopConfigured(configFile) {
  const value = loadConfig(configFile), backend = `http://127.0.0.1:${value.listen_port}`;
  await new Promise((resolve, reject) => {
    const req = request(backend + '/__d8_control__/stop', { method: 'POST', timeout: 10000,
      headers: { Origin: backend, 'X-D8-Control': value.control_secret } }, response => {
      response.resume(); response.on('end', () => response.statusCode === 200 ? resolve() : reject(new Error('Owned shutdown refused.')));
    });
    req.on('error', () => reject(new Error('Owned shutdown unavailable.')));
    req.on('timeout', () => req.destroy(new Error('Owned shutdown timeout.'))); req.end();
  });
  process.stdout.write(canonical({ stop_requested: true, simulation: true }) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, configFile, episode, ...extra] = process.argv.slice(2);
  Promise.resolve().then(() => {
    ensure(configFile && extra.length === 0 && ['serve','stop'].includes(command)
      && (command === 'serve' ? Boolean(episode) : !episode), 422, 'usage', 'Use serve CONFIG NEW-EPISODE or stop CONFIG.');
    return command === 'serve' ? startIntegrated(configFile, episode) : stopConfigured(configFile);
  }).catch(() => { process.stderr.write('D8 local service failed; inspect its private record without exposing secrets.\n'); process.exitCode = 1; });
}
