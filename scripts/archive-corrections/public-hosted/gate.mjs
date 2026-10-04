import { PROFILES,ORIGIN,ENTRY_PATH } from './profiles.mjs';
export class HostedError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
export function check(value,status,code,message){if(!value)throw new HostedError(status,code,message);}
export function inspectRequest(request){
 const raw=request.rawHeaders,h=request.headers;
 check(h && Array.isArray(raw) && raw.length%2===0 && raw.every(v=>typeof v==='string'),400,'ambiguous_headers','Complete Node header metadata required.');
 const counts=new Map();for(let i=0;i<raw.length;i+=2)counts.set(raw[i].toLowerCase(),(counts.get(raw[i].toLowerCase())??0)+1);
 check(counts.get('host')===1 && ['origin','x-forwarded-proto','idempotency-key','content-type','content-length'].every(k=>(counts.get(k)??0)<=1),400,'ambiguous_headers','Headers must be unambiguous.');
 check(h.host==='valerianteissier.com' && h['x-forwarded-proto']==='https' && (h.origin===undefined || h.origin===ORIGIN),403,'same_origin_required','Host, transport and Origin must match the canonical origin.');
 check(!['authorization','x-owner-role','x-actor-role'].some(k=>k in h || counts.has(k)),403,'client_role_refused','Client authority is not accepted.');
 if(request.method==='POST')check(h.origin===ORIGIN,403,'same_origin_required','Mutations require the exact Origin.');
 const rawUrl=request.url;check(typeof rawUrl==='string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//') && rawUrl.length<=4096,404,'public_profile_not_found','Unknown public corrections route.');
 let profile=PROFILES.find(p=>rawUrl.startsWith(p.prefix)),suffix;
 if(profile)suffix=rawUrl.slice(profile.prefix.length);
 else{
  let url;try{url=new URL(rawUrl,ORIGIN);}catch{}
  check(url?.pathname===ENTRY_PATH && !url.hash,404,'public_profile_not_found','Unknown public corrections profile.');
  const q=url.searchParams;check([...q.keys()].every(k=>q.getAll(k).length===1),400,'ambiguous_route_query','Route selectors must be unique.');
  check([...q.keys()].every(k=>['__archive_profile','__archive_route','passage_id'].includes(k)),404,'public_route_not_found','Unknown route selector.');
  profile=PROFILES.find(p=>p.slug===q.get('__archive_profile'));check(profile,404,'public_profile_not_found','Unknown prepared profile.');
  const route=q.get('__archive_route');check(typeof route==='string' && route.length>0,404,'public_route_not_found','Exact route selector required.');
  suffix=route+(route==='passage'?`?passage_id=${encodeURIComponent(q.get('passage_id')??'')}`:'');
  check(route==='passage'?q.size===3:q.size===2,404,'public_route_not_found','Unexpected route query.');
 }
 const route=suffix.split('?')[0];
 check(!route.startsWith('owner/') && !route.startsWith('auth/'),403,'owner_access_unqualified','Owner authority, authentication and decisions remain disabled.');
 check(['health','passage','corrections'].includes(route),404,'public_route_not_found','Unknown prepared public route.');
 check(request.method===(route==='corrections'?'POST':'GET'),405,'method_not_allowed','Use the documented method.');
 check(suffix===(route==='passage'?`passage?passage_id=${encodeURIComponent(profile.passageId)}`:route),404,'public_passage_not_found','Use the exact selected passage and query.');
 if(route==='corrections'){
  check(typeof h['idempotency-key']==='string' && /^[A-Za-z0-9._:-]{8,100}$/.test(h['idempotency-key']),422,'invalid_idempotency_key','A stable idempotency key is required.');
  check(typeof h['content-type']==='string' && h['content-type'].split(';')[0].trim().toLowerCase()==='application/json',415,'json_required','Content-Type must be application/json.');
 }
 return {profile,route,logicalUrl:profile.prefix+suffix};
}
export function logicalRequest(request,logicalUrl){
 if(request.url===logicalUrl)return request;
 // A proxy preserves IncomingMessage identity/prototype, original raw headers,
 // socket, readable stream and body getter. Only the dispatcher URL is adapted.
 return new Proxy(request,{get(target,key){
  if(key==='url')return logicalUrl;
  const value=Reflect.get(target,key,target);
  return key===Symbol.asyncIterator && typeof value==='function'?value.bind(target):value;
 }});
}
export function sendError(response,error){
 const known=error instanceof HostedError;
 response.writeHead(known?error.status:503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Strict-Transport-Security':'max-age=31536000','Content-Security-Policy':"default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
 response.end(JSON.stringify({api_version:'archive-corrections/hosted-public-v1',simulation:true,identity_verified:false,owner_access_enabled:false,
  decisions_enabled:false,human_validation_enabled:false,error:{code:known?error.code:'hosted_public_unavailable',message:known?error.message:'The prepared hosted public entry is unavailable.'}})+'\n');
}
