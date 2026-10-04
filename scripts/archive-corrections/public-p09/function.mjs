import { ensure } from '../contract.mjs';
import { CANONICAL_ORIGIN, validateRequest, classifyRoute } from './policy.mjs';
import { sendP09Error } from './adapter.mjs';
import { SELECTION } from './selection.mjs';
export function createP09Function({mountProvider}={}){
 let pending;
 return async function handler(request,response){try{
  // Cold refusal and owner/auth closure do not read ENV, delivery assets or SQL.
  validateRequest(request,CANONICAL_ORIGIN);classifyRoute(request);
  ensure(typeof mountProvider==='function',503,'p09_mount_required','Root must supply an explicitly reviewed P09 mount.');
  pending??=(async()=>{const mounted=await mountProvider();ensure(typeof mounted?.handler==='function' && mounted.profile===SELECTION.profile &&
   mounted.passage_id===SELECTION.passage_id && mounted.edition_id===SELECTION.edition_id && mounted.context_sha256===SELECTION.context_digest,
   503,'p09_mount_required','An explicit P09 handler and exact profile binding are required.');return mounted;})().catch(error=>{pending=undefined;throw error;});
  await (await pending).handler(request,response);
 }catch(error){sendP09Error(response,error);}};
}
// Import has no environment, source or database side effects. No Monbezon fallback.
export default createP09Function();
