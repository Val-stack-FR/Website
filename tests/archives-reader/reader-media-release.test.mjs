import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { adaptArchiveExport,renderReaderHtml } from '../../scripts/archives/render-reader.mjs';
import { prepareOccurrence,renderOccurrence } from '../../scripts/archives/render-occurrence.mjs';
import { loadReaderMediaRelease,readerMediaSelection,readerMediaRoutes,bindReaderMedia,bindOccurrenceMedia,verifyReaderMediaHtml } from '../../scripts/archives/reader-media-release.mjs';

const real=process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY && process.env.ARCHIVES_MEDIA_READER_INPUT && process.env.ARCHIVES_MEDIA_OCCURRENCE_INPUT;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=()=>JSON.parse(readFileSync(process.env.ARCHIVES_MEDIA_READER_INPUT));
const occurrence=()=>JSON.parse(readFileSync(process.env.ARCHIVES_MEDIA_OCCURRENCE_INPUT));

test('verified media contexts cannot be forged or changed into source routes',()=>{
  for(const value of [null,{},Object.freeze({version:'reader-verified-media-release/1'})])assert.throws(()=>readerMediaSelection(value),/verified media context/);
});
test('real two-image bundle keeps distinct source/derivative identities and exact sanitized bytes',{skip:!real},async()=>{
  const context=await loadReaderMediaRelease(process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY),selection=readerMediaSelection(context),routes=readerMediaRoutes(context);
  assert.equal(selection.bindings.length,2);assert.equal(routes.size,2);
  for(const binding of selection.bindings) {
    assert.equal(binding.view_id,binding.source_object_id);assert.notEqual(binding.source_sha256,binding.derivative_sha256);
    assert.equal(binding.rights_status,'unknown');assert.equal(binding.publication_approved,false);
    assert.equal(hash(routes.get(binding.media_url).bytes),binding.derivative_sha256);
    assert.equal(routes.get(binding.media_url).size,binding.derivative_byte_size);
    assert.ok(!routes.has('/__archive_media/'+binding.source_sha256));
  }
  selection.bindings[0].rights_status='clear';routes.get([...routes.keys()][0]).bytes[0]=0;
  assert.equal(readerMediaSelection(context).bindings[0].rights_status,'unknown');assert.equal(readerMediaRoutes(context).values().next().value.bytes[0],0xff);
});
test('real reader binding preserves texts, review IDs, source view IDs and rejects drift',{skip:!real},async()=>{
  const context=await loadReaderMediaRelease(process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY),model=adaptArchiveExport(source()),bound=bindReaderMedia(model,context);
  assert.deepEqual(bound.dossiers.map(d=>d.texts),model.dossiers.map(d=>d.texts));
  for(const [i,image] of bound.dossiers[0].images.entries()) {
    assert.equal(image.viewId,model.dossiers[0].images[i].viewId);assert.equal(image.sha256,model.dossiers[0].images[i].sha256);assert.equal(image.reviewId,model.dossiers[0].images[i].reviewId);
    assert.equal(image.sourceSha256,image.sha256);assert.notEqual(image.derivativeSha256,image.sourceSha256);
  }
  for(const field of ['viewId','digitalObjectId','sha256','reviewId','associationStatus']) {
    const changed=structuredClone(model);changed.dossiers[0].images[0][field]='drift';assert.throws(()=>bindReaderMedia(changed,context));
  }
  const html=renderReaderHtml(bound,{privatePreview:true});assert.equal(verifyReaderMediaHtml(html,readerMediaSelection(context)),true);
  assert.throws(()=>verifyReaderMediaHtml(html.replace('data-source-sha256="','data-source-sha256="00'),readerMediaSelection(context)));
});
test('real H05 retains candidate box and literal while sharing the identical native derivative',{skip:!real},async()=>{
  const context=await loadReaderMediaRelease(process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY),input=occurrence(),model=prepareOccurrence(input),bound=bindOccurrenceMedia(model,context);
  assert.deepEqual(bound.contextBox,model.contextBox);assert.equal(bound.observedText,'----');assert.equal(bound.sourceSha256,model.sourceSha256);
  const html=renderOccurrence(input,{mediaRelease:context});assert.ok(html.includes('SHA-256 du dérivé affiché'));assert.ok(html.includes(bound.derivativeSha256));
  assert.ok(html.includes(`viewBox="${model.contextBox.x} ${model.contextBox.y} ${model.contextBox.width} ${model.contextBox.height}"`));
  assert.ok(html.includes(`<image href="${bound.mediaUrl}"`));assert.ok(html.includes(`<img src="${bound.mediaUrl}"`));
  assert.ok(!html.includes('/__archive_media/'+model.sourceSha256));
  assert.throws(()=>bindOccurrenceMedia({...model,width:model.height,height:model.width},context),/native frame mismatch/);
});
