import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadDraftBridge } from '../../scripts/archives/draft-bridge.mjs';
import { renderSafeMarkdown } from '../../scripts/archives/safe-markdown.mjs';
const root = 'Z:/Codex/repos/PHD-Maine-paleography-harness/data/private/transcription-campaign/bridge-20261003-v1';
test('source Markdown preserves uncertainty and cannot introduce active HTML, image or link',()=>{
  const html = renderSafeMarkdown('# Titre [incertain ?]\n\n**[Loys ?]** & <img src=x onerror=alert(1)>\n[ouvrir](javascript:alert(1))\n![x](https://outside.invalid/x)');
  assert.match(html, /<h4>Titre \[incertain \?\]<\/h4>/u); assert.match(html, /<strong>\[Loys \?\]<\/strong>/u);
  assert.ok(!/<(?:img|script|a)\b/u.test(html)); assert.ok(html.includes('&lt;img')); assert.ok(html.includes('[ouvrir](javascript:'));
});
test('alias evidence refuses a duplicated divergent segment even when inputs are consistently rehashed', {skip:!existsSync(root+'/e133/checksums.json')}, async t=>{
  const temporaryRoot = await realpath(tmpdir()), directory = await mkdtemp(join(temporaryRoot,'archive-alias-test-'));
  t.after(async()=>{const target=await realpath(directory);assert.equal(dirname(target).toLowerCase(),temporaryRoot.toLowerCase());assert.ok(target.toLowerCase().startsWith(join(temporaryRoot,'archive-alias-test-').toLowerCase()));await rm(target,{recursive:true,force:true});});
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  const originalHarness='Z:/Codex/repos/PHD-Maine-paleography-harness';
  const localHarness=join(directory,'harness'), localBridge=join(localHarness,'data/private/transcription-campaign/bridge/e133');
  mkdirSync(localBridge,{recursive:true});
  const manifest=JSON.parse(readFileSync(root+'/lois-e133.inputs.json','utf8'));
  const bridge=JSON.parse(readFileSync(root+'/e133/reader-bridge.json','utf8'));
  const queue=readFileSync(root+'/e133/review-queue.json');
  for(const entry of manifest.entries.filter(entry=>['package','source_text'].includes(entry.role))){const path=join(localHarness,entry.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,readFileSync(join(originalHarness,entry.path)));}
  const persist=()=>{const bridgeBytes=Buffer.from(JSON.stringify(bridge));writeFileSync(join(localBridge,'reader-bridge.json'),bridgeBytes);writeFileSync(join(localBridge,'review-queue.json'),queue);writeFileSync(join(localBridge,'checksums.json'),JSON.stringify({'reader-bridge.json':digest(bridgeBytes),'review-queue.json':digest(queue)}));writeFileSync(join(dirname(localBridge),'lois-e133.inputs.json'),JSON.stringify(manifest));};
  persist();assert.equal(loadDraftBridge(localBridge).sourceAliasEvidence.bindings.length,3);
  const packageEntry=manifest.entries.find(entry=>entry.role==='package'), path=join(localHarness,packageEntry.path), sourcePackage=JSON.parse(readFileSync(path,'utf8'));
  sourcePackage.segments.push({...sourcePackage.segments[0],working_transcription:{...sourcePackage.segments[0].working_transcription,text:'Divergent invented text'}});
  const bytes=Buffer.from(JSON.stringify(sourcePackage));writeFileSync(path,bytes);packageEntry.sha256=digest(bytes);bridge.verified_input_hashes[packageEntry.path]=digest(bytes);persist();
  assert.throws(()=>loadDraftBridge(localBridge),/segment identity.*ambiguous/u);
});
test('real bridge hashes, draft texts, sources and opaque IDs retained for both lots', {skip:!existsSync(root+'/e133/checksums.json') || !existsSync(root+'/e113/checksums.json')},()=>{
  const first = loadDraftBridge(root+'/e133'), second = loadDraftBridge(root+'/e113');
  for (const [draft,photos,fragments,occurrences] of [[first,4,97,416],[second,13,37,576]]) {
    assert.equal(draft.dossier.candidateViews.length, photos); assert.equal(draft.dossier.fragments.length,fragments); assert.equal(draft.queue.entries.length,occurrences);
    assert.equal(draft.dossier.texts[0].literal,draft.bridge.text_assets.original_markdown.text);
    assert.equal(draft.dossier.texts[0].translation.literal,draft.bridge.text_assets.modern_markdown.text);
    assert.equal(draft.dossier.actId,null); assert.equal(draft.dossier.images.length,0);
    for (const fragment of draft.dossier.fragments) assert.ok(fragment.imageObjectIds.every(id=>draft.bridge.images.some(image=>image.object_id===id)));
  }
  const page3 = first.dossier.fragments.find(fragment=>fragment.id.includes('p3-entry-21'));
  assert.ok(page3 && page3.label.includes('entrée proposée 20')); assert.ok(!page3.label.includes('entrée proposée 21'));
  assert.ok(second.dossier.candidateViews.every(image=>!image.label.includes('ordre proposé')));
});
