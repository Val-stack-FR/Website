import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {digest,TONAL_READING_PINS as pins,TONAL_READING_ROUTES as routes,composeP09TonalReading} from './p09-tonal-reading-adapter.mjs';
const run=resolve('.private/archives-next-readings/p09-tonal-reading-ui-20261004-v1'),source=resolve('.private/archives-next-readings/p09-file-reading-ui-20261004-v1'),component=resolve('.private/archives-integration/digital-paleography-tonal-preview-20261004-r2');
const outputs=new Map(),pin=b=>({sha256:digest(b),bytes:b.length}),serialize=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const read=async(path,sha)=>{const bytes=await readFile(path);assert.equal(digest(bytes),sha,path);return bytes;};
const parent=await read(join(source,'p09.html'),pins.p09),template=await read(join(component,'index.html'),pins.component),css=await read(join(component,'comparison.css'),pins.css),js=await read(join(component,'comparison.js'),pins.js),contract=await read(join(component,'display-contract.json'),pins.contract);
const composed=composeP09TonalReading({enabled:true,parentHtml:parent.toString('utf8'),componentBytes:template});
assert.equal(composeP09TonalReading({enabled:false,parentHtml:parent.toString('utf8')}).html,parent.toString('utf8'));
assert.throws(()=>composeP09TonalReading({enabled:true,parentHtml:composed.html,parentSha256:digest(Buffer.from(composed.html)),componentBytes:template}));
assert.throws(()=>composeP09TonalReading({enabled:true,parentHtml:parent.toString('utf8'),componentBytes:Buffer.from('drift')}));
assert.throws(()=>composeP09TonalReading({enabled:true,parentHtml:parent.toString('utf8').replace('<li>souille</li>','<li>modified</li>'),componentBytes:template}));
const projection=JSON.parse(await readFile(join(source,'projection.json'))),point=projection.points.find(p=>p.id==='point-l04');
assert.equal(point.crop.sha256,pins.crop);assert.equal(point.crop.route,routes.crop);assert.equal(point.quote,'⟦souille ?⟧');
const cropPath=join(source,point.crop.run_file),cropBytes=await read(cropPath,pins.crop);assert.equal(cropBytes.length,point.crop.bytes);assert.equal(cropBytes.readUInt32BE(16),530);assert.equal(cropBytes.readUInt32BE(20),165);
const textRows=html=>[...html.matchAll(/<span class="source-line" data-source-line="L\d+">[\s\S]*?<\/span>/g)].map(m=>m[0]);
assert.deepEqual(textRows(composed.html),textRows(parent.toString('utf8')));assert.equal(textRows(composed.html).length,21);
const cards=html=>[...html.matchAll(/<article\b[^>]*\bid="point-(l\d+)"[^>]*>[\s\S]*?<\/article>/g)].map(m=>({id:m[1],html:m[0]}));
const oldCards=cards(parent.toString('utf8')),newCards=cards(composed.html);assert.equal(oldCards.length,4);assert.equal(newCards.length,4);
for(const card of oldCards.filter(c=>c.id!=='l04'))assert.equal(newCards.find(c=>c.id===card.id).html,card.html);
assert.equal((composed.html.match(/data-p09-tonal-help/g)||[]).length,1);
assert(!/\son[a-z]+\s*=|\sstyle\s*=|unsafe-inline|unsafe-eval|preview\.css/.test(composed.html));
assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(composed.html));
const visibleText=composed.html.replace(/<[^>]+>/g,'');assert(!/\b(?:SHA|sourceID|r0|Ayming|Root)\b|object:path|\.private/.test(visibleText));
outputs.set('p09.html',Buffer.from(composed.html));outputs.set('inputs/parent-p09.html',parent);outputs.set('inputs/component-index.html',template);outputs.set('inputs/display-contract.json',contract);outputs.set('inputs/p09-projection.json',await readFile(join(source,'projection.json')));
outputs.set('comparison.css',css);outputs.set('comparison.js',js);
for(const name of ['p09-tonal-reading.css','p09-tonal-reading.js'])outputs.set(name,await readFile('scripts/archives-next-readings/'+name));
const publicRoutes=[{route:routes.page,run_file:'p09.html',contentType:'text/html; charset=utf-8'},...[[routes.comparisonCss,'comparison.css','text/css'],[routes.comparisonJs,'comparison.js','text/javascript'],[routes.bridgeCss,'p09-tonal-reading.css','text/css'],[routes.bridgeJs,'p09-tonal-reading.js','text/javascript']].map(([route,run_file,type])=>({route,run_file,contentType:type+'; charset=utf-8'}))];
const parentAssets=[];
for(const [route,file,sha]of [['/assets/archives-integration-lexical.css','parent-assets/lexical.css','203b80862c20d0ae90fbf2511a5f36110c40c90214de1027a33fde68ca4235de'],['/assets/archives-file-reading.css','file-reading.css','925b34e433428e1afd1124235e9154605d9f193b994c9d27d5259755e2b10d35']]){
 const bytes=await read(join(source,file),sha),runFile='parent-assets/'+file.split('/').at(-1);outputs.set(runFile,bytes);parentAssets.push({route,run_file:runFile,contentType:'text/css; charset=utf-8'});
}
// A focused wrapper serves only L04 for the isolated browser gate. It is never part of the public delta.
const l04Card=newCards.find(c=>c.id==='l04').html,row=composed.html.match(/<div class="transcription-line has-point" id="ligne-l04"[\s\S]*?<\/div>/)?.[0];assert(row);
const head=composed.html.slice(0,composed.html.indexOf('</head>')+7);
const preview=head+'<body class="file-reading"><main><header class="file-heading"><p class="eyebrow">P09 · ligne L04</p><h1>Revoir un point de lecture</h1></header><div class="file-columns"><section class="transcription" aria-label="Ligne L04 dans la transcription"><h2>Transcription conservée</h2><div class="transcription-lines">'+row+'</div></section><section class="reading-points" aria-label="Difficulté L04"><h2>Point de lecture L04</h2>'+l04Card+'</section></div></main></body></html>\n';
assert.equal((preview.match(/<img\b/g)||[]).length,3);assert(!preview.includes('point-l01')&&!preview.includes('point-l21'));outputs.set('preview-l04.html',Buffer.from(preview));
const integration={format:'p09-l04-optional-tonal-reading/1',parent_page_sha256:pins.p09,parent_from_closed_p09_file_ui:true,root_can_supply_current_parent_sha256:true,parent_must_keep_exact_l04_crop_quote_and_proposals:true,public_routes:publicRoutes,required_existing_assets:parentAssets,required_existing_crop:{route:routes.crop,sha256:pins.crop,bytes:point.crop.bytes,width:530,height:165},target_point:'point-l04',lazy_mount:'inert template until native details opens; clone once, preserve unique IDs, reset at each opening',default:'original small excerpt, unchanged text and suggestions, optional details closed',opened_default:'paired complete excerpts in Fit, controls closed, both filters none, pan zero',reset:'Image intacte returns Fit, filters none, pan zero, closes adjustment controls',preview_css_excluded:true,component_css_js_byte_identical_r2:true,disable_restores_parent_exact:true,new_media_files:0,new_crops:0,post_or_api_calls:0,originals_and_png_modified:false,quantitative_reading_gain:null,root_package_modified:false,root_integration_pending:true};
outputs.set('integration-contract.json',serialize(integration));
const codePins={};for(const name of ['p09-tonal-reading-adapter.mjs','p09-tonal-reading.css','p09-tonal-reading.js','prepare-p09-tonal-reading-ui.mjs','p09-tonal-reading-preview.mjs']){const bytes=await readFile('scripts/archives-next-readings/'+name);outputs.set('code-snapshot/'+name,bytes);codePins[name]=pin(bytes);}
const proof={format:'p09-l04-optional-tonal-reading-build/1',source_pins:pins,public_routes:publicRoutes,parent_assets:parentAssets,preview_route:'/preview/p09/l04/',preview_file:'preview-l04.html',existing_crop_readonly:{path:cropPath,route:routes.crop,...pin(cropBytes)},outputs:Object.fromEntries([...outputs].map(([n,b])=>[n,pin(b)])),code_pins:codePins,checks:{twenty_one_original_lines_unchanged:true,other_three_point_cards_byte_identical:true,l04_original_small_excerpt_quote_suggestions_and_return_link_unchanged:true,one_optional_help_on_l04:true,unique_ids_including_inert_template:true,component_r2_css_js_byte_identical:true,one_existing_l04_crop_only:true,no_inline_code_styles_or_demo_css:true,no_visible_technical_metadata:true,no_new_media_or_source_reading:true,no_post_or_api:true,parent_restorable:true,refusals:['double application','component drift','parent drift']},browser_gate_pending:true};
await mkdir(run);for(const [name,bytes]of outputs){const path=join(run,name);assert(path.toLowerCase().startsWith(run.toLowerCase()+'\\'));await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});}await writeFile(join(run,'build-proof.json'),serialize(proof),{flag:'wx'});
console.log(JSON.stringify({run,proof:pin(serialize(proof)),routes:publicRoutes.map(r=>r.route),new_media_files:0},null,2));
