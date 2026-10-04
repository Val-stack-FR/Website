import { ApiError, canonical, ensure } from '../contract.mjs';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { SharedSessions } from '../hosted/serverless/sessions.mjs';
import { createNetworkDriver } from '../hosted/serverless/network.mjs';
import { createHandler } from '../hosted/serverless/handler.mjs';
import { SYNTHETIC_CONTEXT } from '../fixture.mjs';
import { validateConfiguration, validateRequest, POLICY } from './policy.mjs';

export function sendCandidateError(response,error,status) {
  const known=error instanceof ApiError;
  response.writeHead(status??(known?error.status:503),{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(canonical({api_version:'archive-corrections/public-candidate-v1',data_kind:'synthetic',...POLICY,
    error:{code:known?error.code:'candidate_unavailable',message:known?error.message:'The prepared candidate is unavailable.'}})+'\n');
}
// Production default is the unchanged D5 TLS-verifying driver. Injection exists
// only for explicit in-memory/offline tests; the deployment entry never supplies it.
export function createConfiguredCandidate(env, { driverFactory=createNetworkDriver }={}) {
  const configuration=validateConfiguration(env); // All gates before pool creation.
  const store=new ServerlessStore(undefined,{schema:configuration.schema,context:SYNTHETIC_CONTEXT});
  const sessions=new SharedSessions(store,configuration.sessionKey);
  store.driver=driverFactory(configuration.databaseUrl);
  const inner=createHandler({store,sessions,origin:configuration.origin});
  const prefix='/api/archive/public/fixture/';
  return {
    close:()=>store.close(),
    async handler(request,response) {
      try {
        validateRequest(request);
        ensure(typeof request.url==='string' && request.url.startsWith(prefix),404,'candidate_route_not_found','Use the explicit fixture candidate route.');
        const suffix=request.url.slice(prefix.length), route=suffix.split('?')[0];
        ensure(!route.startsWith('auth/') && !route.startsWith('owner/'),403,'owner_access_unqualified','Owner login, decisions, queue and export are disabled in this candidate.');
        ensure(['health','passage','corrections'].includes(route),404,'candidate_route_not_found','Unknown candidate route.');
        // Only the documented route prefix changes. Authority/body metadata and
        // the original body stream are forwarded unchanged; request.url is untouched.
        const adapted={url:'/api/archive/'+suffix,method:request.method,headers:request.headers,rawHeaders:request.rawHeaders,
          [Symbol.asyncIterator]:()=>request[Symbol.asyncIterator]()};
        if('body' in request)Object.defineProperty(adapted,'body',{get:()=>request.body});
        let status,headers;
        const output={writeHead(s,h){status=s;headers={...h};delete headers['Set-Cookie'];},end(bytes){
          let body;try{body=JSON.parse(String(bytes));}catch{throw new Error('Unexpected candidate response.');}
          response.writeHead(status,headers);response.end(canonical({...body,candidate_api_version:'archive-corrections/public-candidate-v1',...POLICY})+'\n');
        }};
        await inner(adapted,output);
      }catch(error){sendCandidateError(response,error);}
    },
  };
}
