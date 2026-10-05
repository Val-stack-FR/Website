import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { promisify } from 'node:util';
import { storePaths } from './runtime.mjs';
import { ensure, exactFields, canonical } from './contract.mjs';

export const PASSPHRASE_ENV = 'ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE';
export const COOKIE_NAME = 'archive_owner_session';
const credentialVersion = 'archive-owner-local/v1';
const derive = promisify(scrypt);
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const hash = text => createHash('sha256').update(text).digest('hex');
const randomToken = () => randomBytes(32).toString('hex');

export function validatePassphrase(passphrase) {
  ensure(typeof passphrase === 'string' && passphrase.length >= 20 && passphrase.length <= 256
    && passphrase.trim() === passphrase && !/[\u0000-\u001f\u007f-\u009f]/u.test(passphrase),
  422, 'invalid_passphrase', 'Use a private passphrase of 20–256 characters without controls or outer whitespace.');
}

function readCredential(name, root) {
  const paths = storePaths(name, false, root);
  ensure(existsSync(paths.credential), 503, 'owner_not_enrolled', 'Enroll the local owner credential offline before starting this service.');
  const raw = readFileSync(paths.credential, 'utf8');
  ensure(Buffer.byteLength(raw) <= 4096, 503, 'invalid_credential', 'The local credential file is invalid.');
  let credential;
  try { credential = JSON.parse(raw); } catch { ensure(false, 503, 'invalid_credential', 'The local credential file is invalid.'); }
  exactFields(credential, ['version', 'generation', 'algorithm', 'salt', 'verifier']);
  ensure(credential.version === credentialVersion && credential.algorithm === 'scrypt-N32768-r8-p1'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(credential.generation)
    && /^[0-9a-f]{32}$/.test(credential.salt) && /^[0-9a-f]{64}$/.test(credential.verifier),
  503, 'invalid_credential', 'The local credential file is invalid.');
  return credential;
}

// Explicit offline enrollment; no password, session or identity is exported with corrections.
export async function enrollOwner(name, passphrase, { rotate = false, credentialRoot } = {}) {
  validatePassphrase(passphrase); // Fail before runtime directory creation.
  const before = storePaths(name, false, credentialRoot);
  ensure(rotate ? existsSync(before.credential) : !existsSync(before.credential), 409,
    rotate ? 'owner_not_enrolled' : 'owner_already_enrolled',
    rotate ? 'Rotation requires an existing local credential.' : 'A credential already exists; use explicit offline rotation.');
  if (rotate) readCredential(name, credentialRoot);
  const salt = randomBytes(16).toString('hex');
  const verifier = (await derive(passphrase, Buffer.from(salt, 'hex'), 32, parameters)).toString('hex');
  const credential = { version: credentialVersion, generation: randomUUID(), algorithm: 'scrypt-N32768-r8-p1', salt, verifier };
  const paths = storePaths(name, true, credentialRoot);
  if (!rotate) writeFileSync(paths.credential, `${canonical(credential)}\n`, { flag: 'wx', mode: 0o600, flush: true });
  else {
    const temporary = `${paths.credential}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, `${canonical(credential)}\n`, { flag: 'wx', mode: 0o600, flush: true });
      renameSync(temporary, paths.credential);
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }
  return { credential_version: credentialVersion, enrolled: true, rotated: rotate, identity_verified: false };
}

export class OwnerSessions {
  constructor(name, { now = () => Date.now(), idleMs = 30 * 60 * 1000, absoluteMs = 8 * 60 * 60 * 1000,
    loginWindowMs = 60 * 1000, loginLimit = 5, credentialRoot, secure = false } = {}) {
    this.name = name;
    this.now = now;
    this.idleMs = idleMs;
    this.absoluteMs = absoluteMs;
    this.loginWindowMs = loginWindowMs;
    this.loginLimit = loginLimit;
    this.credentialRoot = credentialRoot;
    this.secure = secure;
    this.cookieName = secure ? `__Host-${COOKIE_NAME}` : COOKIE_NAME;
    this.sessions = new Map();
    this.attempts = [];
    this.credential = readCredential(name, credentialRoot);
  }

  refreshCredential() {
    const next = readCredential(this.name, this.credentialRoot);
    if (canonical(next) !== canonical(this.credential)) {
      this.sessions.clear();
      this.credential = next;
    }
    return next;
  }

  async login(payload) {
    exactFields(payload, ['passphrase']);
    validatePassphrase(payload.passphrase);
    const now = this.now();
    this.attempts = this.attempts.filter(time => time > now - this.loginWindowMs);
    ensure(this.attempts.length < this.loginLimit, 429, 'login_throttled', 'Wait before trying the local credential again.');
    this.attempts.push(now); // Reserve attempts before async derivation, including concurrent requests.
    const credential = this.refreshCredential();
    const actual = await derive(payload.passphrase, Buffer.from(credential.salt, 'hex'), 32, parameters);
    ensure(timingSafeEqual(actual, Buffer.from(credential.verifier, 'hex')),
      403, 'invalid_credential', 'The local owner credential was refused.');
    // Rotation during derivation cannot grant a session against the old verifier.
    ensure(canonical(this.refreshCredential()) === canonical(credential), 403, 'invalid_credential', 'The local credential changed; sign in again.');
    this.prune();
    if (this.sessions.size >= 8) this.sessions.delete(this.sessions.keys().next().value);
    const token = randomToken();
    const session = { csrf: randomToken(), created: this.now(), touched: this.now() };
    this.sessions.set(hash(token), session);
    return { token, session };
  }

  prune() {
    const now = this.now();
    for (const [key, session] of this.sessions) {
      if (now - session.touched >= this.idleMs || now - session.created >= this.absoluteMs) this.sessions.delete(key);
    }
  }

  fromRequest(request, { required = true, csrf = false } = {}) {
    this.refreshCredential();
    this.prune();
    const values = (request.headers.cookie ?? '').split(';').map(value => value.trim())
      .filter(value => value.startsWith(`${this.cookieName}=`)).map(value => value.slice(this.cookieName.length + 1));
    const token = values.length === 1 && /^[0-9a-f]{64}$/.test(values[0]) ? values[0] : '';
    const session = token && this.sessions.get(hash(token));
    if (!session) {
      ensure(!required, 403, 'owner_session_required', 'Sign in with the enrolled local owner credential.');
      return undefined;
    }
    if (csrf) {
      const actual = Buffer.from(request.headers['x-csrf-token'] ?? '');
      const expected = Buffer.from(session.csrf);
      ensure(actual.length === expected.length && timingSafeEqual(actual, expected),
        403, 'csrf_required', 'A session CSRF token is required for this owner action.');
    }
    session.touched = this.now();
    return { key: hash(token), ...session };
  }

  logout(request) { this.sessions.delete(this.fromRequest(request, { csrf: true }).key); }

  cookie(token = '') {
    const maxAge = token ? Math.floor(this.absoluteMs / 1000) : 0;
    return `${this.cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${this.secure ? '; Secure' : ''}`;
  }
}
