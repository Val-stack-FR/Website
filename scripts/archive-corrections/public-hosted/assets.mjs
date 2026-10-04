import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { check,HostedError } from './gate.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export function loadPinnedBundle(profile,{directory=new URL(profile.assetDirectory,import.meta.url)}={}){
 try{
  const c=readFileSync(new URL('exact-context.json',directory)),m=readFileSync(new URL('delivery-mandate.json',directory));
  check(hash(c)===profile.contextFileHash && hash(m)===profile.mandateFileHash,503,'hosted_bundle_integrity_required','Exact frozen delivery assets required.');
  const context=JSON.parse(c.toString('utf8')),mandate=JSON.parse(m.toString('utf8'));
  check(hash(Buffer.from(canonical(context)))===profile.contextDigest && context.passage.passage_id===profile.passageId &&
   context.initialRevision.text_revision===profile.revision && (profile.editionId===null || context.passage.edition_id===profile.editionId),
   503,'hosted_context_binding_required','Exact selected passage/context/edition required.');
  return {context,mandate};
 }catch(error){if(error instanceof HostedError)throw error;throw new HostedError(503,'hosted_bundle_required','The frozen delivery bundle is required.');}
}
