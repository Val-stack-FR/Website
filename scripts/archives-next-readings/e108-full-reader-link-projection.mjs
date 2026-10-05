import assert from 'node:assert/strict';
const FULL_ROUTE='/archives/fichiers/e108-vue-11/',PILOT_ROUTE='/archives/fichiers/e108-vue-11/passage-en-cours/';
const FULL_FOLDER='CLEAN/Photos des Archives/E.108 - 1470. — Baronnie de Milesse, dépendant du marquisat de Lavardin/Source en intégralité page 1 à 30';
const FULL_PHOTO='/archives/media/draft/4c40849b1b278127a1aa7b967115764230d83effe71842878e10617c88007e72.jpg';
const object='object:path-e0c18ef5953b98f7ff6fdfd06777d11b54efb93f25a326ed02078eaea0f9aa0d';
const link='<a class="e108-reading-link" id="e108-eleven-full-link" href="'+FULL_ROUTE+'">Lire la vue 11 entière · 29 lignes proposées</a>';
const oldNote='Les quatre fichiers sont connus par leur classement. Le passage de la vue 11 a deux lectures proposées, à relire ; aucun rattachement historique à un acte ou à une personne n’est établi. L’ordre affiché vient des noms de fichiers.';
const newNote='Les quatre fichiers sont connus par leur classement. La vue 11 entière a deux lectures proposées, à relire ; le pilote de six lignes est conservé. Aucun rattachement historique à un acte ou à une personne n’est établi. L’ordre affiché vient des noms de fichiers.';
export function projectE108FullReaderLink(requestUrl,html){
 const url=requestUrl instanceof URL?requestUrl:new URL(String(requestUrl),'https://private.invalid');if(url.pathname!=='/archives/catalogue/'||typeof html!=='string')return html;
 assert(!html.includes('id="e108-eleven-full-link"'),'Full reader hook already present');
 const templates=html.match(/<template id="e108-ensemble-template"[\s\S]*?<\/template>/g);assert.equal(templates?.length,1);
 const before=templates[0],start='<li data-ensemble-object-id="'+object+'" data-ensemble-logical-path="'+FULL_FOLDER+'/11.jpg">';assert.equal(before.split(start).length,2);
 const at=before.indexOf(start),end=before.indexOf('</li>',at);assert(end>at);const member=before.slice(at,end+5);
 assert(member.includes('id="e108-photo-open-11"'));assert(member.includes('src="'+FULL_PHOTO+'"'));assert(member.includes('id="e108-eleven-passage-link"'));assert(member.includes('href="'+PILOT_ROUTE+'"'));
 assert.equal((before.match(/class="e108-photo-open"/g)||[]).length,4);assert.equal(before.split(oldNote).length,2);
 return html.replace(before,before.replace(member,member.replace('</li>',link+'</li>')).replace(oldNote,newNote));
}
export function restoreE108FullReaderLink(html){for(const token of [link,newNote])assert.equal(html.split(token).length,2);return html.replace(link,'').replace(newNote,oldNote);}
