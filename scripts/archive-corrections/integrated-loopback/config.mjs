import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve, join, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ensure } from '../contract.mjs';
export const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const writeNew = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
export function loopbackOrigin(origin) {
  let url; try { url = new URL(origin); } catch { /* bounded error below */ }
  ensure(url?.protocol === 'http:' && url.hostname === '127.0.0.1' && url.origin === origin && url.port
    && !url.username && !url.password, 503, 'loopback_configuration_required', 'An exact explicit HTTP 127.0.0.1 origin and port are required.');
  return url;
}
export function loadConfig(path) {
  const file = resolve(path);
  const privateRoot = join(repository, '.archive-corrections-private') + sep;
  ensure(file.startsWith(privateRoot) && lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(),
    503, 'private_configuration_required', 'Explicit private D8 configuration required.');
  const value = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  ensure(value.version === 'd8-integrated-config/v1' && value.repository === repository
    && resolve(value.run_directory).startsWith(privateRoot) && /^d8-integrated-[a-f0-9-]{36}$/.test(value.run_directory.split(/[\\/]/).at(-1))
    && value.listen_host === '127.0.0.1' && Number.isInteger(value.listen_port) && value.listen_port > 1023 && value.listen_port <= 65535
    && value.simulation === true && value.identity_verified === false && value.human_validation_enabled === false,
    503, 'private_configuration_required', 'D8 must remain an invented-authority loopback preview.');
  loopbackOrigin(value.public_origin);
  for (const key of ['fixture_owner_passphrase', 'session_hmac_key', 'control_secret'])
    ensure(/^[a-f0-9]{64}$/.test(value[key]), 503, 'private_configuration_required', 'Private fresh random test secrets required.');
  const preflight = JSON.parse(readFileSync(join(value.run_directory, 'preflight.json'), 'utf8'));
  ensure(preflight.passed === true && preflight.database_already_started === false
    && sha(readFileSync(join(value.run_directory, 'input-manifest.json'))) === value.input_manifest_sha256,
    503, 'preflight_required', 'Pinned pre-operation D8 preflight required.');
  for (const pin of value.source_pins)
    ensure(sha(readFileSync(join(repository, pin.path))) === pin.sha256, 503, 'source_changed', 'A pinned source changed before opening D8.');
  for (const pin of JSON.parse(readFileSync(join(value.run_directory, 'engine-file-pins.json'), 'utf8')))
    ensure(sha(readFileSync(join(repository, pin.path))) === pin.sha256, 503, 'engine_changed', 'The existing embedded engine pin changed.');
  return value;
}
