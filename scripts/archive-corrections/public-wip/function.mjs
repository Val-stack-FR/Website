import { fileURLToPath } from 'node:url';
import { createConfiguredWip, sendWipError } from './candidate.mjs';
import { loadDeliveryBundle } from './bundle.mjs';
import { validateConfiguration } from './policy.mjs';
export function createWipFunction({envProvider=()=>process.env,bundleProvider=()=>loadDeliveryBundle(fileURLToPath(new URL('./delivery-assets',import.meta.url))),driverFactory}={}) {
  let cached;
  return async function handler(request,response){try{
    if(!cached){const env=envProvider();validateConfiguration(env);const bundle=bundleProvider();
      cached=createConfiguredWip(env,{...bundle,...(driverFactory?{driverFactory}:{})});}
    await cached.handler(request,response);
  }catch(error){sendWipError(response,error);}};
}
// Import has no environment, bundle or pool side effects.
export default createWipFunction();
