import { ensure } from '../contract.mjs';
import { SELECTION } from './selection.mjs';
export const CANONICAL_ORIGIN='https://valerianteissier.com';
export const DELIVERY_POLICY=Object.freeze({simulation:true,identity_verified:false,historical_reading_validated:false,
 reading_confirmed:false,rights_approved:false,public_rights_review:'pending',human_validation_enabled:false,
 owner_access_enabled:false,decisions_enabled:false,user_wip_delivery_authorized:true,wip_delivery_enabled:true,
 publication_enabled:false,delivery_profile:'p09-wip',mandate_id:'mandate:p09-proposed-wip-20261004',
 edition_id:SELECTION.edition_id,edition_status:SELECTION.edition_status,source_publication_status:'private',proposal_review_status:'pending'});
export function validateSchema(schema){
 ensure(typeof schema==='string' && /^archive_corrections_d5_p09_wip(?:_[a-z0-9]{1,8})?$/.test(schema),503,'p09_schema_required','Use a new dedicated P09 WIP schema.');return schema;
}
export function validateOrigin(origin,{local=false}={}){
 let url;try{url=new URL(origin);}catch{}
 ensure(url && url.origin===origin && !url.username && !url.password &&
  (local?url.protocol==='http:' && url.hostname==='127.0.0.1' && /^\d+$/.test(url.port):origin===CANONICAL_ORIGIN),
  503,'p09_origin_required','Use the canonical HTTPS origin or an explicit owned loopback origin.');return url;
}
export function validateRequest(request,origin,{local=false}={}){
 const expected=validateOrigin(origin,{local}),raw=request.rawHeaders;
 ensure(Array.isArray(raw) && raw.length%2===0 && raw.every(v=>typeof v==='string'),400,'ambiguous_headers','Complete Node header metadata required.');
 const counts=new Map();for(let i=0;i<raw.length;i+=2)counts.set(raw[i].toLowerCase(),(counts.get(raw[i].toLowerCase())??0)+1);
 ensure(counts.get('host')===1 && ['origin','x-forwarded-proto','idempotency-key','content-type','content-length','authorization','x-owner-role','x-actor-role'].every(h=>(counts.get(h)??0)<=1),
  400,'ambiguous_headers','Mutation and authority headers must be unambiguous.');
 ensure(request.headers.host===expected.host && (local?request.headers['x-forwarded-proto']===undefined:request.headers['x-forwarded-proto']==='https') &&
  (request.headers.origin===undefined || request.headers.origin===origin),403,'same_origin_required','Host, transport and Origin must match this exact P09 mount.');
 if(request.method==='POST')ensure(request.headers.origin===origin,403,'same_origin_required','Mutations require the exact Origin.');
 ensure(!['authorization','x-owner-role','x-actor-role'].some(h=>h in request.headers),403,'client_role_refused','Client roles and Bearer authority are not accepted.');
}
export function classifyRoute(request){
 ensure(typeof request.url==='string' && request.url.startsWith(SELECTION.prefix),404,'p09_route_not_found','Use the explicit P09 namespace.');
 const suffix=request.url.slice(SELECTION.prefix.length),route=suffix.split('?')[0];
 ensure(!route.startsWith('owner/') && !route.startsWith('auth/'),403,'owner_access_unqualified','Owner login, decisions, queue and export remain disabled.');
 ensure(['health','passage','corrections'].includes(route),404,'p09_route_not_found','Unknown P09 route.');
 ensure(request.method===(route==='corrections'?'POST':'GET'),405,'method_not_allowed','Use the documented method.');
 ensure(suffix===(route==='passage'?`passage?passage_id=${encodeURIComponent(SELECTION.passage_id)}`:route),404,'p09_route_not_found','Use the exact P09 draft passage and query.');
 return route;
}
