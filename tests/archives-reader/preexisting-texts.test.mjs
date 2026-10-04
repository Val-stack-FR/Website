import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildPreexistingTextIndex, loadPreexistingTextIndex, renderPreexistingText, renderPreexistingTexts } from '../../scripts/archives/preexisting-texts.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const pins={indexSha256:hash('invented index'),coverageSha256:hash('invented coverage')};
const escape = value => value.replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])).replaceAll('\r','&#13;');
function fixture() {
  const records=['\r\n<script>alert("invented")</script>\r\nNote & texte', '', '\r\n<script>alert("invented")</script>\r\nNote & texte'].map((text,i)=>({
    format:'private-c07-reader-text/0.1.0',object_id:'object:path-'+hash('invented path '+i),occurrence_id:'text-occurrence:'+hash('invented occurrence '+i),transcription_id:'transcription:'+hash('invented transcription '+i),text_digital_object_id:'digital-object:'+hash(text),source_sha256:hash(text),source_byte_size:Buffer.byteLength(text),source_empty:text==='',source_encoding:'utf-8-sig',encoding_provenance:{status:'unvalidated_hypothesis',basis:'Invented test fixture',validated_as_authentic_reading:false},text,review_status:'preexisting-unreviewed',rights_status:'unknown',publication_status:'private',catalogue_discovery_status:'unknown',act_id:null,document_id:null,photo_ids:[],modern_french:null
  }));
  const coverage=records.map((record,i)=>({schema_version:'coverage-object/1.0.0',object_id:record.object_id,object_id_basis:'Invented path ID',logical_path:`CLEAN/Test E.108/${i===2?'Dossier 10':'Dossier 2'}/Note ${i}.TXT`,path_provenance:'Invented fixture',collection:'CLEAN',extension:'.TXT',size_bytes:record.source_byte_size,inventory_observed_at:'2026-10-03',discovery_role:'other_text_or_document',role_basis:'extension only',sha256:record.source_sha256,hash_freshness:'historical_inventory_hash_not_rechecked',candidate_groups:[],status:'unknown',canonical_link_status:'not_in_examined_canonical_links',archive_content_inspected:false,rights_status:'unknown'}));
  return {records,coverage};
}

test('joins exact object/hash/size/state, refusing filename or hash substitution',()=>{
  const f=fixture();
  for(const mutate of [x=>x[0].object_id='object:path-'+hash('wrong'),x=>x[0].sha256=hash('wrong'),x=>x[0].size_bytes++,x=>x[0].status='existing_text',x=>x[0].logical_path='CLEAN/../Note.TXT',x=>x[2].logical_path=x[0].logical_path,x=>x.push({...x[0]})]) {
    const changed=structuredClone(f.coverage);mutate(changed);assert.throws(()=>buildPreexistingTextIndex(f.records,changed,pins));
  }
  assert.doesNotThrow(()=>buildPreexistingTextIndex(f.records,f.coverage,pins));
});

test('preserves duplicate occurrences, empty files and literal escaped text without promotion',()=>{
  const f=fixture();f.records[0].encoding_provenance.basis='Private locator Z:\\private\\corpus.txt';
  const index=buildPreexistingTextIndex(f.records,f.coverage,pins);
  for(const record of f.records) {
    const html=renderPreexistingText(index,new URLSearchParams({object_id:record.object_id}));
    assert.ok(html.includes(escape(record.object_id)));assert.ok(html.includes(record.occurrence_id));assert.ok(html.includes(record.transcription_id));
    assert.ok(html.includes('preexisting-unreviewed'));assert.ok(html.includes('Aucune traduction française moderne'));assert.ok(!html.includes('Z:\\private'));
    if(record.source_empty) assert.ok(html.includes('Fichier vide : aucun texte'));
    else { assert.ok(html.includes(escape(record.text)));assert.ok(!html.includes('<script>')); }
  }
  const page=renderPreexistingTexts(index,new URLSearchParams({folder:'CLEAN/Test E.108'}));
  assert.ok(page.indexOf('>Dossier 2</a>')<page.indexOf('>Dossier 10</a>'));
  assert.ok(page.includes('3 fichiers accessibles'));
  f.records[0].text='Mutated later';f.records[0].encoding_provenance.status='accepted';
  assert.ok(!renderPreexistingText(index,new URLSearchParams({object_id:f.records[0].object_id})).includes('Mutated later'));
});

