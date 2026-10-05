import {readFile,writeFile,mkdir,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname,posix} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const parent=resolve('.private/archives-integration/publication-package-20261004-v33-r2'),source=resolve('.private/archives-integration/o01-obvious-noise-consultation-filter-mini-20261004-v1'),out=resolve('.private/archives-integration/publication-package-20261004-v34'),site=resolve(out,'site');
const sha=b=>createHash('sha256').update(b).digest('hex'),pin=b=>({size_bytes:b.length,sha256:sha(b)}),json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const put=async(n,b)=>{await mkdir(dirname(resolve(out,n)),{recursive:true});await writeFile(resolve(out,n),b,{flag:'wx'});};
try{await lstat(out);throw Error('Fresh v34 required');}catch(e){if(e.code!=='ENOENT')throw e;}
const pb=await readFile(resolve(parent,'assembly.json')),previous=JSON.parse(pb);assert.equal(sha(pb),'bb677877474a1558b6dec52226a0f1c88bfbcd0af8e123c4232015efd3f6c7ac');
const sb=await readFile(resolve(parent,'candidate-seal.json')),seal=JSON.parse(sb);assert.equal(sha(sb),'a9b21597539872d2cb1e52046f5798fe56ff9905d20f9ba33ae93f168fd7cae4');assert(seal.closed);
const fb=await readFile(resolve(source,'freeze.json'));assert.equal(sha(fb),'a0ad84e52533a344cc449c4b0c4ee24032ee8ee280711ee3b1a86b6f80ef8151');
assert.equal(sha(await readFile(resolve(source,'HANDOFF.md'))),'860eb4991db8e3107ad346a322dcac57897b4d78e6ac6489127929c7576f22f6');
const ab=await readFile(resolve(source,'delta-allowlist.json')),allow=JSON.parse(ab);assert.equal(sha(ab),'4f26d645d99678dcb00bab6599f3e2496c140aed6e747a747aa6262fc237ead8');assert.equal(allow.changes.length,3);
const receipt=await readFile(resolve('.private/archives-integration/o01-consultation-filter-root-admission-20261004-v1/verification.json'));assert(JSON.parse(receipt).passed);
const content=new Map();for(const[n,p]of Object.entries(previous.files)){assert(!/[\\:]/.test(n)&&!n.startsWith('/')&&n.split('/').every(x=>x&&x!=='.'&&x!=='..'));const path=resolve(parent,'site',n);assert.equal(await realpath(path),path);const b=await readFile(path);assert.deepEqual(pin(b),p);assert.deepEqual(seal.files['site/'+n],p);content.set(n,b);}
const added=[],modified=[];for(const c of allow.changes){assert(c.path.startsWith('site/'));const n=c.path.slice(5);const b=await readFile(resolve(source,'proposal',c.path));assert.equal(b.length,c.after.bytes);assert.equal(sha(b),c.after.sha256);if(c.operation==='add'){assert(!content.has(n));added.push(n);}else{assert.equal(c.operation,'replace');assert.deepEqual(pin(content.get(n)),{size_bytes:c.before.bytes,sha256:c.before.sha256});modified.push(n);}content.set(n,b);}
const checksumName='runtime/package-checksums.json';const files=Object.fromEntries([...content].map(([n,b])=>[n,pin(b)]));
const checksumBytes=json(Object.fromEntries(Object.entries(files).filter(([n])=>n!==checksumName).sort(([a],[b])=>a.localeCompare(b))));content.set(checksumName,checksumBytes);files[checksumName]=pin(checksumBytes);modified.push(checksumName);added.sort();modified.sort();
const sorted=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
const parentGraphBytes=await readFile(resolve(parent,'api-import-graph.json')),parentGraph=JSON.parse(parentGraphBytes),graph={},external=new Set(),visited=new Set();
const visit=n=>{if(visited.has(n))return;assert(content.has(n),n);visited.add(n);const refs=[];for(const m of content.get(n).toString().matchAll(/(?:\bimport\s*(?:[^'";]*?\s+from\s*)?|\bexport\s+[^'";]*?\s+from\s*)['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)){const spec=m[1]??m[2];if(spec.startsWith('.')){const t=posix.normalize(posix.join(posix.dirname(n),spec));assert(content.has(t));refs.push(t);visit(t);}else{refs.push('external:'+spec);external.add(spec);}}graph[n]=[...new Set(refs)].sort();};
const api=Object.keys(sorted).filter(n=>n.startsWith('api/')&&n.endsWith('.mjs')).sort();api.forEach(visit);assert.equal(visited.size,62);
const helper='scripts/archives-integration/lexical-consultation-filter.mjs',lexical='scripts/archives-integration/lexical-search.mjs';
assert.deepEqual(graph[helper],[]);for(const[n,refs]of Object.entries(parentGraph)){assert.deepEqual(graph[n],n===lexical?[...refs,helper].sort():refs,n);}
const graphObject=Object.fromEntries(Object.entries(graph).sort(([a],[b])=>a.localeCompare(b)));const modules=Object.keys(sorted).filter(n=>n.endsWith('.mjs'));
assert.equal(modules.length,76);assert.equal(Object.keys(sorted).length,488);assert.equal(Object.keys(sorted).filter(n=>n.startsWith('dist/')).length,396);
const inherited=Object.keys(previous.files).filter(n=>!modified.includes(n));assert.equal(inherited.length,484);for(const n of inherited)assert.deepEqual(sorted[n],previous.files[n]);
assert.equal(sorted['runtime/archives/selected-data.json'].sha256,'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a');
const assembly={...previous,parent_assembly_sha256:sha(pb),snapshot_sha256:sha(json(sorted)),files:sorted,delta:{added,modified,removed:[]},o01_consultation_filter:{recorded:535,masked:7,visible:528,source_data_unchanged:true,runtime_graph_modules:62,all_native_modules:76,new_runtime_helper:helper,root_admission:pin(receipt),filter_freeze:pin(fb),public_activation:false}};
for(const[n,b]of content)await put('site/'+n,b);
await put('assembly.json',json(assembly));await put('api-import-graph.json',json(graphObject));
for(const n of [helper,lexical])execFileSync(process.execPath,['--check',resolve(site,n)],{stdio:'pipe'});
const native=[];for(const n of api){const m=await import(pathToFileURL(resolve(site,n)).href);assert.equal(typeof m.default,'function');native.push({path:n,pin:sorted[n],default_type:typeof m.default});}
const schemas=JSON.parse(await readFile(resolve(parent,'api-native-imports.json'))).schema_refs;for(const r of schemas)assert.deepEqual(pin(await readFile(resolve(site,r.target))),r.pin);
await put('api-native-imports.json',json({passed:true,entrypoints:native,local_modules:62,all_native_modules:76,external_specifiers:[...external].sort(),schema_refs:schemas,changed_graph:{added_node:helper,added_edge:{from:lexical,to:helper},all_other_nodes_edges_exact:true},API_invocations:0,DB_connections:0,installation:false}));
const {lexicalConsultationCounts,isLexicalConsultationVisible}=await import(pathToFileURL(resolve(site,helper)).href);const data=JSON.parse(content.get('runtime/archives/selected-data.json'));assert.deepEqual(lexicalConsultationCounts(data.lexical),{recorded:535,visible:528,masked:7});assert.equal(data.text_records.length,166);assert.equal(data.drafts.items.length,992);
const countKind=k=>data.lexical.rows.filter(x=>x.candidate_kind===k&&isLexicalConsultationVisible(x)).length;assert.equal(countKind('person_name_candidate'),106);assert.equal(countKind('place_name_candidate'),191);assert.equal(countKind('title_or_office_candidate'),231);
await put('root-o01-admission.json',receipt);await put('o01-delta-allowlist.json',ab);
await put('composition.json',json({passed:true,parent_assembly:pin(pb),parent_seal:pin(sb),source_freeze:pin(fb),source_allowlist:pin(ab),root_admission:pin(receipt),assembly:pin(json(assembly)),site_files:488,static_files:396,inherited_exact:484,added:added.map(n=>({path:n,after:sorted[n]})),modified:modified.map(n=>({path:n,before:previous.files[n],after:sorted[n]})),removed:[],source_rows:535,visible_rows:528,masked_rows:7,person_visible:106,place_visible:191,title_visible:231,protected_texts:166,protected_versions:300,protected_occurrences:992,protected_archive_jpeg_photos:25,data_exact:true,API_JSON_unchanged:true,legacy_unchanged:true,stores_touched:false,main_service_touched:false,installation:false,public_activation:false}));
await put('composer-snapshot.mjs',await readFile(new URL(import.meta.url)));
console.log(JSON.stringify({out,site_files:488,inherited_exact:484,added,modified,graph_modules:62,native_modules:76,assembly_sha256:sha(json(assembly)),browser_gate_pending:true},null,2));
