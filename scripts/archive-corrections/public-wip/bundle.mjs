import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ensure, canonical, digest } from '../contract.mjs';
import { MANDATE } from './mandate.mjs';

export const CONTEXT_DIGEST='3b831b7be7e0b2ab3ee785a52281249fab733da5d1bbdcbc896973a21c96d655';
export const R1_DIGEST='f58988b0a4b10d67bf36760c1de6592ffa3ed9d55a50ac0123e1b3c3f78304e2';
export const TEXT_SHA256='b3a550ce1bc11d490d82cf9e6df5d0d669b37b710f0cb98935562c809daaf76d';
export function validateArtifacts(context, mandate) {
  ensure(digest(context)===CONTEXT_DIGEST,503,'exact_context_required','The pinned exact Monbezon r1 context is required.');
  ensure(canonical(mandate)===canonical(MANDATE),503,'delivery_mandate_required','The separate recorded WIP delivery mandate is required.');
  // Digest equality includes all D3 rights, reading, provenance and literal fields.
  return {context:JSON.parse(canonical(context)),mandate:JSON.parse(canonical(mandate))};
}
export function loadDeliveryBundle(directory) {
  let context,mandate;
  try { context=JSON.parse(readFileSync(join(directory,'exact-context.json'),'utf8'));
    mandate=JSON.parse(readFileSync(join(directory,'delivery-mandate.json'),'utf8')); }
  catch { ensure(false,503,'delivery_bundle_required','The explicit prepared delivery bundle is required.'); }
  return validateArtifacts(context,mandate);
}
export function literalHash(context) { return createHash('sha256').update(context.initialRevision.text,'utf8').digest('hex'); }
