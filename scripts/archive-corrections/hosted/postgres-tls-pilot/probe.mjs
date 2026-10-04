import assert from 'node:assert/strict';
import { join } from 'node:path';
import { config, strictDriver, tlsProof, writeNew } from './common.mjs';
const [file, mode] = process.argv.slice(2);
if (!['correct-ca', 'wrong-ca', 'wrong-name', 'correct-ca-restored'].includes(mode)) throw new Error('Declared TLS probe required.');
const value = config(file);
const driver = strictDriver(value, 'postgres');
let result;
try {
  const proof = await tlsProof(driver);
  assert.ok(mode.startsWith('correct-ca'), 'Negative TLS case unexpectedly accepted.');
  assert.equal(proof.ssl, true); assert.match(proof.tls_version, /^TLSv1\.[23]$/);
  assert.equal(proof.server_address, '127.0.0.1'); assert.equal(proof.client_address, '127.0.0.1');
  assert.equal(proof.server_port, value.port); assert.equal(proof.in_transaction, true);
  result = { mode, passed: true, connection_accepted: true, postgres_tls: proof };
} catch (error) {
  const code = typeof error.code === 'string' ? error.code : 'probe-assertion-failed';
  const expected = mode === 'wrong-ca'
    ? ['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(code)
    : mode === 'wrong-name' && code === 'ERR_TLS_CERT_ALTNAME_INVALID';
  result = { mode, passed: expected, connection_accepted: false, refusal_code: code };
} finally { await driver.close(); }
writeNew(join(value.run_directory, 'probe-' + mode + '.json'), { version: 'd7-tls-probe/v1', simulation: true,
  identity_verified: false, driver: 'unchanged-D5-createNetworkDriver-default-factory', ...result });
if (!result.passed) process.exitCode = 1;
