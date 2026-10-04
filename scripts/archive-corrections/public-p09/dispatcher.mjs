import { ApiError, canonical, ensure } from '../contract.mjs';
import { CANONICAL_ORIGIN,validateOrigin,validateRequest } from './policy.mjs';
import { SELECTION } from './selection.mjs';
const profiles=Object.freeze([
 Object.freeze({name:'monbezon-wip',prefix:'/api/archive/public/monbezon/',passage_id:'text:atelier-494756c2009be577ad11a5eb0a662d38',
  context_sha256:'3b831b7be7e0b2ab3ee785a52281249fab733da5d1bbdcbc896973a21c96d655',schema:/^archive_corrections_d5_public_wip(?:_[a-z0-9]{1,8})?$/}),
 Object.freeze({name:SELECTION.profile,prefix:SELECTION.prefix,passage_id:SELECTION.passage_id,context_sha256:SELECTION.context_digest,
  schema:/^archive_corrections_d5_p09_wip(?:_[a-z0-9]{1,8})?$/})
]);
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
// One function can host both prefixes. Root supplies explicit qualified mounts;
// this dispatcher creates no pool, seed, environment binding or third profile.
export function createPublicCorrectionsDispatcher({monbezonProvider,p09Provider,origin=CANONICAL_ORIGIN,local=false}={}){
 validateOrigin(origin,{local});const mounts=new Map();
 return {async close(){for(const pending of mounts.values()){const mount=await pending;if(typeof mount.close==='function')await mount.close();}},async handler(request,response){
  let profile;
  try{
   validateRequest(request,origin,{local});
   profile=profiles.find(p=>typeof request.url==='string' && request.url.startsWith(p.prefix));
   ensure(profile,404,'public_profile_not_found','Use one of the two explicitly prepared correction profiles.');
   const suffix=request.url.slice(profile.prefix.length),route=suffix.split('?')[0];
   ensure(!route.startsWith('owner/') && !route.startsWith('auth/'),403,'owner_access_unqualified','Owner authority and decisions remain disabled.');
   ensure(['health','passage','corrections'].includes(route),404,'public_route_not_found','Unknown prepared public route.');
   ensure(request.method===(route==='corrections'?'POST':'GET'),405,'method_not_allowed','Use the documented method.');
   ensure(suffix===(route==='passage'?`passage?passage_id=${encodeURIComponent(profile.passage_id)}`:route),404,'public_passage_not_found','Use the exact selected profile passage and query.');
   let pending=mounts.get(profile.name);
   if(!pending){
    const provider=profile.name==='monbezon-wip'?monbezonProvider:p09Provider;
    ensure(typeof provider==='function',503,'public_profile_mount_required','Root must explicitly mount this prepared profile.');
    pending=(async()=>{const mount=await provider();
     ensure(mount && typeof mount.handler==='function' && mount.profile===profile.name && mount.passage_id===profile.passage_id &&
      mount.context_sha256===profile.context_sha256 && profile.schema.test(mount.schema),503,'public_profile_binding_required','Exact profile, context and isolated schema binding required.');return mount;
    })().catch(error=>{mounts.delete(profile.name);throw error;});
    mounts.set(profile.name,pending);
   }
   await (await pending).handler(request,response);
  }catch(error){
   const known=error instanceof ApiError;response.writeHead(known?error.status:503,headers);
   response.end(canonical({api_version:'archive-corrections/public-dispatch-v1',simulation:true,identity_verified:false,owner_access_enabled:false,
    decisions_enabled:false,human_validation_enabled:false,...(profile?{delivery_profile:profile.name}:{}),
    error:{code:known?error.code:'public_dispatch_unavailable',message:known?error.message:'The explicit public corrections dispatcher is unavailable.'}})+'\n');
  }
 }};
}
export default createPublicCorrectionsDispatcher().handler;
