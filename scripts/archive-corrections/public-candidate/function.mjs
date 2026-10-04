import { createConfiguredCandidate, sendCandidateError } from './candidate.mjs';

export function createCandidateFunction({ envProvider=()=>process.env, driverFactory }={}) {
  let cached;
  return async function handler(request,response) {
    try {
      cached??=createConfiguredCandidate(envProvider(),driverFactory?{driverFactory}:undefined);
      await cached.handler(request,response);
    }catch(error){sendCandidateError(response,error,503);}
  };
}
// Importing this entry does not read any environment or open a pool. Only a
// future configured hosting request invokes the runtime environment supplier.
export default createCandidateFunction();
