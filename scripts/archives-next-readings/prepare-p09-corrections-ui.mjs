import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import assert from 'node:assert/strict';
import {digest,renderP09CorrectionsPage,P09_PARENT_PAGE_SHA256,P09_D14_FORM_SHA256,P09_D14_SELECTION_SHA256} from './p09-corrections-renderer.mjs';

const attempt=resolve('.private/archives-next-readings/p09-corrections-ui-20261004-v1'),root=join(attempt,'reviewed-r2');
const parent=resolve('.private/archives-integration/publication-package-20261004-v11');
const d14='Z:/Codex/repos/Website-archives-corrections/.archive-corrections-private/d14-p09-corrections-ae8f65bb-c7f6-4c90-92f7-6928af6b96cd';
const serialize=value=>Buffer.from(JSON.stringify(value,null,2)+'\n'),pin=bytes=>({sha256:digest(bytes),bytes:bytes.length});
const pinned=async(path,sha256)=>{const bytes=await readFile(path);assert.equal(digest(bytes),sha256,path);return bytes;};
const parentAssemblySha='bfdc66ad6e1d4acafa37ddf38adff62fef772006a1563a17e8bf74f96a822c40';
await pinned(join(parent,'assembly.json'),parentAssemblySha);
const parentBytes=await pinned(join(parent,'site/dist/archives/corrections/index.html'),P09_PARENT_PAGE_SHA256);
const d14Handoff=await pinned(join(d14,'HANDOFF.md'),'7db2d1794e6028c54a50764012d7d6a1335ef69a1857dd66e3db7de1888a8ca5');
const modules=join(d14,'deployment-overlay/scripts/archive-corrections/public-p09');
const formAdapterBuffer=await pinned(join(modules,'form-adapter.mjs'),P09_D14_FORM_SHA256),selectionBuffer=await pinned(join(modules,'selection.mjs'),P09_D14_SELECTION_SHA256);
const rendered=renderP09CorrectionsPage({parentHtml:parentBytes.toString('utf8'),parentSha256:P09_PARENT_PAGE_SHA256,formAdapterBuffer,selectionBuffer});
assert.throws(()=>renderP09CorrectionsPage({parentHtml:parentBytes.toString('utf8')+' ',formAdapterBuffer,selectionBuffer}));
assert.throws(()=>renderP09CorrectionsPage({parentHtml:parentBytes.toString('utf8'),formAdapterBuffer:Buffer.from('changed'),selectionBuffer}));
const files=new Map([
 ['site/archives/corrections/p09/index.html',Buffer.from(rendered.html)],
 ['site/assets/archives-p09-corrections/selection.mjs',selectionBuffer],
 ['site/assets/archives-p09-corrections/form-adapter.mjs',formAdapterBuffer],
 ['site/assets/archives-p09-corrections/session.mjs',await readFile('scripts/archives-next-readings/p09-corrections-session.mjs')],
 ['site/assets/archives-p09-corrections/client.mjs',await readFile('scripts/archives-next-readings/p09-corrections-client.mjs')]
]);
const reused=[];
for(const [route,sha256]of [['/assets/archives-integration-corrections.css','d58586f9d423a0520178978879cd0c8b6d7a4c618a03580b452e633605f4054f'],['/assets/archives-integration-navigation.css','8ec855dd2b54811ea9a284ebbd2a8b4a98e5c986c6758191d9ec706e943c8731']]){const bytes=await pinned(join(parent,'site/dist',route),sha256);reused.push({route,...pin(bytes),copied:false});}
const sourceFiles=['p09-corrections-renderer.mjs','p09-corrections-session.mjs','p09-corrections-client.mjs','prepare-p09-corrections-ui.mjs'];
const codePins={};for(const name of sourceFiles){const bytes=await readFile(join('scripts/archives-next-readings',name));codePins[name]=pin(bytes);files.set('code-snapshot/'+name,bytes);}
for(const [name,bytes]of files)if(name.startsWith('site/'))assert(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|Z:\\|Z:\/|\.private\/|archive-corrections-private|localhost|127\.0\.0\.1/u.test(bytes.toString('utf8')),name+' public content');
const htmlRoute={route:rendered.route,run_file:'site/archives/corrections/p09/index.html',contentType:'text/html; charset=utf-8'};
const publicRoutes=[htmlRoute,...rendered.additionalAssets.map(asset=>({...asset,run_file:'site/'+asset.run_file}))];
assert.equal(publicRoutes.length,5);
const manifest={format:'p09-corrections-ui-build/1',status:'static-adaptation-prepared',parent_package:'publication-package-20261004-v11',parent_assembly_sha256:parentAssemblySha,parent_page_sha256:P09_PARENT_PAGE_SHA256,d14_handoff:pin(d14Handoff),d14_browser_modules:{form_adapter_sha256:P09_D14_FORM_SHA256,selection_sha256:P09_D14_SELECTION_SHA256},selected_passage:'text:p09-full-comparison-r1-proposed',edition:'p09-full-comparison-r1-proposed',label:'Édition de travail P09 — proposition non confirmée',public_routes:publicRoutes,reused_parent_assets:reused,api_routes:rendered.apiRoutes,outputs:Object.fromEntries([...files].map(([name,bytes])=>[name,pin(bytes)])),code_pins:codePins,checks:{exact_d14_modules:true,parent_navigation_preserved:true,parent_not_modified:true,existing_css_reused:true,public_files_only:5,inline_code:false,html_sink_used:false,new_photo:false,new_database:false,proposal_posted:false,socket_opened:false,canonical_edit:false,private_context_copied_to_site:false},targeted_checks_pending:true,browser_gate_owner:'Root with real backend',browser_gate_executed:false,publication_executed:false};
assert.equal(dirname(attempt).toLowerCase(),resolve('.private/archives-next-readings').toLowerCase());assert.equal(dirname(root).toLowerCase(),attempt.toLowerCase());assert.equal((await realpath(dirname(root))).toLowerCase(),dirname(root).toLowerCase());await mkdir(root);
for(const [name,bytes]of files){const path=resolve(root,name);assert(path.toLowerCase().startsWith(root.toLowerCase()+'\\'));await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}
await writeFile(join(root,'build-proof.json'),serialize(manifest),{flag:'wx'});
console.log(JSON.stringify({directory:root,build_proof:pin(serialize(manifest)),public_routes:5,d14_modules_exact:true,browser_gate:'Root pending',proposals_posted:0,sockets_opened:0},null,2));
