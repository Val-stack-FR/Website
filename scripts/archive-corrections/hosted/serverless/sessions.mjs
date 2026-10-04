import { randomBytes, randomUUID, scrypt, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ensure, exactFields } from '../../contract.mjs';

export const COOKIE_NAME = '__Host-archive_owner_session_d5';
export const KEY_ENV = 'ARCHIVE_CORRECTIONS_SESSION_HMAC_KEY';
export const PHRASE_ENV = 'ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE';
const derive = promisify(scrypt);
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
function validatePhrase(value) {
  ensure(typeof value === 'string' && value.length >= 20 && value.length <= 256 && value.trim() === value
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value), 422, 'invalid_passphrase', 'Use a private passphrase of 20–256 characters without controls or outer whitespace.');
}
export async function databaseTime(tx) {
  const now = Number((await tx.query('SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms')).rows[0].now_ms);
  ensure(Number.isSafeInteger(now), 503, 'database_clock_unavailable', 'A valid shared database clock is required.');
  return now;
}

export class SharedSessions {
  constructor(store, key, { idleMs = 30 * 60 * 1000, absoluteMs = 8 * 60 * 60 * 1000, loginLimit = 5,
    proposalLimit = 60, sessionLimit = 8 } = {}) {
    ensure(typeof key === 'string' && /^[0-9a-f]{64}$/.test(key), 503, 'session_key_required', `Set ${KEY_ENV} to a private 256-bit hexadecimal key.`);
    ensure([idleMs, absoluteMs, loginLimit, proposalLimit, sessionLimit].every(value => Number.isSafeInteger(value) && value > 0)
      && idleMs <= absoluteMs, 503, 'invalid_session_policy', 'Session lifetimes and shared limits must be positive integers.');
    this.store = store; this.key = key; this.keyHash = hash(key);
    this.idleMs = idleMs; this.absoluteMs = absoluteMs; this.loginLimit = loginLimit;
    this.proposalLimit = proposalLimit; this.sessionLimit = sessionLimit;
  }
  async credential(tx) {
    const value = (await tx.query(`SELECT generation, salt, verifier FROM ${this.store.table('owner_credentials')} WHERE singleton=1`)).rows[0];
    ensure(value, 503, 'owner_not_enrolled', 'Enroll the serverless pilot owner offline.');
    return value;
  }
  csrf(value) { return createHmac('sha256', Buffer.from(this.key, 'hex')).update(`${this.store.schema}:${value}:csrf`).digest('hex'); }
  cookie(value = '') {
    return `${COOKIE_NAME}=${value}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? Math.floor(this.absoluteMs / 1000) : 0}`;
  }
  requestToken(request) {
    const values = (request.headers.cookie ?? '').split(';').map(value => value.trim())
      .filter(value => value.startsWith(`${COOKIE_NAME}=`)).map(value => value.slice(COOKIE_NAME.length + 1));
    return values.length === 1 && /^[0-9a-f]{64}$/.test(values[0]) ? values[0] : undefined;
  }
  async reserve(bucket) {
    return this.store.driver.transaction(async tx => {
      await this.store.lockTransaction(tx);
      const now = await databaseTime(tx);
      const count = Number((await tx.query(`SELECT count(*) AS count FROM ${this.store.table('rate_events')} WHERE bucket=$1 AND created_ms>$2`, [bucket, now - 60000])).rows[0].count);
      ensure(count < (bucket === 'login' ? this.loginLimit : this.proposalLimit), 429, `${bucket}_throttled`, 'Wait before trying again.');
      await tx.query(`INSERT INTO ${this.store.table('rate_events')} VALUES ($1,$2,$3)`, [randomUUID(), bucket, now]);
    });
  }
  async login(payload) {
    exactFields(payload, ['passphrase']); validatePhrase(payload.passphrase);
    await this.reserve('login'); // Shared reservation commits BEFORE expensive verification.
    const credential = await this.store.driver.transaction(tx => this.credential(tx), { readOnly: true });
    const actual = await derive(payload.passphrase, Buffer.from(credential.salt, 'hex'), 32, parameters);
    ensure(timingSafeEqual(actual, Buffer.from(credential.verifier, 'hex')), 403, 'invalid_credential', 'The pilot owner credential was refused.');
    const value = token();
    await this.store.driver.transaction(async tx => {
      await this.store.lockTransaction(tx);
      const current = await this.credential(tx);
      ensure(current.generation === credential.generation && current.verifier === credential.verifier, 403, 'invalid_credential', 'The credential rotated; sign in again.');
      const now = await databaseTime(tx);
      const live = (await tx.query(`SELECT s.token_hash FROM ${this.store.table('owner_sessions')} s
        LEFT JOIN ${this.store.table('session_revocations')} r USING(token_hash)
        WHERE s.generation=$1 AND s.key_hash=$2 AND r.token_hash IS NULL AND s.created_ms>$3 AND s.touched_ms>$4
        ORDER BY s.created_ms, s.token_hash`, [current.generation, this.keyHash, now - this.absoluteMs, now - this.idleMs])).rows;
      while (live.length >= this.sessionLimit) {
        await tx.query(`INSERT INTO ${this.store.table('session_revocations')} VALUES ($1,$2,'session_limit') ON CONFLICT DO NOTHING`, [live.shift().token_hash, now]);
      }
      await tx.query(`INSERT INTO ${this.store.table('owner_sessions')} VALUES ($1,$2,$3,$4,$4)`, [hash(value), current.generation, this.keyHash, now]);
    });
    return { token: value, csrf_token: this.csrf(value), authenticated: true, identity_verified: false };
  }
  async authorize(tx, request, { required = true, csrf = false } = {}) {
    const value = this.requestToken(request);
    if (!value) { ensure(!required, 403, 'owner_session_required', 'A valid shared owner session is required.'); return undefined; }
    const credential = await this.credential(tx);
    const now = await databaseTime(tx);
    const session = (await tx.query(`SELECT s.token_hash FROM ${this.store.table('owner_sessions')} s
      LEFT JOIN ${this.store.table('session_revocations')} r USING(token_hash)
      WHERE s.token_hash=$1 AND s.generation=$2 AND s.key_hash=$3 AND r.token_hash IS NULL AND s.created_ms>$4 AND s.touched_ms>$5`,
    [hash(value), credential.generation, this.keyHash, now - this.absoluteMs, now - this.idleMs])).rows[0];
    if (!session) { ensure(!required, 403, 'owner_session_required', 'The shared owner session is expired or revoked.'); return undefined; }
    const csrf_token = this.csrf(value);
    if (csrf) {
      const actual = Buffer.from(request.headers['x-csrf-token'] ?? ''); const expected = Buffer.from(csrf_token);
      ensure(actual.length === expected.length && timingSafeEqual(actual, expected), 403, 'csrf_required', 'This owner action requires its session CSRF token.');
    }
    await tx.query(`UPDATE ${this.store.table('owner_sessions')} SET touched_ms=$2 WHERE token_hash=$1`, [session.token_hash, now]);
    return { ...session, csrf_token };
  }
  async session(request) {
    return this.store.driver.transaction(async tx => {
      await this.store.lockTransaction(tx); const session = await this.authorize(tx, request, { required: false });
      return { authenticated: Boolean(session), identity_verified: false, ...(session ? { csrf_token: session.csrf_token } : {}) };
    });
  }
  async revoke(request, all = false) {
    await this.store.driver.transaction(async tx => {
      await this.store.lockTransaction(tx); const session = await this.authorize(tx, request, { csrf: true });
      const now = await databaseTime(tx);
      if (all) {
        await tx.query(`INSERT INTO ${this.store.table('session_revocations')} SELECT token_hash,$1,'revoke_all'
          FROM ${this.store.table('owner_sessions')} ON CONFLICT DO NOTHING`, [now]);
      } else await tx.query(`INSERT INTO ${this.store.table('session_revocations')} VALUES ($1,$2,'logout') ON CONFLICT DO NOTHING`, [session.token_hash, now]);
    });
  }
}

