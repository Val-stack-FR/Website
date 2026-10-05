import { ensure } from '../contract.mjs';
import { validateDatabaseUrl } from '../hosted/serverless/network.mjs';

export const CANONICAL_ORIGIN = 'https://valerianteissier.com';
export const ENV_NAMES = Object.freeze([
  'ARCHIVE_PUBLIC_CANDIDATE_PROFILE', 'ARCHIVE_PUBLIC_CANDIDATE_ORIGIN',
  'ARCHIVE_PUBLIC_CANDIDATE_DATABASE_URL', 'ARCHIVE_PUBLIC_CANDIDATE_SCHEMA',
  'ARCHIVE_PUBLIC_CANDIDATE_SESSION_HMAC_KEY', 'ARCHIVE_PUBLIC_CANDIDATE_OWNER_MODE',
]);
export function validateConfiguration(env) {
  ensure(env && typeof env === 'object', 503, 'candidate_configuration_required', 'Explicit candidate runtime configuration is required.');
  for (const name of ENV_NAMES) ensure(typeof env[name] === 'string' && env[name].length > 0,
    503, 'candidate_configuration_required', `Required runtime variable: ${name}.`);
  ensure(env.ARCHIVE_PUBLIC_CANDIDATE_ORIGIN === CANONICAL_ORIGIN, 503, 'canonical_origin_required', 'The candidate requires the exact canonical HTTPS origin.');
  ensure(env.ARCHIVE_PUBLIC_CANDIDATE_OWNER_MODE === 'disabled', 503, 'owner_access_unqualified', 'Owner authority remains disabled until separately qualified.');
  ensure(['fixture','monbezon'].includes(env.ARCHIVE_PUBLIC_CANDIDATE_PROFILE), 503, 'candidate_profile_required', 'Use an explicitly supported candidate profile.');
  // No environment switch can publish the private unreviewed D3 context.
  ensure(env.ARCHIVE_PUBLIC_CANDIDATE_PROFILE === 'fixture', 503, 'publication_rights_pending', 'Monbezon mapping is private; public delivery requires a separate rights gate.');
  ensure(/^archive_corrections_d5_public_fixture(?:_[a-z0-9_]{1,12})?$/.test(env.ARCHIVE_PUBLIC_CANDIDATE_SCHEMA),
    503, 'candidate_schema_required', 'Use a new dedicated D5 public-fixture schema.');
  ensure(/^[a-f0-9]{64}$/.test(env.ARCHIVE_PUBLIC_CANDIDATE_SESSION_HMAC_KEY), 503, 'candidate_key_required', 'A private 256-bit candidate key is required.');
  validateDatabaseUrl(env.ARCHIVE_PUBLIC_CANDIDATE_DATABASE_URL);
  return { origin: CANONICAL_ORIGIN, profile: 'fixture', schema: env.ARCHIVE_PUBLIC_CANDIDATE_SCHEMA,
    databaseUrl: env.ARCHIVE_PUBLIC_CANDIDATE_DATABASE_URL, sessionKey: env.ARCHIVE_PUBLIC_CANDIDATE_SESSION_HMAC_KEY };
}
export function validateRequest(request) {
  const raw=request.rawHeaders;
  ensure(Array.isArray(raw) && raw.length % 2 === 0 && raw.every(v=>typeof v==='string'),400,'ambiguous_headers','Complete Node header metadata is required.');
  const counts=new Map();for(let i=0;i<raw.length;i+=2)counts.set(raw[i].toLowerCase(),(counts.get(raw[i].toLowerCase())??0)+1);
  ensure(counts.get('host')===1 && ['origin','x-forwarded-proto','idempotency-key','content-type','content-length'].every(h=>(counts.get(h)??0)<=1),
    400,'ambiguous_headers','Canonical authority and mutation headers must be unambiguous.');
  ensure(request.headers.host==='valerianteissier.com' && request.headers['x-forwarded-proto']==='https'
    && (request.headers.origin===undefined || request.headers.origin===CANONICAL_ORIGIN),
    403,'canonical_https_required','Host, HTTPS transport and any Origin must match the canonical origin.');
  if(request.method==='POST')ensure(request.headers.origin===CANONICAL_ORIGIN,403,'canonical_https_required','Mutations require the exact canonical HTTPS Origin.');
  ensure(!['authorization','x-owner-role','x-actor-role'].some(h=>h in request.headers),403,'client_role_refused','Client roles and Bearer authority are not accepted.');
}
export const POLICY = Object.freeze({ simulation:true,identity_verified:false,human_validation_enabled:false,
  reading_confirmed:false,publication_enabled:false,owner_access_enabled:false });
