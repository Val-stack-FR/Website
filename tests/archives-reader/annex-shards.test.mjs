import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,copyFile,rm,readdir} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {loadAnnexSearchShards,acceptedAnnexModel,acceptedAnnexEvidence,revalidateAnnexSearchShards,renderAcceptedAnnexSearch} from '../../scripts/archives/annex-shards-release.mjs';
import {filterAnnexShardCards,prepareAnnexSearchShards} from '../../scripts/archives/render-annex-search.mjs';
import {syntheticAnnexIndex} from './fixtures/synthetic-annex-index.mjs';
function syntheticShards(){
 const first=syntheticAnnexIndex(),second=structuredClone(first),ids=new Set();
 for(const [items,key]of [[second.fiches,'fiche_id'],[second.dates,'date_id'],[second.entries,'entry_id'],[second.locators,'evidence_locator_id'],[second.sources,'digital_object_id']])for(const item of items)ids.add(item[key]);
 const copy=value=>typeof value==='string'&&ids.has(value)?value+'-second':Array.isArray(value)?value.map(copy):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='fiche_n'?String(Number(item)+1000):copy(item)])):value;
 const next=copy(second);next.package_id+='-second';return [first,next];
}
for(const field of ['label','person_heading'])test('exact names and all fields find a synthetic '+field+' absent from entries',()=>{
 const indexes=syntheticShards(),literal='Nom inventé uniquement dans '+field;indexes[1].fiches[0][field]=literal;
 const model=prepareAnnexSearchShards(indexes);for(const scope of ['name','all'])assert.deepEqual(filterAnnexShardCards(model.cards,literal,scope,{exact:true}).map(x=>x.number),[indexes[1].fiches[0].fiche_n]);
});
test('synthetic two-shard projection refuses historical entry and ambiguity promotions',()=>{
 for(const mutate of [x=>x.entries[0].identity_status='confirmed',x=>x.entries.find(e=>e.scope==='variant').identity_status='resolved',x=>x.ambiguities[0].status='resolved',x=>x.ambiguities[0].merged=true]){
  const indexes=syntheticShards();mutate(indexes[0]);assert.throws(()=>prepareAnnexSearchShards(indexes),/Shard .*status/);
 }
});
const directory=process.env.ANNEX_SHARD_DIRECTORY,reviewDirectory=process.env.ANNEX_SHARD_REVIEW_DIRECTORY;
test('real closed two-shard metadata: exact queries, every projected citation and refusal gates without CSV access', {skip:!directory||!reviewDirectory}, async t=>{
 const context=await loadAnnexSearchShards({directory,reviewDirectory}),model=acceptedAnnexModel(context),evidence=acceptedAnnexEvidence(context);
 assert.equal(model.cards.length,10);assert.equal(new Set(model.cards.map(x=>x.sourcePackageId)).size,2);
 const originals=[JSON.parse(await readFile(join(directory,'query-index.json'))),JSON.parse(await readFile(join(directory,'extension/query-index.json')))];
 const before=JSON.stringify(originals);prepareAnnexSearchShards(originals);assert.equal(JSON.stringify(originals),before);
 const queries=[['Guillaume de Tucé','name',['217','225']],['Guillaume (IV) de Tucé','name',['217','224']],['Baudouin de Tucé','name',['28','69']],
 ['Louis de Tucé','name',['580','581']],['Pierre de Tucé','name',['686']],['Adam de Saint-Mars','name',['2']],['La Mousse (N.L)','place',['2']],
 ['Lanthonnière (Jail.)','place',['69']],['Écuyer','title',['2','217','224','686']],['Châtellenie de Tucé','jurisdiction',['217','69','686']],
 ['Seigneur de Tucé et baron de Milesse','holding',['581']]];
 for(const [query,scope,numbers] of queries)assert.deepEqual(filterAnnexShardCards(model.cards,query,scope,{exact:true}).map(x=>x.number).sort(),numbers.sort(),query);
 assert.equal(filterAnnexShardCards(model.cards,'Écuyer','title',{exact:false}).length,7);
 for(const card of model.cards){
  const source=originals.find(x=>x.package_id===card.sourcePackageId),row=source.fiches.find(x=>x.fiche_id===card.id);
  assert.equal(row.fiche_n,card.number);assert.equal(card.identityStatus,'unresolved');assert.equal(card.reviewStatus,'unreviewed');
  for(const [scope,entries] of Object.entries(card.groups))for(const entry of entries){
   const raw=source.entries.find(x=>x.entry_id===entry.id),locator=source.locators.find(x=>x.evidence_locator_id===raw.evidence_locator_id),object=source.sources.find(x=>x.digital_object_id===locator.digital_object_id);
   assert.equal(entry.literal,raw.literal);assert.equal(entry.scope,scope);assert.deepEqual(entry.provenance,{table:locator.table,ficheNumber:row.fiche_n,recordNumber:locator.record_number,field:locator.field,sha256:object.sha256});
   if(scope==='variant'){assert.equal(raw.source_occurrence_in_fiche,false);assert.equal(entry.indexOnly,true);}
  }
  for(const citation of card.citations){const raw=row.source_citations.find(x=>x.evidence_locator_id===citation.evidence_locator_id),locator=source.locators.find(x=>x.evidence_locator_id===raw.evidence_locator_id),object=source.sources.find(x=>x.digital_object_id===locator.digital_object_id);
   assert.equal(citation.literal,raw.literal);assert.equal(citation.field,raw.field);assert.deepEqual(citation.provenance,{table:locator.table,ficheNumber:row.fiche_n,recordNumber:locator.record_number,field:locator.field,sha256:object.sha256});}
 }
 const html=renderAcceptedAnnexSearch(context);assert.equal((html.match(/data-annex-card/g)||[]).length,10);assert.ok(html.includes('Expression exacte'));
 assert.ok(html.includes('/js/archives-annex-shards.js'));assert.equal(/<script(?![^>]*src=)|\son[a-z]+=|\sstyle=|<style|data\/private|relative_path|logical_uri/.test(html),false);
 assert.throws(()=>acceptedAnnexEvidence({...context}));const copy=acceptedAnnexModel(context);copy.cards[0].heading='tamper';assert.notEqual(acceptedAnnexModel(context).cards[0].heading,'tamper');
 assert.throws(()=>prepareAnnexSearchShards([originals[0],originals[0]]),/distinct/);
 const taskRoot=resolve('.private/archives-mvp'),temporary=await mkdtemp(join(taskRoot,'annex-shards-test-')),part=relative(taskRoot,temporary);
 assert.ok(part && part!=='..' && !part.startsWith('..'+sep) && !isAbsolute(part));
 const source=join(temporary,'source'),review=join(temporary,'review');await mkdir(source);await mkdir(join(source,'extension'));await mkdir(review);
 try{
  await copyFile(join(directory,'query-index.json'),join(source,'query-index.json'));await copyFile(join(directory,'extension/query-index.json'),join(source,'extension/query-index.json'));
  for(const entry of await readdir(reviewDirectory,{withFileTypes:true}))if(entry.isFile())await copyFile(join(reviewDirectory,entry.name),join(review,entry.name));
  const load=()=>loadAnnexSearchShards({directory:source,reviewDirectory:review}),live=await load();
  async function change(name,attempt=load){const file=join(temporary,name),bytes=await readFile(file);try{await writeFile(file,Buffer.concat([bytes,Buffer.from('\n')]));await assert.rejects(attempt(),/pin drift|output hash drift/);}finally{await writeFile(file,bytes);}}
  await t.test('core and extension hashes independently fail closed',async()=>{await change('source/query-index.json');await change('source/extension/query-index.json');});
  await t.test('independent review and handoff cannot be replaced',async()=>{await change('review/verification.json');await change('review/HANDOFF.md');await change('review/tests.json');});
  await t.test('review alteration after context is refused on revalidation',async()=>{await change('review/verification.json',()=>revalidateAnnexSearchShards(live));await revalidateAnnexSearchShards(live);});
  assert.equal(evidence.originals_read,false);assert.equal(evidence.csv_tables_read,false);assert.equal(evidence.publication_approved,false);
 }finally{await rm(temporary,{recursive:true,force:true});}
});