// Offline operator connection only. The function runtime role may SELECT this table, never change it.
export async function enrollSharedOwner(store, passphrase, { rotate = false } = {}) {
  validatePhrase(passphrase);
  const salt = randomBytes(16).toString('hex');
  const verifier = (await derive(passphrase, Buffer.from(salt, 'hex'), 32, parameters)).toString('hex');
  const generation = randomUUID();
  await store.driver.transaction(async tx => {
    await store.lockTransaction(tx); await store.verifyMigration(tx);
    const current = (await tx.query(`SELECT generation FROM ${store.table('owner_credentials')} WHERE singleton=1`)).rows[0];
    ensure(rotate ? current : !current, 409, rotate ? 'owner_not_enrolled' : 'owner_already_enrolled', 'Use explicit offline enrollment or rotation for this state.');
    const now = await databaseTime(tx);
    if (rotate) await tx.query(`UPDATE ${store.table('owner_credentials')} SET generation=$1,salt=$2,verifier=$3,created_ms=$4 WHERE singleton=1`, [generation, salt, verifier, now]);
    else await tx.query(`INSERT INTO ${store.table('owner_credentials')} VALUES (1,$1,$2,$3,$4)`, [generation, salt, verifier, now]);
    await tx.query(`INSERT INTO ${store.table('owner_events')} VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), rotate ? 'rotate' : 'enroll', current?.generation ?? null, generation, now]);
  });
  return { enrolled: true, rotated: rotate, identity_verified: false, simulation: true };
}
