import { PROFILES,ORIGIN } from './profiles.mjs';
import { check } from './gate.mjs';
export const ENV_NAMES=Object.freeze(['ARCHIVE_PUBLIC_HOSTED_MODE','ARCHIVE_PUBLIC_HOSTED_ORIGIN','ARCHIVE_PUBLIC_HOSTED_OWNER_MODE',
 ...PROFILES.flatMap(p=>['DATABASE_URL','SCHEMA','SESSION_HMAC_KEY'].map(s=>p.envPrefix+'_'+s))]);
export function validateConfiguration(env){
 check(env && typeof env==='object',503,'hosted_configuration_required','Explicit hosted configuration required.');
 for(const name of ENV_NAMES)check(typeof env[name]==='string' && env[name].length>0,503,'hosted_configuration_required','All declared hosted runtime values are required.');
 check(env.ARCHIVE_PUBLIC_HOSTED_MODE==='monbezon-p09-wip',503,'hosted_mode_required','Only the pinned two-profile WIP mode is supported.');
 check(env.ARCHIVE_PUBLIC_HOSTED_ORIGIN===ORIGIN,503,'canonical_origin_required','The exact canonical HTTPS origin is required.');
 check(env.ARCHIVE_PUBLIC_HOSTED_OWNER_MODE==='disabled',503,'owner_access_unqualified','Owner authority remains disabled.');
 const profiles=PROFILES.map(p=>{
  const schema=env[p.envPrefix+'_SCHEMA'],sessionKey=env[p.envPrefix+'_SESSION_HMAC_KEY'],databaseUrl=env[p.envPrefix+'_DATABASE_URL'];
  check(p.schemaPattern.test(schema),503,'profile_schema_required','Each profile requires its own dedicated schema namespace.');
  check(/^[a-f0-9]{64}$/.test(sessionKey),503,'hosted_key_required','An explicit private 256-bit key is required for each profile.');
  let url;try{url=new URL(databaseUrl);}catch{}
  check(url && ['postgres:','postgresql:'].includes(url.protocol) && url.hostname && url.username && url.password &&
   url.pathname.length>1 && !url.search && !url.hash,503,'database_configuration_required','A private PostgreSQL URL without options is required.');
  return {name:p.name,schema,sessionKey,databaseUrl};
 });
 check(profiles[0].schema!==profiles[1].schema,503,'isolated_schemas_required','Profiles must use distinct schemas.');
 return {origin:ORIGIN,profiles};
}
