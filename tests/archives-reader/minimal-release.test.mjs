import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {test} from 'node:test';
import {prepareMinimalRelease,verifyMinimalRelease,verifyNormalBrowserGate} from '../../scripts/archives/prepare-minimal-release.mjs';
import {createMinimalReleasePreview} from '../../scripts/archives/minimal-release-preview.mjs';

const real=process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY && process.env.ARCHIVES_MEDIA_READER_INPUT && process.env.ARCHIVES_MEDIA_NORMAL_DIRECTORY;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';

test('minimal release requires the qualified normal reader, pending rights and exact H05 frame',{skip:!real},()=>{
  const normal=process.env.ARCHIVES_MEDIA_NORMAL_DIRECTORY;
  const proof=readFileSync(join(normal,'integration-proof.json')),selection=readFileSync(join(normal,'media-release-selection.json')),gate=JSON.parse(readFileSync(join(normal,'browser-verification.json')));
  verifyNormalBrowserGate(gate,proof,selection);
  for(const mutate of [g=>g.passed=false,g=>g.desktop=false,g=>g.mobile=false,g=>g.two_image_zooms=false,g=>g.publication_approved=true,g=>g.rights_review='clear',g=>g.run_integration_sha256='0'.repeat(64),g=>g.h05.exact_word_alignment=true,g=>g.h05.context_box[0]=0,g=>g.h05.native_frame.reverse(),g=>g.h05.display_geometry_equal=false,g=>g.h05.new_lossless_pixel_equality_proven=true,g=>delete g.limits,g=>g.limits=[],g=>g.limits.reverse(),g=>g.limits[0]='Lossless pixel equality proven',g=>g.limits.push('unexpected')]) {
    const changed=structuredClone(gate);mutate(changed);assert.throws(()=>verifyNormalBrowserGate(changed,proof,selection));
  }
});

test('seven-file candidate preserves the one literal, excludes internals, serves only its snapshot and rejects tampering',{skip:!real},async()=>{
  const parent=resolve('.private/archives-mvp'),fixture=mkdtempSync(join(parent,'test-minimal-release-')),output=join(fixture,'candidate');
  let preview;
  try {
    const result=await prepareMinimalRelease({readerPath:process.env.ARCHIVES_MEDIA_READER_INPUT,mediaDirectory:process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY,normalDirectory:process.env.ARCHIVES_MEDIA_NORMAL_DIRECTORY,browserGatePath:join(process.env.ARCHIVES_MEDIA_NORMAL_DIRECTORY,'browser-verification.json'),outputPath:output});
    const bundle=verifyMinimalRelease(output,result.proof_sha256),manifest=bundle.manifest;
    assert.equal(bundle.files.size,7);assert.equal(manifest.dossiers.length,1);assert.equal(manifest.dossiers[0].images.length,2);assert.equal(manifest.dossiers[0].translation,null);
    assert.equal(manifest.publication_approved,false);assert.equal(manifest.rights_status,'unknown');assert.equal(manifest.rights_review,'pending');
    assert.equal(manifest.dossiers[0].original.length,534);assert.equal(hash(manifest.dossiers[0].original),bundle.proof.text_sha256);
    for(const [name,bytes] of bundle.files)if(!name.endsWith('.jpg'))assert.doesNotMatch(bytes.toString('utf8'),/object:path-|text:atelier|candidate:|CLEAN\/|PHD_CORPUS_ROOT|\.private|E\.108|E\.133|E\.113|C07|library|workbook|127\.0\.0\.1|[CZ]:[\\/]/iu);
    assert.throws(()=>verifyMinimalRelease(output,'0'.repeat(64)),/explicit preparation proof/);
    preview=createMinimalReleasePreview({directory:output,proofSha256:result.proof_sha256});const origin=await preview.listen(0);
    const html=await fetch(origin);assert.equal(html.status,200);assert.ok(!html.headers.get('Content-Security-Policy').includes('unsafe-'));
    for(const image of manifest.dossiers[0].images) {
      const response=await fetch(new URL(image.href,origin));assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),image.sha256);
      assert.equal((await fetch(new URL(image.href,origin),{method:'HEAD'})).status,200);
    }
    for(const name of ['/preparation-proof.json','/.private/archives-mvp/','/library/','/archives/textes/','/archives/catalogue/','/archives/formes/','/__archive_media/'+bundle.proof.source_derivative_bindings[0].source_sha256,'/archives/?extra=1'])assert.equal((await fetch(new URL(name,origin))).status,404);
    assert.equal((await fetch(origin,{method:'POST'})).status,405);
    const image=manifest.dossiers[0].images[0],file=join(output,'public',image.href.slice(1));
    writeFileSync(file,'tampered');assert.throws(()=>verifyMinimalRelease(output,result.proof_sha256),/file hash differs/);
    assert.equal(hash(Buffer.from(await (await fetch(new URL(image.href,origin))).arrayBuffer())),image.sha256);
    writeFileSync(file,bundle.files.get(image.href));
    writeFileSync(join(output,'public','private-note.txt'),'private');assert.throws(()=>verifyMinimalRelease(output,result.proof_sha256),/extra or missing/);
    const manifestFile=join(output,'public','archives','manifest.json'),changed=structuredClone(manifest);changed.rights_status='clear';writeFileSync(manifestFile,json(changed));assert.throws(()=>verifyMinimalRelease(output,result.proof_sha256));
    await assert.rejects(prepareMinimalRelease({readerPath:process.env.ARCHIVES_MEDIA_READER_INPUT,mediaDirectory:process.env.ARCHIVES_MEDIA_CANDIDATE_DIRECTORY,normalDirectory:process.env.ARCHIVES_MEDIA_NORMAL_DIRECTORY,browserGatePath:join(process.env.ARCHIVES_MEDIA_NORMAL_DIRECTORY,'browser-verification.json'),outputPath:output}),/new ignored/);
  } finally {
    if(preview)await new Promise((accept,reject)=>preview.server.close(error=>error?reject(error):accept()));
    const target=resolve(fixture),part=relative(parent,target);assert.ok(part && !isAbsolute(part) && part!=='..' && !part.startsWith('..'+sep) && part.startsWith('test-minimal-release-'));rmSync(target,{recursive:true,force:true});
  }
});