test('selection is explicit, bounded and opaque; query fields and historical states fail closed',()=>{
  const f=fixture();
  const index=buildPreexistingTextIndex(f.records,f.coverage,{...pins,objectIds:[f.records[0].object_id]});
  assert.equal(renderPreexistingText(index,new URLSearchParams({object_id:f.records[1].object_id})),null);
  assert.throws(()=>renderPreexistingTexts({...index}));
  for(const params of ['page_size=51','folder=CLEAN%2F..%2FTest','query=one&query=two','extra=1','page=500']) assert.throws(()=>renderPreexistingTexts(index,new URLSearchParams(params)));
  for(const params of ['object_id=wrong','object_id='+f.records[0].object_id+'&path=secret','object_id='+f.records[0].object_id+'&object_id='+f.records[0].object_id]) assert.throws(()=>renderPreexistingText(index,new URLSearchParams(params)));
  for(const mutate of [x=>x[0].act_id='act:invented',x=>x[0].modern_french='Invented translation',x=>x[0].photo_ids=['object:invented'],x=>x[0].publication_status='public',x=>x[0].review_status='accepted',x=>x[0].source_empty=true,x=>x[0].encoding_provenance.validated_as_authentic_reading=true,x=>x.push({...x[0]})]) {
    const changed=structuredClone(f.records);mutate(changed);assert.throws(()=>buildPreexistingTextIndex(changed,f.coverage,pins));
  }
  const changed=structuredClone(f.records);changed[2].text='Different literal';assert.throws(()=>buildPreexistingTextIndex(changed,f.coverage,pins),/divergent/);
  const splitContent=structuredClone(f.records);splitContent[2].text_digital_object_id='digital-object:'+hash('split identical content');assert.throws(()=>buildPreexistingTextIndex(splitContent,f.coverage,pins),/divergent digital object/);
});

const real=process.env.C07_READER_DIRECTORY && process.env.C07_COVERAGE_DIRECTORY;
test('real three-case gate and all 166 exact rendered texts retain provenance and distinct occurrences',{skip:!real},()=>{
  const options={indexPath:join(process.env.C07_READER_DIRECTORY,'reader-text-index.jsonl'),indexSha256:'9a0f3b57aea6c21f72132ef1c8af58564eface9f1ca9d267942718fbac772afe',coverageDirectory:process.env.C07_COVERAGE_DIRECTORY,coverageChecksumsSha256:'1c20bfb562d88a36e21fd26045d10ddac173e844b376800728054d0a7577b1dc'};
  const selected=['object:path-01ed1dd4e38108620dc86e62da68de7373dbcc17ebeddb9d4128ea2f7a02a017','object:path-79c3e538cf1042fd914e8ebd3115afc9fddd5c7f3d09288effe8e3a12234ae84','object:path-14a9e08e5231b039f850113e45a1fe4055479d7aa9dffad2d91dca572e1889d3'];
  const gate=loadPreexistingTextIndex({...options,objectIds:selected});assert.ok(renderPreexistingTexts(gate).includes('3 fichiers accessibles'));
  for(const object_id of selected) assert.ok(renderPreexistingText(gate,new URLSearchParams({object_id})).includes(object_id));
  const all=loadPreexistingTextIndex(options);assert.ok(renderPreexistingTexts(all).includes('166 fichiers accessibles'));
  const records=readFileSync(options.indexPath,'utf8').trimEnd().split(/\r?\n/u).map(JSON.parse);
  for(const record of records) {
    const html=renderPreexistingText(all,new URLSearchParams({object_id:record.object_id}));
    assert.ok(html.includes(record.occurrence_id));assert.ok(html.includes(record.source_sha256));
    if(record.source_empty) assert.ok(html.includes('Fichier vide : aucun texte'));
    else assert.equal(html.match(/<div class="archive-preexisting-literal" id="preexisting-text">([\s\S]*?)<\/div>/u)?.[1],escape(record.text));
    assert.ok(!/\bon\w+=|<script|<img/iu.test(html));
  }
  assert.throws(()=>loadPreexistingTextIndex({...options,indexSha256:'0'.repeat(64)}),/hash changed/);
});
