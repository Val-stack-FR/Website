import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { canonical, digest, ensure } from '../contract.mjs';
import { SELECTION } from './selection.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateArtifacts(context,mandate){
 ensure(digest(context)===SELECTION.context_digest,503,'p09_exact_context_required','The exact admitted P09 proposed edition is required.');
 ensure(digest(mandate)===SELECTION.mandate_digest,503,'p09_mandate_required','The separate recorded P09 WIP mandate is required.');
 return {context:JSON.parse(canonical(context)),mandate:JSON.parse(canonical(mandate))};
}
export function loadDeliveryBundle(directory){
 let context,mandate;
 try{
  const c=readFileSync(join(directory,'exact-context.json')),m=readFileSync(join(directory,'delivery-mandate.json'));
  ensure(hash(c)===SELECTION.context_file_sha256 && hash(m)===SELECTION.mandate_file_sha256,503,'p09_bundle_integrity_required','Exact prepared P09 delivery bytes required.');
  context=JSON.parse(c.toString('utf8'));mandate=JSON.parse(m.toString('utf8'));
 }catch(error){if(error.code==='p09_bundle_integrity_required')throw error;ensure(false,503,'p09_delivery_bundle_required','The explicit P09 delivery bundle is required.');}
 return validateArtifacts(context,mandate);
}
