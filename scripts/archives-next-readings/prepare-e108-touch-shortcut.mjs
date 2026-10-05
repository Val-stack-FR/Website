import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {digest,E108_TOUCH_RULE,patchE108TouchShortcutCss,restoreE108TouchShortcutCss} from './e108-touch-shortcut-adapter.mjs';
const prior=resolve('.private/archives-next-readings/e108-human-publication-delta-20261004-v1'),run=resolve('.private/archives-next-readings/e108-touch-shortcut-20261004-v1');
const pin=b=>({sha256:digest(b),bytes:b.length}),outputs=new Map();
const sealBytes=await readFile(join(prior,'seal.json'));assert.equal(digest(sealBytes),'0787c2b903690d9e3eff2594907a938fb2feda8bc7834b15be374903b0ceba9d');
const seal=JSON.parse(sealBytes),read=async name=>{const b=await readFile(join(prior,name));assert.deepEqual(pin(b),seal.files[name],name);return b;};
const css=await read('catalogue-ensemble.css'),composed=patchE108TouchShortcutCss(css);
assert(restoreE108TouchShortcutCss(composed).equals(css));assert.throws(()=>patchE108TouchShortcutCss(composed));
outputs.set('catalogue-ensemble.css',composed);outputs.set('touch-shortcut-rule.css',Buffer.from(E108_TOUCH_RULE));
outputs.set('inputs/parent-ensemble.css',css);
for(const name of ['archives-hierarchy.js','catalogue-ensemble.js','inputs/hierarchy-e108-all.json','inputs/hierarchy-e108-partial.json','inputs/ensemble.json','parent-assets/styles.css','parent-assets/assets/archives-integration-navigation.css','parent-assets/assets/archives-catalogue.css','parent-assets/assets/archives-human-catalogue-public-labels.css'])outputs.set(name,await read(name));
const parentHtml=await read('dynamic-e108.html'),html=parentHtml.toString('utf8');
assert.equal(html.split('</body>').length,2);
outputs.set('inputs/parent-dynamic-e108.html',parentHtml);
outputs.set('preview.html',Buffer.from(html.replace('</body>','<script src="/__touch-shortcut-probe.js" defer></script>\n</body>')));
const folder=JSON.parse(await read('build-proof.json')).folder;
for(const name of ['e108-touch-shortcut-adapter.mjs','e108-touch-shortcut-probe.js','prepare-e108-touch-shortcut.mjs','e108-touch-shortcut-preview.mjs'])outputs.set('code-snapshot/'+name,await readFile('scripts/archives-next-readings/'+name));
outputs.set('private-probe.js',outputs.get('code-snapshot/e108-touch-shortcut-probe.js'));
await mkdir(run);for(const [name,b]of outputs){const path=join(run,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,b,{flag:'wx'});}
const contract={format:'e108-touch-shortcut-delta/1',parent_closed_run:'e108-human-publication-delta-20261004-v1',parent_seal:pin(sealBytes),folder,
 public_change:{route:'/assets/archives-catalogue-ensemble.css',file:'catalogue-ensemble.css',addition:'touch-shortcut-rule.css',selector:'.catalogue-ensemble-entry a',minimum_height_css_px:44,display:'block'},
 integration:'Apply only the scoped CSS addition to the E108 ensemble stylesheet; retain v20 H07 hierarchy JS and all existing HTML/client hooks',
 unchanged:{href:true,hash:true,focus_logic:true,query_reset_logic:true,source_json:true,four_members:true,group_classification:true,html:true,hierarchy_js:true,ensemble_js:true},
 private_preview_instrumentation:'preview.html, private-probe.js, copied clients/data/styles are gate fixtures only; do not deploy',new_media:0,root_live_mutations:0,browser_gate_pending:true};
const contractBytes=Buffer.from(JSON.stringify(contract,null,2)+'\n');outputs.set('integration-contract.json',contractBytes);await writeFile(join(run,'integration-contract.json'),contractBytes,{flag:'wx'});
const proof={format:'e108-touch-shortcut-build/1',parent_seal:pin(sealBytes),outputs:Object.fromEntries([...outputs].map(([name,b])=>[name,pin(b)])),folder,
 checks:{css_only_scoped_addition:true,restore_parent_css_exact:true,no_product_html_or_js_change:true,private_probe_excluded_from_public_change:true,no_root_get_or_write:true,no_photo_read:true,no_new_media:true},public_routes:[contract.public_change],browser_gate_pending:true};
const proofBytes=Buffer.from(JSON.stringify(proof,null,2)+'\n');await writeFile(join(run,'build-proof.json'),proofBytes,{flag:'wx'});
console.log(JSON.stringify({run,proof:pin(proofBytes),public_change:contract.public_change},null,2));
