import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp,readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname,join,resolve,relative,isAbsolute,sep } from 'node:path';
import { test } from 'node:test';
import { adaptArchiveExport,renderReaderHtml } from '../../scripts/archives/render-reader.mjs';
import { renderOccurrence } from '../../scripts/archives/render-occurrence.mjs';
import { loadReaderMediaRelease,readerMediaSelection,bindReaderMedia } from '../../scripts/archives/reader-media-release.mjs';
import { createArchivePreview } from '../../scripts/archives/preview-server.mjs';

const real=process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY && process.env.ARCHIVES_MEDIA_READER_INPUT && process.env.ARCHIVES_MEDIA_OCCURRENCE_INPUT;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';

test('release server serves both derivatives without source files, and refuses incomplete or falsified runs',{skip:!real},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'archives-media-server-'));
  const path=name=>join(directory,name),save=async(name,value)=>writeFile(path(name),typeof value==='string'||Buffer.isBuffer(value) ? value : json(value));
  let preview;
  try {
    const context=await loadReaderMediaRelease(process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY),selection=readerMediaSelection(context);
    const inputBytes=await readFile(process.env.ARCHIVES_MEDIA_READER_INPUT),input=JSON.parse(inputBytes);
    const html=renderReaderHtml(bindReaderMedia(adaptArchiveExport(input),context),{privatePreview:true});
    const occurrenceHtml=renderOccurrence(JSON.parse(await readFile(process.env.ARCHIVES_MEDIA_OCCURRENCE_INPUT)),{mediaRelease:context});
    const base=dirname(process.env.ARCHIVES_MEDIA_READER_INPUT);
    const media=JSON.parse(await readFile(join(base,'media-allowlist.json'))),sources=JSON.parse(await readFile(join(base,'source-input-manifest.json')));
    const proof={version:'reader-media-integration/1',scope:'private-local',originals_read:false,source_views_reidentified:false,historical_confirmation:false,publication_approved:false,rights_review:'pending',counts:{accepted_source_views:2,verified_derivatives:2,base_dossiers:2,draft_dossiers:0},bindings:selection.bindings,input_hashes:{reader:hash(inputBytes),media_checksums:selection.checksums_sha256},output_hashes:{'reader.html':hash(html),'occurrence.html':hash(occurrenceHtml),'media-release-selection.json':hash(json(selection))}};
    await mkdir(path('empty-corpus'));await mkdir(path('css'));await mkdir(path('js'));
    for(const name of ['styles.css','css/archives.css','js/archives-reader.js','favicon.svg','css/archives-occurrence.css'])await save(name,'fixture');
    await save('reader.html',html);await save('occurrence.html',occurrenceHtml);await save('reader.json',inputBytes);await save('selection.json',selection);
    const restore=async()=>{
      await save('proof.json',proof);await save('media.json',media);await save('sources.json',sources);
      await save('preflight.json',{passed:true,corpus_root_accessible:true,corpus_root_reference:'env:PHD_CORPUS_ROOT',input_manifest_sha256:hash(json(sources))});
    };
    await restore();
    const config={assetsRoot:directory,corpusRoot:path('empty-corpus'),htmlPath:path('reader.html'),occurrenceHtmlPath:path('occurrence.html'),readerExportPath:path('reader.json'),mediaManifestPath:path('media.json'),sourceManifestPath:path('sources.json'),preflightPath:path('preflight.json'),releaseMediaDirectory:process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY,releaseSelectionPath:path('selection.json'),releaseRunProofPath:path('proof.json')};
    preview=await createArchivePreview(config);
    const origin=await preview.listen(0);
    for(const item of selection.bindings) {
      const response=await fetch(new URL(item.media_url,origin));assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),item.derivative_sha256);
      assert.equal((await fetch(new URL('/__archive_media/'+item.source_sha256,origin))).status,404);
    }
    assert.equal((await fetch(new URL('/archives/formes/',origin))).status,200);
    await new Promise((accept,reject)=>preview.server.close(error=>error ? reject(error) : accept()));preview=null;
    for(const mutate of [p=>p.scope='public',p=>p.originals_read=true,p=>p.source_views_reidentified=true,p=>p.historical_confirmation=true,p=>p.publication_approved=true,p=>p.rights_review='clear',p=>p.counts.accepted_source_views=1,p=>p.counts.verified_derivatives=1,p=>p.counts.base_dossiers=1,p=>p.counts.draft_dossiers=2,p=>p.bindings.pop(),p=>p.bindings[0].source_sha256='0'.repeat(64)]) {
      const changed=structuredClone(proof);mutate(changed);await save('proof.json',changed);await assert.rejects(createArchivePreview(config),/Release run/);
    }
    await restore();await assert.rejects(createArchivePreview({...config,occurrenceHtmlPath:undefined}),/sealed H05/);
    await save('occurrence.html',occurrenceHtml+'changed');await assert.rejects(createArchivePreview(config),/sealed H05/);await save('occurrence.html',occurrenceHtml);
    for(const sourceOnly of [false,true]) {
      const changedMedia=structuredClone(media),changedSources=structuredClone(sources);
      if(!sourceOnly)changedMedia.objects=changedMedia.objects.filter(item=>item.view_id!==selection.bindings[1].view_id);
      changedSources.objects=changedSources.objects.filter(item=>item.view_id!==selection.bindings[1].view_id);
      await save('media.json',changedMedia);await save('sources.json',changedSources);await save('preflight.json',{passed:true,corpus_root_accessible:true,corpus_root_reference:'env:PHD_CORPUS_ROOT',input_manifest_sha256:hash(json(changedSources))});
      await assert.rejects(createArchivePreview(config),/exactly the two accepted/);
    }
  } finally {
    if(preview)await new Promise((accept,reject)=>preview.server.close(error=>error ? reject(error) : accept()));
    const parent=resolve(tmpdir()),target=resolve(directory),part=relative(parent,target);
    assert.ok(part && !isAbsolute(part) && part!=='..' && !part.startsWith('..'+sep) && part.startsWith('archives-media-server-'));
    await rm(target,{recursive:true,force:true});
  }
});
