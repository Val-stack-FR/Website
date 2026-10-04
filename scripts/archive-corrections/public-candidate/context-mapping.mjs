import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadReaderContext, BUNDLE_HASHES, MONBEZON_TEXT_ID } from '../reader-binding.mjs';
import { ensure, canonical } from '../contract.mjs';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const writeNew=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
export function prepareMonbezonMapping(directory) {
  const run=resolve(directory);
  ensure(run.startsWith(join(repository,'.archive-corrections-private')+sep) && /^d9-public-candidate-[a-f0-9-]{36}$/.test(run.split(/[\\/]/).at(-1)),422,'private_run_required','Use the assigned private candidate run.');
  const preflight=JSON.parse(readFileSync(join(run,'preflight.json'),'utf8'));
  ensure(preflight.passed===true && preflight.database_or_network_started===false,503,'preflight_required','Pinned pre-operation preflight required.');
  for(const [name,expected] of Object.entries(BUNDLE_HASHES))
    ensure(sha(readFileSync(join(run,'derivatives',name)))===expected,422,'derivative_changed','The six closed D3 derivative pins must match.');
  const context=loadReaderContext(join(run,'derivatives'),MONBEZON_TEXT_ID);
  // Exact context and r1 from D3: no public relabeling, segmentation or rewriting.
  writeNew(join(run,'monbezon-context.private.json'),context);
  const proof={version:'public-candidate-monbezon-mapping/v1',passage_id:context.passage.passage_id,
    text_revision:context.initialRevision.text_revision,r1_text_sha256:sha(Buffer.from(context.initialRevision.text,'utf8')),
    r1_canonical_sha256:sha(Buffer.from(canonical(context.initialRevision),'utf8')),
    source_revision:context.passage.source_revision,reading_status:context.passage.reading_status,
    act_id:context.passage.act_id,document_id:context.passage.document_id,translation:context.passage.translation,
    link_review_scope:context.passage.link_review_scope,public_rights_review:context.passage.public_rights_review,
    publication_status:context.passage.publication_status,simulation:true,identity_verified:false,
    human_validation_enabled:false,public_delivery_enabled:false,originals_read:false,d8_store_accessed:false,
    mapping_file_excluded_from_deployment:true};
  writeNew(join(run,'monbezon-mapping-proof.json'),proof);return proof;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{process.stdout.write(canonical(prepareMonbezonMapping(process.argv[2]))+'\n');}
  catch{process.stderr.write('Private Monbezon mapping refused; no original or credential fallback.\n');process.exitCode=1;}
}
