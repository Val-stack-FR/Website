import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {assertPrivateIgnoredOutput} from './render-reader.mjs';
import {acceptedAnnexEvidence,renderAcceptedAnnexSearch,revalidateAnnexSearchShards} from './annex-shards-release.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function prepareAnnexShardReader({baseDirectory,outputPath,annexShardsContext}){
  const base=assertPrivateIgnoredOutput(baseDirectory),output=assertPrivateIgnoredOutput(outputPath);
  await revalidateAnnexSearchShards(annexShardsContext);
  const parentBytes=await readFile(join(base,'integration-proof.json')),parent=JSON.parse(parentBytes),files=new Map();
  if(parent.version!=='reader-media-integration/1' || parent.scope!=='private-local' || parent.originals_read!==false
    || parent.publication_approved!==false || parent.historical_confirmation!==false || parent.counts.draft_dossiers!==2)throw Error('Annex shards require the complete private parent reader.');
  for(const [name,pin] of Object.entries(parent.output_hashes)){
    if(!/^[a-z0-9.-]+$/u.test(name))throw Error('Unsafe parent output path');
    const bytes=await readFile(join(base,name));if(sha(bytes)!==pin)throw Error('Parent output drift');files.set(name,bytes);
  }
  const draft=JSON.parse(files.get('draft-derivative-proof.json'));
  if(draft.counts.selected_derivatives!==17 || draft.counts.occurrences!==992 || draft.counts.proposals!==89
    || draft.accepted_media_evidence.composition_review?.source_bindings!==17)throw Error('Annex shards require qualified parent17 metadata.');
  const preflight=await readFile(join(base,'accepted-preflight-inherited.json'));
  const code=['scripts/archives/annex-shards-release.mjs','scripts/archives/render-annex-search.mjs','scripts/archives/prepare-annex-shards.mjs','scripts/archives/preview-server.mjs','js/archives-annex-shards.js','css/archives-search.css'];
  const codeHashes=Object.fromEntries(await Promise.all(code.map(async name=>[name,sha(await readFile(resolve(name)))])));
  files.set('search.html',Buffer.from(renderAcceptedAnnexSearch(annexShardsContext)));
  // Only the link label changes in this inherited five-fiche status checkpoint.
  if(files.has('status.html'))files.set('status.html',Buffer.from(files.get('status.html').toString().replace('Recherche dans cinq fiches','Recherche dans les fiches')));
  files.set('parent-media-integration-proof.json',parentBytes);
  await mkdir(output);await mkdir(join(output,'empty-corpus'));
  const hashes={};
  const write=async(name,bytes)=>{await writeFile(join(output,name),bytes,{flag:'wx'});hashes[name]=sha(bytes);};
  for(const [name,bytes] of files)await write(name,bytes);
  await write('accepted-preflight-inherited.json',preflight);
  const proof={version:'private-annex-shards-integration/1',generated_at:new Date().toISOString(),scope:'private-local',
    originals_read:false,csv_tables_read:false,historical_confirmation:false,publication_approved:false,rights_status:'unknown',human_review:'pending',
    accepted_shards:acceptedAnnexEvidence(annexShardsContext),counts:{shards:2,fiches:10,name_mentions:20,locators:200},
    input_hashes:{parent_integration:sha(parentBytes),inherited_preflight:sha(preflight)},output_hashes:{'search.html':hashes['search.html']},code_hashes:codeHashes};
  await write('annex-shards-proof.json',Buffer.from(JSON.stringify(proof,null,2)+'\n'));
  const normal={...parent,generated_at:new Date().toISOString(),input_hashes:{...parent.input_hashes,annex_parent_integration:sha(parentBytes)},output_hashes:{...hashes}};
  await write('integration-proof.json',Buffer.from(JSON.stringify(normal,null,2)+'\n'));
  return {output,fiches:10,packages:2,reader_photographs:17};
}
