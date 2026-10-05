import { ApiError, canonical, ensure } from '../contract.mjs';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { SharedSessions } from '../hosted/serverless/sessions.mjs';
import { createNetworkDriver } from '../hosted/serverless/network.mjs';
import { createHandler, readJson, API_VERSION } from '../hosted/serverless/handler.mjs';
import { validateArtifacts } from './bundle.mjs';
import { validateConfiguration, validateSchema, validateDeliveryOrigin, validateRequest, DELIVERY_POLICY } from './policy.mjs';
const prefix='/api/archive/public/monbezon/';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
export function sendWipError(response,error) {
  const known=error instanceof ApiError;response.writeHead(known?error.status:503,headers);
  response.end(canonical({candidate_api_version:'archive-corrections/public-wip-v1',data_kind:'historical-local',...DELIVERY_POLICY,
    error:{code:known?error.code:'wip_unavailable',message:known?error.message:'The prepared WIP candidate is unavailable.'}})+'\n');
}
function mount(store,{origin,sessionKey,local=false}) {
  validateDeliveryOrigin(origin,{local});
  const sessions=new SharedSessions(store,sessionKey);
  // HTTPS uses the unchanged D5 HTTP/SQL primitives. Local mounting has its own
  // explicit Origin guard because D5 intentionally accepts HTTPS only.
  const inner=local?undefined:createHandler({store,sessions,origin});
  let readiness;
  const ready=()=>readiness??=store.initialize({seed:false}).catch(e=>{readiness=undefined;throw e;});
  const wrap=body=>({...body,api_version:API_VERSION,candidate_api_version:'archive-corrections/public-wip-v1',data_kind:store.context.dataKind,
    ...DELIVERY_POLICY,...(body.auth_mode?{auth_mode:'anonymous-proposal-only'}:{})});
  return {close:()=>store.close(),async handler(request,response){
    try {
      validateRequest(request,origin,{local});
      ensure(typeof request.url==='string' && request.url.startsWith(prefix),404,'wip_route_not_found','Use the explicit Monbezon WIP prefix.');
      const suffix=request.url.slice(prefix.length),route=suffix.split('?')[0];
      ensure(!route.startsWith('owner/') && !route.startsWith('auth/'),403,'owner_access_unqualified','Owner login, decisions, queue and export are disabled.');
      ensure(['health','passage','corrections'].includes(route),404,'wip_route_not_found','Unknown WIP route.');
      const adapted={url:'/api/archive/'+suffix,method:request.method,headers:request.headers,rawHeaders:request.rawHeaders,
        [Symbol.asyncIterator]:()=>request[Symbol.asyncIterator]()};
      if('body' in request)Object.defineProperty(adapted,'body',{get:()=>request.body});
      if(!local) {
        let status,outHeaders;const output={writeHead(s,h){status=s;outHeaders={...h};delete outHeaders['Set-Cookie'];},end(bytes){
          response.writeHead(status,outHeaders);response.end(canonical(wrap(JSON.parse(String(bytes))))+'\n');}};
        await inner(adapted,output);return;
      }
      ensure(request.method===(route==='corrections'?'POST':'GET'),405,'method_not_allowed','Use the documented method.');
      ensure(suffix===(route==='passage'?`passage?passage_id=${encodeURIComponent(store.passage.passage_id)}`:route),404,'wip_route_not_found','Use the exact selected passage and query.');
      await ready();let status=200,body;
      if(route==='health')body={status:'ready',auth_mode:'anonymous-proposal-only',passage_id:store.passage.passage_id};
      else if(route==='passage'){const {passage,current_revision,revisions}=await store.history();body={passage,current_revision,revisions};}
      else {await sessions.reserve('proposal');const result=await store.mutate('proposal',request.headers['idempotency-key'],await readJson(adapted));status=result.status;body=result.body;}
      response.writeHead(status,headers);response.end(canonical(wrap(body))+'\n');
    }catch(error){sendWipError(response,error);}
  }};
}
export function createConfiguredWip(env,{context,mandate,driverFactory=createNetworkDriver}={}) {
  const config=validateConfiguration(env),validated=validateArtifacts(context,mandate);
  const store=new ServerlessStore(undefined,{schema:config.schema,context:validated.context});
  // Configuration and exact context/mandate validation precede every pool creation.
  store.driver=driverFactory(config.databaseUrl);
  return mount(store,config);
}
export function createLocalWip({driver,schema,context,mandate,origin,sessionKey}={}) {
  validateSchema(schema);validateDeliveryOrigin(origin,{local:true});
  ensure(typeof sessionKey==='string' && /^[a-f0-9]{64}$/.test(sessionKey),503,'wip_key_required','Explicit local test key required.');
  ensure(driver && typeof driver.transaction==='function' && typeof driver.close==='function',503,'local_driver_required','An explicitly owned local driver is required.');
  const validated=validateArtifacts(context,mandate),store=new ServerlessStore(driver,{schema,context:validated.context});
  return mount(store,{origin,sessionKey,local:true});
}
