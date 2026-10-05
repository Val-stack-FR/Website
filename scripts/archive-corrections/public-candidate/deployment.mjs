import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensure } from '../contract.mjs';
import { CANONICAL_ORIGIN, ENV_NAMES } from './policy.mjs';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const routes=['health','passage','corrections','auth/login','auth/session','auth/logout','auth/revoke-all','owner/corrections','owner/decisions','owner/export'];
export function prepareDeployment(directory) {
  const run=resolve(directory);
  ensure(run.startsWith(join(repository,'.archive-corrections-private')+sep) && /^d9-public-candidate-[a-f0-9-]{36}$/.test(run.split(/[\\/]/).at(-1)),422,'private_run_required','Use a new private candidate output.');
  const preflight=JSON.parse(readFileSync(join(run,'preflight.json'),'utf8'));ensure(preflight.passed===true,503,'preflight_required','Candidate preflight required.');
  const overlay=join(run,'deployment-overlay');ensure(!existsSync(overlay),409,'overlay_exists','Deployment overlay must be new.');mkdirSync(overlay);
  const files=[];
  for(const profile of ['fixture','monbezon'])for(const route of routes){
    const relative=`api/archive/public/${profile}/${route}.mjs`,file=join(overlay,relative);mkdirSync(dirname(file),{recursive:true});
    const depth=relative.split('/').length-1;
    writeFileSync(file,`export { default } from '${'../'.repeat(depth)}scripts/archive-corrections/public-candidate/function.mjs';\n`,{flag:'wx'});files.push(relative);
  }
  const current=JSON.parse(readFileSync(join(run,'site-config-reference.json'),'utf8'));
  const key='api/archive/public/**/*.mjs';ensure(!Object.hasOwn(current.functions??{},key),409,'function_mapping_exists','Merge the candidate explicitly with any preexisting function mapping.');
  const proposal={...current,functions:{...(current.functions??{}),[key]:{maxDuration:10,
    includeFiles:'scripts/archive-corrections/hosted/{migrations/001.sql,serverless/migrations/002.sql}'}}};
  writeFileSync(join(overlay,'vercel.merge-proposal.json'),JSON.stringify(proposal,null,2)+'\n',{flag:'wx'});
  const manifest={version:'public-candidate-deployment-overlay/v1',canonical_origin:CANONICAL_ORIGIN,files,
    env_names:ENV_NAMES,values_included:false,original_vercel_modified:false,deployed:false,
    dependency_package:'scripts/archive-corrections/hosted/serverless/package.json',dependency_lock:'scripts/archive-corrections/hosted/serverless/pnpm-lock.yaml',
    dependencies:'existing locked pg 8.23.1 and @vercel/functions 3.9.11; provision in approved hosting build separately',
    auto_install_configured:false,private_mapping_or_derivatives_included:false,monbezon_public_delivery_enabled:false,
    owner_access_enabled:false,external_dependencies:['approved runtime/hosting','private PostgreSQL runtime/operator URLs','new schema migrated/seeded offline','runtime grants','TLS trust and canonical HTTPS proxy','deployment dependency provisioning','separate Monbezon publication rights gate']};
  writeFileSync(join(overlay,'deployment-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){try{const m=prepareDeployment(process.argv[2]);process.stdout.write(JSON.stringify({overlay_prepared:true,functions:m.files.length,deployed:false,values_included:false})+'\n');}
  catch{process.stderr.write('Candidate overlay preparation refused; root deployment files untouched.\n');process.exitCode=1;}}
