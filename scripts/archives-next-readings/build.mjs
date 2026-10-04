import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {composeNextReading,digest} from './adapter.mjs';
const moduleRoot=dirname(fileURLToPath(import.meta.url));
export async function prepareNextReadingRun({outputPath,...options}){
 const composed=composeNextReading(options),base=resolve('.private/archives-next-readings'),output=resolve(outputPath);
 if(dirname(output)!==base)throw Error('Next reading: fresh run must be directly under private archives-next-readings');
 await mkdir(base,{recursive:true});if(await realpath(base)!==base)throw Error('Next reading: private base link refused');
 const files=new Map([['reader.html',Buffer.from(composed.html,'utf8')]]);
 if(composed.candidateAdded){files.set('card.css',await readFile(join(moduleRoot,'card.css')));files.set('card.js',await readFile(join(moduleRoot,'card.js')));}
 const outputs=Object.fromEntries([...files].map(([name,bytes])=>[name,{sha256:digest(bytes),bytes:bytes.length}]));
 const code={};for(const name of ['adapter.mjs','build.mjs','card.css','card.js'])code[name]=digest(await readFile(join(moduleRoot,name)));
 await mkdir(output);for(const [name,bytes]of files)await writeFile(join(output,name),bytes,{flag:'wx'});
 const proof={version:'archive-next-reading-build/1',scope:composed.scope??'disabled',candidate_added:composed.candidateAdded,parent_sha256:options.parentSha256,reader_sha256:outputs['reader.html'].sha256,additional_assets:composed.additionalAssets.map(asset=>({...asset,run_file:asset.route.endsWith('.css')?'card.css':'card.js'})),text_hashes:composed.textHashes??[],line_counts:composed.lineCounts??[],photo_binding:composed.photoBinding??null,outputs,code_hashes:code,originals_read:false,image_bytes_read:false,human_decisions:0,canonical_act_id:null,publication_approved:false,other_parent_routes_unchanged:true};
 await writeFile(join(output,'build-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});return {directory:output,proofSha256:digest(await readFile(join(output,'build-proof.json'))),proof};
}
