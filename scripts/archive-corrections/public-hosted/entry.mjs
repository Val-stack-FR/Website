import { PROFILES } from './profiles.mjs';
import { inspectRequest,logicalRequest,check,sendError } from './gate.mjs';
import { validateConfiguration } from './configuration.mjs';
const defaultBundleLoader=async profile=>(await import('./assets.mjs')).loadPinnedBundle(profile);
const defaultRuntimeLoader=()=>import('./mount.mjs');
const defaultDispatcherLoader=()=>import('../public-p09/dispatcher.mjs');
const defaultDriverFactory=async url=>(await import('../hosted/serverless/network.mjs')).createNetworkDriver(url);
export function createHostedPublicFunction({envProvider=()=>process.env,bundleLoader=defaultBundleLoader,runtimeLoader=defaultRuntimeLoader,
 dispatcherLoader=defaultDispatcherLoader,driverFactory=defaultDriverFactory}={}){
 let dispatcherPromise,runtimePromise,stamp,closed=false;
 const createMount=async(profile,config)=>{
  const bundle=await bundleLoader(profile);
  const runtime=await (runtimePromise??=Promise.resolve().then(runtimeLoader).catch(error=>{runtimePromise=undefined;throw error;}));
  runtime.validateBundle(profile,bundle); // Context/mandate verification precedes the driver/pool.
  const driver=await driverFactory(config.databaseUrl);
  try{return runtime.createPreparedPublicMount({profile,config,bundle,driver});}catch(error){await driver.close();throw error;}
 };
 const handler=async(request,response)=>{try{
  const selected=inspectRequest(request); // No ENV, bundle, business dependency or pool before this gate.
  check(!closed,503,'hosted_entry_closed','This hosted entry is closed.');
  const config=validateConfiguration(envProvider()),currentStamp=JSON.stringify(config);
  check(stamp===undefined || stamp===currentStamp,503,'hosted_configuration_changed','A warm entry cannot switch its configuration.');
  stamp??=currentStamp;
  dispatcherPromise??=Promise.resolve().then(dispatcherLoader).then(module=>module.createPublicCorrectionsDispatcher({origin:config.origin,
   monbezonProvider:()=>createMount(PROFILES[0],config.profiles[0]),p09Provider:()=>createMount(PROFILES[1],config.profiles[1])
  })).catch(error=>{dispatcherPromise=undefined;throw error;});
  await (await dispatcherPromise).handler(logicalRequest(request,selected.logicalUrl),response);
 }catch(error){sendError(response,error);}};
 Object.defineProperty(handler,'close',{value:async()=>{closed=true;if(dispatcherPromise)await (await dispatcherPromise).close();}});
 return handler;
}
// Import allocates no pool, reads no environment or delivery asset, and opens no SQL.
export default createHostedPublicFunction();
