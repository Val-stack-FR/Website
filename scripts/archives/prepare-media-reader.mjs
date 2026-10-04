import { createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { adaptArchiveExport,assertPrivateIgnoredOutput,renderReaderHtml } from './render-reader.mjs';
import { renderOccurrence } from './render-occurrence.mjs';
import { loadDraftBridge } from './draft-bridge.mjs';
import { bindDraftDossierMedia } from './draft-dossier.mjs';
import { draftDerivativeSelection,verifyDraftDerivativeHtml } from './draft-derivative-bindings.mjs';
import { buildDraftReviewIndex,queryDraftReview,renderDraftReviewPage } from './draft-review.mjs';
import { acceptedDraftMediaEvidence } from './draft-media-release.mjs';
import { bindReaderMedia,loadReaderMediaRelease,readerMediaSelection,verifyReaderMediaHtml } from './reader-media-release.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function prepareMediaReader({baseDirectory,readerPath,mediaDirectory,occurrencePath,outputPath,bridgeDirectories=[],correctionsOrigin=null,correctionTextIds=[],draftDerivativeContext=null}) {
  const base=assertPrivateIgnoredOutput(baseDirectory),output=assertPrivateIgnoredOutput(outputPath);
  if(existsSync(output))throw new Error('New ignored output directory required.');
  const baseBytes=readFileSync(join(base,'integration-proof.json')),baseProof=JSON.parse(baseBytes);
  const allowed=new Set(['reader.html','catalogue.json','reader-allowlist.json','search.html','status.html','occurrence.html','draft-media-manifest.json','draft-source-manifest.json','draft-review.html','source-alias-evidence.json','reader-media-selection.json']);
  for(const [name,expected] of Object.entries(baseProof.output_hashes)) {
    if(!allowed.has(name) || !/^[a-f0-9]{64}$/u.test(expected) || sha(readFileSync(join(base,name)))!==expected)throw new Error('Base output hash or path drift.');
  }
  const readerBytes=readFileSync(readerPath);if(sha(readerBytes)!==baseProof.input_hashes.reader)throw new Error('Reader input hash differs.');
  const context=await loadReaderMediaRelease(mediaDirectory),selection=readerMediaSelection(context),model=bindReaderMedia(adaptArchiveExport(JSON.parse(readerBytes)),context);
  if(bridgeDirectories.length>2)throw new Error('At most two existing draft lots.');
  const drafts=bridgeDirectories.map(loadDraftBridge);
  if(drafts.length) {
    const selected=JSON.parse(readFileSync(join(base,'draft-source-manifest.json')));
    if(drafts.length!==Object.keys(selected.bridge_hashes).length || drafts.some(draft=>selected.bridge_hashes[draft.bridge.lot_id]!==draft.checksums['reader-bridge.json'] || selected.review_queue_hashes[draft.bridge.lot_id]!==draft.checksums['review-queue.json'] || JSON.stringify(selected.source_alias_evidence[draft.bridge.lot_id])!==JSON.stringify(draft.sourceAliasEvidence)))throw new Error('Existing draft bindings drift.');
  } else if(baseProof.output_hashes['draft-source-manifest.json'])throw new Error('Existing draft directory arguments required.');
  const draftSelection=draftDerivativeContext ? draftDerivativeSelection(draftDerivativeContext) : null;
  const draftEvidence=draftDerivativeContext ? acceptedDraftMediaEvidence(draftDerivativeContext) : null;
  if(draftSelection && (drafts.flatMap(draft=>draft.bridge.images).length!==draftSelection.bindings.length || draftSelection.bindings.some(binding=>!drafts.some(draft=>draft.bridge.images.some(image=>image.object_id===binding.source_object_id && image.sha256===binding.source_sha256)))))throw new Error('Draft derivative source selection differs from sealed lots.');
  const draftReviewIndex=draftDerivativeContext ? buildDraftReviewIndex(drafts.map(draft=>({bridge:draft.reviewBridge,queue:draft.queue})),{mediaBindings:draftDerivativeContext}) : null;
  const draftCounts=draftSelection ? {source_photographs:draftSelection.bindings.length,selected_derivatives:draftSelection.selected_object_ids.length,
    occurrences:draftReviewIndex.total,proposals:drafts.reduce((sum,draft)=>sum+draft.bridge.proposals_count,0)} : null;
  if(draftCounts && (drafts.length!==2 || draftCounts.source_photographs!==17 || draftCounts.occurrences!==992 || draftCounts.proposals!==89))throw new Error('Draft derivative preparation requires the exact two existing lots.');
  const html=renderReaderHtml(model,{privatePreview:true,draftDossiers:drafts.map(draft=>draftDerivativeContext ? bindDraftDossierMedia(draft.dossier,draftDerivativeContext) : draft.dossier),correctionsOrigin,correctionTextIds});verifyReaderMediaHtml(html,selection);
  if(draftDerivativeContext)verifyDraftDerivativeHtml(html,draftDerivativeContext);
  const occurrenceBytes=readFileSync(occurrencePath),occurrence=renderOccurrence(JSON.parse(occurrenceBytes),{mediaRelease:context});
  mkdirSync(output,{recursive:true});const hashes={};
  const write=(name,value)=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');writeFileSync(join(output,name),bytes,{flag:'wx'});hashes[name]=sha(bytes);};
  for(const name of ['catalogue.json','reader-allowlist.json','search.html','status.html','draft-media-manifest.json','draft-source-manifest.json','draft-review.html','source-alias-evidence.json'])if(baseProof.output_hashes[name] && !(draftDerivativeContext && name==='draft-review.html'))write(name,readFileSync(join(base,name)));
  if(draftDerivativeContext)write('draft-review.html',renderDraftReviewPage(queryDraftReview(draftReviewIndex)));
  write('reader.html',html);write('occurrence.html',occurrence);write('media-release-selection.json',selection);
  if(draftSelection)write('draft-derivative-selection.json',draftSelection);
  if(draftSelection) {
    write('draft-derivative-proof.json',{version:'draft-media-reader-integration/1',generated_at:new Date().toISOString(),scope:'private-local',
      originals_read:false,historical_confirmation:false,publication_approved:false,rights_review:'pending',human_review:'pending',counts:draftCounts,
      accepted_media_evidence:draftEvidence,
      input_hashes:{draft_source_manifest:hashes['draft-source-manifest.json'],draft_media_manifest:hashes['draft-media-manifest.json']},
      output_hashes:{'reader.html':hashes['reader.html'],'draft-derivative-selection.json':hashes['draft-derivative-selection.json'],
        'draft-review.html':hashes['draft-review.html']}});
  }
  write('integration-proof.json',{version:'reader-media-integration/1',generated_at:new Date().toISOString(),scope:'private-local',originals_read:false,source_views_reidentified:false,historical_confirmation:false,publication_approved:false,rights_review:'pending',input_hashes:{base_integration:sha(baseBytes),reader:sha(readerBytes),media_checksums:selection.checksums_sha256,occurrence:sha(occurrenceBytes)},output_hashes:{...hashes},counts:{accepted_source_views:2,verified_derivatives:2,base_dossiers:model.dossiers.length,draft_dossiers:drafts.length},bindings:selection.bindings});
  return {output,images:2,dossiers:model.dossiers.length+drafts.length};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const {values}=parseArgs({options:{...Object.fromEntries(['base','reader','media','occurrence','output','corrections-origin'].map(key=>[key,{type:'string'}])),'bridge-directory':{type:'string',multiple:true},'correction-text-id':{type:'string',multiple:true}}});
    for(const key of ['base','reader','media','occurrence','output'])if(!values[key])throw new Error('Required --'+key);
    console.log(await prepareMediaReader({baseDirectory:values.base,readerPath:values.reader,mediaDirectory:values.media,occurrencePath:values.occurrence,outputPath:values.output,bridgeDirectories:values['bridge-directory']??[],correctionsOrigin:values['corrections-origin'],correctionTextIds:values['correction-text-id']??[]}));
  }catch(error){console.error('Media reader preparation refused: '+error.message);process.exitCode=1;}
}
