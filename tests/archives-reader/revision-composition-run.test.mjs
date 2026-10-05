import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRevisionCompositionPreview,prepareRevisionCompositionRun} from '../../scripts/archives/revision-composition-run.mjs';
const configPath=process.env.PHD_REVISION_COMPOSITION_CONFIG;
let config;
if(configPath){const args=[...process.argv];process.argv[2]='config-only';({config}=await import(pathToFileURL(resolve(configPath))));process.argv=args;}
test('fresh composition serves exact snapshot and preserved parent routes with request guards',{skip:!config},async()=>{
 const preview=await createRevisionCompositionPreview(config),url=await preview.listen(0),origin=new URL(url).origin;
 try {
  for(const [path,file]of [['/archives/','reader.html'],['/css/archives-revision-joins.css',null],['/js/archives-revision-joins.js',null],['/archives/recherche/','search.html']]){const response=await fetch(origin+path);assert.equal(response.status,200);const body=Buffer.from(await response.arrayBuffer());if(file)assert.deepEqual(body,await readFile(config.directory+'/'+file));assert.ok(!response.headers.get('content-security-policy').includes('unsafe-'));}
  for(const path of ['/archives/catalogue/','/archives/textes/','/__draft_review_data'])assert.equal((await fetch(origin+path)).status,200);
  for(const [path,options,status]of [['/archives/',{method:'POST'},405],['/archives/',{headers:{Origin:'https://foreign.invalid'}},403],['/archives/?extra=1',{},404],['/.private/reader-export.json',{},404]])assert.equal((await fetch(origin+path,options)).status,status);
 }finally{await new Promise(resolve=>preview.server.close(resolve));}
});
test('refuses changed state, source pins, counts, code, output and omitted parent',{skip:!config},async()=>{
 const dir=await mkdtemp(resolve('.private/archives-mvp/revision-negative-'));
 await cp(config.directory,dir,{recursive:true,errorOnExist:false});const proofPath=dir+'/integration-proof.json',original=JSON.parse(await readFile(proofPath));
 const mutations=[value=>value.active_version_id='invented',value=>value.human_memory.push('invented'),value=>value.accepted_h07.export_sha256='0'.repeat(64),value=>value.counts.versions++,value=>value.counts.proposals_applied=1,value=>value.code_hashes['js/archives-revision-joins.js']='0'.repeat(64),value=>value.output_hashes['reader.html']='0'.repeat(64),value=>delete value.output_hashes['parent-reader.html'],value=>value.site_pilot={path:'invented'},value=>delete value.output_hashes['h07-reader-export.json'],value=>delete value.output_hashes['h07-binding-proof.json'],value=>delete value.output_hashes['h07-review-verification.json'],value=>delete value.output_hashes['h07-full-input-manifest.json'],value=>value.output_hashes['extra.json']='0'.repeat(64),value=>value.counts.excluded_fragments++];
 for(const mutate of mutations){const proof=structuredClone(original);mutate(proof);await writeFile(proofPath,JSON.stringify(proof));await assert.rejects(()=>createRevisionCompositionPreview({...config,directory:dir}),/Revision composition run:/u);}
 const restamped=structuredClone(original);await writeFile(dir+'/h07-reader-export.json','changed');restamped.output_hashes['h07-reader-export.json']=createHash('sha256').update('changed').digest('hex');await writeFile(proofPath,JSON.stringify(restamped));await assert.rejects(()=>createRevisionCompositionPreview({...config,directory:dir}),/composition closed buffer drift/u);
 await writeFile(dir+'/h07-reader-export.json',await readFile(config.directory+'/h07-reader-export.json'));
 await writeFile(proofPath,JSON.stringify(original));await writeFile(dir+'/reader.html','changed');await assert.rejects(()=>createRevisionCompositionPreview({...config,directory:dir}),/composition file drift/u);
});
test('full cannot be prepared without the admitted 1+1 UI proof',{skip:!config},async()=>{
 await assert.rejects(()=>prepareRevisionCompositionRun({context:config.context,phase:'full',outputPath:'.private/archives-mvp/revision-refused-full'}),/passed site 1\+1 proof required/u);
});
