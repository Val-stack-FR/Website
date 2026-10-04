import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { createHandler } from '../../../scripts/archive-corrections/hosted/serverless/handler.mjs';

const canonicalHost = 'header-fixture.example.test';
const origin = 'https://' + canonicalHost;

async function probe({ method = 'GET', headers, expected }) {
  let initialized = 0;
  const store = { context: { dataKind: 'synthetic' }, passage: { passage_id: 'synthetic-mvp-d-001' },
    initialize: async () => { initialized++; } };
  const server = createServer(createHandler({ store, sessions: {}, origin }));
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  let socket;
  try {
    const response = await new Promise((resolve, reject) => {
      socket = connect({ host: '127.0.0.1', port: server.address().port });
      const parts = [];
      socket.setTimeout(3000, () => socket.destroy(new Error('HTTP probe timeout')));
      socket.once('error', reject);
      socket.on('data', bytes => parts.push(bytes));
      socket.once('connect', () => socket.end(`${method} /api/archive/health HTTP/1.1\r\n${headers.join('\r\n')}\r\nConnection: close\r\n\r\n`));
      socket.once('close', hadError => { if (!hadError) resolve(Buffer.concat(parts).toString('utf8')); });
    });
    assert.match(response, new RegExp(`^HTTP/1\\.1 ${expected} `));
    if (expected === 400) {
      assert.match(response, /connection: close/i);
      assert.match(response, /"code":"ambiguous_headers"/);
      assert.equal(initialized, 0, 'Refused before database readiness or mutation');
    } else assert.equal(initialized, 1);
    assert.match(response, /"simulation":true/);
    assert.match(response, /"identity_verified":false/);
  } finally {
    socket?.destroy(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const transport = 'X-Forwarded-Proto: https';
test('canonical single Host remains accepted', () => probe({
  headers: [`Host: ${canonicalHost}`, transport], expected: 200,
}));

for (const [name, hosts] of [
  ['canonical first', [canonicalHost, 'foreign.example.test']],
  ['canonical last', ['foreign.example.test', canonicalHost]],
  ['same value twice', [canonicalHost, canonicalHost]],
]) {
  test(`duplicate Host refused: ${name}`, () => probe({
    headers: hosts.map(value => 'Host: ' + value).concat(transport), expected: 400,
  }));
}
test('case-insensitive duplicate Host refused', () => probe({
  headers: [`Host: ${canonicalHost}`, `hOsT: ${canonicalHost}`, transport], expected: 400,
}));
test('duplicate Origin refused even when both values are canonical', () => probe({
  headers: [`Host: ${canonicalHost}`, transport, `Origin: ${origin}`, `Origin: ${origin}`], expected: 400,
}));
test('duplicate transport headers refused before SQL', () => probe({
  headers: [`Host: ${canonicalHost}`, transport, transport], expected: 400,
}));
test('duplicate Host on POST refused before body or SQL', () => probe({
  method: 'POST', headers: [`Host: ${canonicalHost}`, `Host: ${canonicalHost}`, transport,
    `Origin: ${origin}`, 'Content-Type: application/json', 'Content-Length: 0'], expected: 400,
}));
