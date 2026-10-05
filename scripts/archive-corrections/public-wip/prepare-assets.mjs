import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname, posix } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadReaderContext, BUNDLE_HASHES } from '../reader-binding.mjs';
import { ensure, digest } from '../contract.mjs';
import { MANDATE } from './mandate.mjs';
import { validateArtifacts, CONTEXT_DIGEST, R1_DIGEST, literalHash } from './bundle.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const writeNew=(file,value)=>{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});};
export function prepareAssets(directory) {
  const run=resolve(directory);
  ensure(dirname(run)===join(repo,'.archive-corrections-private') && /^d10-public-wip-[a-f0-9-]{36}$/.test(run.split(/[\\/]/).at(-1)),422,'assigned_run_required','Use a new assigned D10 run.');
  const preflight=JSON.parse(readFileSync(join(run,'preflight.json'),'utf8'));
  ensure(preflight.passed===true && preflight.database_started===false,503,'preflight_required','Pinned pre-operation preflight required.');
  for(const [name,expected] of Object.entries(BUNDLE_HASHES))ensure(hash(readFileSync(join(run,'derivatives',name)))===expected,503,'derivative_changed','Closed derivative pins must match.');
  const context=loadReaderContext(join(run,'derivatives'));validateArtifacts(context,MANDATE);
  writeNew(join(run,'delivery-assets/exact-context.json'),context);
  writeNew(join(run,'delivery-assets/delivery-mandate.json'),MANDATE);
  const files=[];
  for(const name of ['exact-context.json','delivery-mandate.json']){
    const target='scripts/archive-corrections/public-wip/delivery-assets/'+name,source=join(run,'delivery-assets',name),dest=join(run,'deployment-overlay',target);
    mkdirSync(dirname(dest),{recursive:true});copyFileSync(source,dest);files.push({source_path:source,target_relative_path:target,sha256:hash(readFileSync(source)),required_at_runtime:true});
  }
  for(const route of ['health','passage','corrections','auth/login','auth/session','auth/logout','auth/revoke-all','owner/corrections','owner/decisions','owner/export']) {
    const path='api/archive/public/monbezon/'+route+'.mjs',file=join(run,'deployment-overlay',path);
    let spec=posix.relative(posix.dirname(path),'scripts/archive-corrections/public-wip/function.mjs');if(!spec.startsWith('.'))spec='./'+spec;
    mkdirSync(dirname(file),{recursive:true});writeFileSync(file,`export { default } from '${spec}';\n`,{flag:'wx'});
    files.push({source_path:file,target_relative_path:path,sha256:hash(readFileSync(file)),required_at_runtime:true});
  }
  writeNew(join(run,'vercel.additions-only.json'),{functions:{'api/archive/public/monbezon/**/*.mjs':{maxDuration:10,
    includeFiles:'scripts/archive-corrections/{hosted/migrations/001.sql,hosted/serverless/migrations/002.sql,public-wip/delivery-assets/*.json}'}}});
  writeNew(join(run,'mapping-proof.json'),{version:'public-wip-exact-mapping/v1',passage_id:context.passage.passage_id,
    text_revision:context.initialRevision.text_revision,source_revision:context.passage.source_revision,
    context_canonical_sha256:CONTEXT_DIGEST,r1_canonical_sha256:R1_DIGEST,r1_text_sha256:literalHash(context),
    reading_status:context.passage.reading_status,public_rights_review:context.passage.public_rights_review,
    source_publication_status:context.passage.publication_status,translation:context.passage.translation,
    act_id:context.passage.act_id,document_id:context.passage.document_id,link_review_scope:context.passage.link_review_scope,
    delivery_mandate_sha256:digest(MANDATE),user_wip_delivery_authorized:true,rights_approved:false,historical_reading_validated:false,
    owner_enabled:false,source_modified:false,originals_read:false,d8_store_accessed:false,deployed:false});
  const paths=['scripts/archive-corrections/public-wip/function.mjs','scripts/archive-corrections/public-wip/candidate.mjs',
    'scripts/archive-corrections/public-wip/policy.mjs','scripts/archive-corrections/public-wip/bundle.mjs','scripts/archive-corrections/public-wip/mandate.mjs',
    'scripts/archive-corrections/contract.mjs','scripts/archive-corrections/fixture.mjs','scripts/archive-corrections/snapshot-validation.mjs',
    'scripts/archive-corrections/hosted/postgres-store.mjs','scripts/archive-corrections/hosted/serverless/store.mjs',
    'scripts/archive-corrections/hosted/serverless/sessions.mjs','scripts/archive-corrections/hosted/serverless/handler.mjs',
    'scripts/archive-corrections/hosted/serverless/network.mjs','scripts/archive-corrections/hosted/migrations/001.sql','scripts/archive-corrections/hosted/serverless/migrations/002.sql'];
  const runtime=paths.map(path=>({source_path:join(repo,path),target_relative_path:path,sha256:hash(readFileSync(join(repo,path))),required_at_runtime:true}));
  const dependencies=['package.json','pnpm-lock.yaml'].map(name=>{const path='scripts/archive-corrections/hosted/serverless/'+name;
    return {source_path:join(repo,path),target_relative_path:path,sha256:hash(readFileSync(join(repo,path))),required_for_build:true};});
  const allow={version:'public-wip-runtime-allowlist/v1',runtime_files:runtime,generated_files:files,dependency_manifests:dependencies,
    project_root_outside_static_dist:true,replace_only_new_package_d9_monbezon_entries:true,
    excludes:['D8 store/config/lock','all private runs and proofs','derivative bundles','PGlite','operator scripts','node_modules from local machine'],
    context_included_exactly:true,owner_enabled:false,deployed:false};
  writeNew(join(run,'runtime-allowlist.json'),allow);return allow;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=prepareAssets(process.argv[2]);console.log(JSON.stringify({prepared:true,runtime_files:result.runtime_files.length,generated_files:result.generated_files.length,dependency_manifests:2}));
}
