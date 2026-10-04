import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {prepareRevisionFixture,renderRevisionFixture} from '../../scripts/archives/revision-reader.mjs';
import {loadRevisionFixture,revisionFixtureModel,revisionFixtureEvidence,createRevisionFixturePreview} from '../../scripts/archives/revision-fixture.mjs';
const directory=process.env.REVISION_FIXTURE_DIRECTORY,reviewDirectory=process.env.REVISION_FIXTURE_REVIEW_DIRECTORY;
test('accepted invented fixture: nine exact editions, unchanged photo descriptors, excluded fragment and unapplied proposals',{skip:!directory||!reviewDirectory},async()=>{
 const context=await loadRevisionFixture({directory,reviewDirectory}),input=JSON.parse(await readFile(join(directory,'reader-export.json'))),before=JSON.stringify(input),model=prepareRevisionFixture(input);
 assert.equal(JSON.stringify(input),before);assert.equal(model.fragments.length,3);assert.equal(model.excluded.length,1);assert.equal(model.fragments.flatMap(f=>f.versions).length,9);
 for(const fragment of model.fragments){assert.deepEqual(fragment.versions.map(v=>v.edition),['first-draft','rereading','modern-french']);for(const version of fragment.versions){assert.equal(version.text_exact,input.versions.find(v=>v.id===version.id).text_exact);assert.deepEqual(version.image_evidence,fragment.versions[0].image_evidence);}}
 assert.equal(model.fragments.flatMap(f=>f.proposals).length,2);assert.ok(model.fragments.flatMap(f=>f.proposals).every(p=>p.applied===false));
 const html=renderRevisionFixture(input);assert.equal((html.match(/data-version-id=/g)||[]).length,9);assert.ok(html.includes('&#13;&#10;'));assert.ok(html.includes('é'));assert.ok(!html.includes(input.fragments.find(f=>f.selection==='excluded').id));assert.ok(!/<img|<style|\sstyle=|\son[a-z]+=|<script(?![^>]*src=)/u.test(html));
 assert.ok(html.includes('Changements partiels suggérés — non appliqués'));assert.ok(html.includes('sans image'));assert.equal(revisionFixtureEvidence(context).real_connection_validated,false);assert.throws(()=>revisionFixtureModel({...context}),/accepted fixture context/);
 const copy=revisionFixtureModel(context);copy.fragments[0].versions[0].text_exact='altered';assert.notEqual(revisionFixtureModel(context).fragments[0].versions[0].text_exact,'altered');
});
test('real scope, active edition, edited old text, applied replacements and invented photo crop fail closed',{skip:!directory||!reviewDirectory},async()=>{
 const input=JSON.parse(await readFile(join(directory,'reader-export.json')));
 for(const mutate of [x=>x.scope='derived-draft',x=>x.fragments[0].active_version_id=x.fragments[0].version_ids[1],x=>x.versions[0].text_exact+='altered',x=>x.replacement_proposals[0].applied=true,x=>x.replacement_proposals[0].from_span.start++,x=>x.versions[0].image_evidence[0].region={x:1,y:2},x=>x.versions[0].human_decision='accepted',x=>x.versions[0].ambiguities.push({entity_id:'person:invented',reading_status:'confirmed',identification_status:'resolved'}),x=>x.versions[0].source_locator.container_text_sha256_utf8='0'.repeat(64),x=>x.versions[0].source_locator.span.start++,x=>x.versions[0].source_locator.byte_span.end++,x=>x.versions[0].source_locator.kind='json-string']){const altered=structuredClone(input);mutate(altered);assert.throws(()=>prepareRevisionFixture(altered),/Revision fixture:/);}
});
test('new fixture service serves only invented page and two pinned assets; fresh startup and proof refusals',{skip:!directory||!reviewDirectory||!process.env.REVISION_FIXTURE_RUN},async t=>{
 const fixtureContext=await loadRevisionFixture({directory,reviewDirectory}),run=resolve(process.env.REVISION_FIXTURE_RUN),config={fixtureContext,directory:run},preview=await createRevisionFixturePreview(config);t.after(()=>new Promise(yes=>preview.server.close(yes)));
 const origin=new URL(await preview.listen()).origin;
 for(const [path,expected,options]of [['/demo/versions/',200],['/css/archives-revisions.css',200],['/js/archives-revisions.js',200],['/reader-export.json',404],['/integration-proof.json',404],['/archives/',404],['/demo/versions/?q=real',404],['/demo/versions/',405,{method:'POST'}],['/demo/versions/',403,{headers:{origin:'https://foreign.invalid'}}]])assert.equal((await fetch(origin+path,options)).status,expected,path);
 const output=resolve(process.env.REVISION_FIXTURE_NEGATIVE_OUTPUT);assert.equal(join(resolve('.private/archives-mvp'),output.split(/[\\/]/u).at(-1)),output);await mkdir(output);
 const proof=JSON.parse(await readFile(join(run,'integration-proof.json')));await writeFile(join(output,'reader.html'),await readFile(join(run,'reader.html')),{flag:'wx'});
 for(const mutate of [x=>x.scope='derived-draft',x=>x.active_version_id='version:active',x=>x.publication_approved=true,x=>x.accepted_fixture.real_connection_validated=true,x=>x.code_hashes['js/archives-revisions.js']='0'.repeat(64),x=>x.canonical_decisions='',x=>x.canonical_decisions={length:0},x=>x.human_memory='',x=>x.human_memory={length:0}]){const altered=structuredClone(proof);mutate(altered);await writeFile(join(output,'integration-proof.json'),JSON.stringify(altered));await assert.rejects(()=>createRevisionFixturePreview({...config,directory:output}),/Revision fixture:/);}
 await writeFile(join(output,'integration-proof.json'),JSON.stringify(proof));await writeFile(join(output,'reader.html'),'tampered');await assert.rejects(()=>createRevisionFixturePreview({...config,directory:output}),/pin drift/);
});
