import { ensure } from '../contract.mjs';
import { validateDatabaseUrl } from '../hosted/serverless/network.mjs';
export const CANONICAL_ORIGIN='https://valerianteissier.com';
export const ENV_NAMES=Object.freeze(['ARCHIVE_PUBLIC_WIP_PROFILE','ARCHIVE_PUBLIC_WIP_ORIGIN',
  'ARCHIVE_PUBLIC_WIP_DATABASE_URL','ARCHIVE_PUBLIC_WIP_SCHEMA','ARCHIVE_PUBLIC_WIP_SESSION_HMAC_KEY','ARCHIVE_PUBLIC_WIP_OWNER_MODE']);
export function validateSchema(schema) {
  ensure(typeof schema==='string' && /^archive_corrections_d5_public_wip(?:_[a-z0-9]{1,8})?$/.test(schema),503,'wip_schema_required','Use a new dedicated public-WIP schema.');
  return schema;
}
export function validateConfiguration(env) {
  ensure(env && typeof env==='object',503,'wip_configuration_required','Explicit WIP runtime configuration is required.');
  for(const name of ENV_NAMES)ensure(typeof env[name]==='string' && env[name].length>0,503,'wip_configuration_required',`Required runtime variable: ${name}.`);
  ensure(env.ARCHIVE_PUBLIC_WIP_PROFILE==='monbezon-wip',503,'wip_profile_required','The explicit monbezon-wip profile is required.');
  ensure(env.ARCHIVE_PUBLIC_WIP_ORIGIN===CANONICAL_ORIGIN,503,'canonical_origin_required','The exact canonical HTTPS origin is required.');
  ensure(env.ARCHIVE_PUBLIC_WIP_OWNER_MODE==='disabled',503,'owner_access_unqualified','Owner authority remains disabled.');
  validateSchema(env.ARCHIVE_PUBLIC_WIP_SCHEMA);
  ensure(/^[a-f0-9]{64}$/.test(env.ARCHIVE_PUBLIC_WIP_SESSION_HMAC_KEY),503,'wip_key_required','An explicit private 256-bit runtime key is required.');
  validateDatabaseUrl(env.ARCHIVE_PUBLIC_WIP_DATABASE_URL);
  return {origin:CANONICAL_ORIGIN,schema:env.ARCHIVE_PUBLIC_WIP_SCHEMA,databaseUrl:env.ARCHIVE_PUBLIC_WIP_DATABASE_URL,
    sessionKey:env.ARCHIVE_PUBLIC_WIP_SESSION_HMAC_KEY};
}
export function validateDeliveryOrigin(origin,{local=false}={}) {
  let url;try{url=new URL(origin);}catch{}
  ensure(url && url.origin===origin && !url.username && !url.password &&
    (local?url.protocol==='http:' && url.hostname==='127.0.0.1' && /^\d+$/.test(url.port):origin===CANONICAL_ORIGIN),
    503,'delivery_origin_required','Use the canonical HTTPS origin or an explicit loopback HTTP origin for the local mount.');
  return url;
}
export function validateRequest(request,origin,{local=false}={}) {
  const expected=validateDeliveryOrigin(origin,{local}),raw=request.rawHeaders;
  ensure(Array.isArray(raw) && raw.length%2===0 && raw.every(v=>typeof v==='string'),400,'ambiguous_headers','Complete Node header metadata is required.');
  const counts=new Map();for(let i=0;i<raw.length;i+=2)counts.set(raw[i].toLowerCase(),(counts.get(raw[i].toLowerCase())??0)+1);
  ensure(counts.get('host')===1 && ['origin','x-forwarded-proto','idempotency-key','content-type','content-length'].every(h=>(counts.get(h)??0)<=1),400,'ambiguous_headers','Mutation and authority headers must be unambiguous.');
  ensure(request.headers.host===expected.host && (local?request.headers['x-forwarded-proto']===undefined:request.headers['x-forwarded-proto']==='https')
    && (request.headers.origin===undefined || request.headers.origin===origin),403,'same_origin_required','Host, transport and Origin must match this exact mount.');
  if(request.method==='POST')ensure(request.headers.origin===origin,403,'same_origin_required','Mutations require the exact Origin.');
  ensure(!['authorization','x-owner-role','x-actor-role'].some(h=>h in request.headers),403,'client_role_refused','Client roles and Bearer authority are not accepted.');
}
export const DELIVERY_POLICY=Object.freeze({simulation:true,identity_verified:false,historical_reading_validated:false,
  reading_confirmed:false,rights_approved:false,public_rights_review:'pending',human_validation_enabled:false,
  owner_access_enabled:false,decisions_enabled:false,user_wip_delivery_authorized:true,wip_delivery_enabled:true,
  publication_enabled:false,delivery_profile:'monbezon-wip',mandate_id:'mandate:monbezon-wip-20261004'});
