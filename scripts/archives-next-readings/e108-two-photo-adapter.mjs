import {createHash} from 'node:crypto';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const E108_FOLDER = 'CLEAN/Photos des Archives/E.108 - 1470. — Baronnie de Milesse, dépendant du marquisat de Lavardin/Source en intégralité page 1 à 30';
export const TWO_PHOTOS = Object.freeze([
 {number:11,filename:'11.jpg',id:'object:path-e0c18ef5953b98f7ff6fdfd06777d11b54efb93f25a326ed02078eaea0f9aa0d',sha:'4c40849b1b278127a1aa7b967115764230d83effe71842878e10617c88007e72',bytes:2689183},
 {number:12,filename:'12.jpg',id:'object:path-e27a33af0418957a376f23b55948fafb1192f7adb8e2c60a0cf19dda52dfa314',sha:'8847b4a64de43dff2aeed631674b7bdfe94884e5a2c5c7c8f5ce0f437fa2e0c7',bytes:2614699}
].map(p=>Object.freeze({...p,path:E108_FOLDER+'/'+p.filename,route:'/archives/media/draft/'+p.sha+'.jpg',dimensions:[2976,3968],exif:1,transform:'identity'})));
const ensure=(condition,message)=>{if(!condition)throw Error('E108 two-photo delta: '+message);};
const dialog='<dialog id="e108-photo-dialog" class="e108-photo-dialog" aria-labelledby="e108-photo-title"><header><h2 id="e108-photo-title">Photo de l’ensemble E.108</h2><button type="button" data-e108-close autofocus>Fermer la photo</button></header><div class="e108-photo-tools" aria-label="Affichage de la photo"><button type="button" data-e108-fit aria-pressed="true">Ajuster</button><button type="button" data-e108-native aria-pressed="false">Taille réelle</button><p id="e108-photo-scale" aria-live="polite">Photo ajustée à la fenêtre</p></div><div class="e108-photo-stage" tabindex="0" aria-label="Photo ; faire défiler en taille réelle"><img id="e108-photo-full" alt=""></div><p class="e108-photo-limit">Ensemble probable · même acte à confirmer. L’ordre physique reste à établir.</p></dialog>\n';
export function composeTwoPhotoDelta(parentTemplate){
 ensure(typeof parentTemplate==='string'&&parentTemplate.startsWith('<template id="e108-ensemble-template"'),'exact projected ensemble template');
 ensure((parentTemplate.match(/data-ensemble-object-id=/g)||[]).length===4,'four original members');
 let template=parentTemplate;const edits=[];
 for(const photo of TWO_PHOTOS){
  const before='<li data-ensemble-object-id="'+photo.id+'" data-ensemble-logical-path="'+photo.path+'"><h4>Vue '+photo.number+' · '+photo.filename+'</h4><p class="catalogue-muted">Photo inventoriée · aperçu à préparer</p></li>';
  const after='<li data-ensemble-object-id="'+photo.id+'" data-ensemble-logical-path="'+photo.path+'"><h4>Vue '+photo.number+' · '+photo.filename+'</h4><button type="button" class="e108-photo-open" id="e108-photo-open-'+photo.number+'" data-e108-photo="'+photo.number+'" aria-haspopup="dialog"><img src="'+photo.route+'" alt="Aperçu de '+photo.filename+' dans le dossier E.108" width="2976" height="3968" loading="lazy" decoding="async"><span>Voir la photo · '+photo.filename+'</span></button></li>';
  ensure(template.split(before).length===2,'unique exact '+photo.filename+' source binding');template=template.replace(before,after);edits.push({before,after});
 }
 ensure((template.match(/aperçu à préparer/g)||[]).length===2,'13 and 14 remain pending');
 return {template,edits,dialog,stylesheet:'<link rel="stylesheet" href="/assets/archives-e108-two-photo.css">\n',script:'<script src="/assets/archives-e108-two-photo.js" defer></script>\n'};
}
// Apply after the existing E108 response projection. Other readers and catalogue
// clients stay byte-identical; only the exact inert E108 template is replaced.
export function createTwoPhotoProjection(parentTemplate){
 const delta=composeTwoPhotoDelta(parentTemplate);
 const project=(requestUrl,html)=>{
  const url=requestUrl instanceof URL?requestUrl:new URL(String(requestUrl),'https://private.invalid');
  if(url.pathname!=='/archives/catalogue/'||typeof html!=='string')return html;
  ensure(!html.includes('id="e108-photo-dialog"'),'double projection refused');
  ensure(html.split(parentTemplate).length===2,'one selected parent template');
  ensure(html.split('</head>').length===2&&html.split('</body>').length===2,'unique document landmarks');
  return html.replace(parentTemplate,delta.template).replace('</head>',delta.stylesheet+'</head>').replace('</body>',delta.dialog+delta.script+'</body>');
 };
 const restore=html=>{
  for(const token of [delta.template,delta.stylesheet,delta.dialog,delta.script])ensure(html.split(token).length===2,'unique restoration token');
  return html.replace(delta.template,parentTemplate).replace(delta.stylesheet,'').replace(delta.dialog,'').replace(delta.script,'');
 };
 return {project,restore,delta};
}
