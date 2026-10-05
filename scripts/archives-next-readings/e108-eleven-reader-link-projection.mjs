import assert from 'node:assert/strict';
const route='/archives/fichiers/e108-vue-11/passage-en-cours/';
const id='object:path-e0c18ef5953b98f7ff6fdfd06777d11b54efb93f25a326ed02078eaea0f9aa0d';
const path='CLEAN/Photos des Archives/E.108 - 1470. — Baronnie de Milesse, dépendant du marquisat de Lavardin/Source en intégralité page 1 à 30/11.jpg';
const photo='/archives/media/draft/4c40849b1b278127a1aa7b967115764230d83effe71842878e10617c88007e72.jpg';
const link='<a class="e108-reading-link" id="e108-eleven-passage-link" href="'+route+'">Lire le passage en cours · vue 11</a>';
// Catalogue hook uses an isolated stylesheet. It never applies reader page rules.
const hookStyle='<link rel="stylesheet" href="/assets/archives-e108-eleven-link.css">';
const oldNote='Les quatre fichiers sont connus par leur classement. Aucun lien avec une transcription ou une personne n’est établi. L’ordre affiché vient des noms de fichiers.';
const newNote='Les quatre fichiers sont connus par leur classement. Le passage de la vue 11 a deux lectures proposées, à relire ; aucun rattachement historique à un acte ou à une personne n’est établi. L’ordre affiché vient des noms de fichiers.';
export function projectE108ElevenReaderLink(requestUrl,html){
 const url=requestUrl instanceof URL?requestUrl:new URL(String(requestUrl),'https://private.invalid');if(url.pathname!=='/archives/catalogue/'||typeof html!=='string')return html;
 assert(!html.includes('id="e108-eleven-passage-link"'),'Reader hook already present');
 const template=html.match(/<template id="e108-ensemble-template"[\s\S]*?<\/template>/g);assert.equal(template?.length,1,'One current E108 template required');
 const before=template[0],start='<li data-ensemble-object-id="'+id+'" data-ensemble-logical-path="'+path+'">';assert.equal(before.split(start).length,2);
 const at=before.indexOf(start),end=before.indexOf('</li>',at);assert(end>at);const member=before.slice(at,end+5);
 assert(member.includes('id="e108-photo-open-11"'));assert(member.includes('src="'+photo+'"'));
 assert.equal(before.split(oldNote).length,2);assert.equal((before.match(/class="e108-photo-open"/g)||[]).length,4);
 const after=before.replace(member,member.replace('</li>',link+'</li>')).replace(oldNote,newNote);
 assert.equal(html.split('</head>').length,2);return html.replace(before,after).replace('</head>',hookStyle+'</head>');
}
export function restoreE108ElevenReaderLink(html){
 for(const token of [link,hookStyle,newNote])assert.equal(html.split(token).length,2);
 return html.replace(link,'').replace(hookStyle,'').replace(newNote,oldNote);
}
