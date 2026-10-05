import {createHash} from 'node:crypto';
export const digest=b=>createHash('sha256').update(b).digest('hex');
export const E108_HUMAN_PINS=Object.freeze({parent:'cf4cf5d6533eb710c8a6849c3cce00c6107db0ff32845ef9feb2d19fd0346c6e',hierarchy:'f8b9058d0e4c49ebc91cf345d155c279c33efde7939648d990a0339a92b733c8',helper:'cc4fc7e39e697565b613a9afcc6c762c99e4fa77d55ca0dc848e86542b89c454',ensembleCss:'a8d8204232c8b71b205532155f15ad0d731e1ce013df072d002e6ee2c3b4c47b',ensembleJs:'e917f987c6cf5e0317fb248510bfee588a8556d9ea2f7cd210e505316162e2a3'});
const ensure=(x,m)=>{if(!x)throw Error('Human E108 delta: '+m);};
export function compileHumanE108Response(runtimeBytes){
 ensure(Buffer.isBuffer(runtimeBytes)&&digest(runtimeBytes)===E108_HUMAN_PINS.helper,'closed reviewed Root response helper');
 const source=runtimeBytes.toString('utf8'),start='const INSERTIONS = Object.freeze(',end=');\nconst CATALOGUE_PATH';
 const from=source.indexOf(start)+start.length,to=source.indexOf(end,from);ensure(from>=start.length&&to>from,'reviewed insertion literal');
 const literal=source.slice(from,to),insertions=JSON.parse(literal),previous=insertions.template;
 const folder=previous.match(/data-ensemble-folder="([^"]+)"/)?.[1];ensure(folder?.startsWith('CLEAN/Photos des Archives/E.108 '),'exact E108 folder');
 const oldParagraph='<p>'+folder+'</p>',human=folder.split('/');human[0]='Archives';
 ensure(previous.split(oldParagraph).length===2,'one old visible storage path');
 insertions.template=previous.replace(oldParagraph,'<p>'+human.join(' › ')+'</p>');
 ensure(!insertions.template.replace(/<[^>]+>/g,'').includes('CLEAN/'),'no visible storage root');
 const nextLiteral=JSON.stringify(insertions),moduleText=source.slice(0,from)+nextLiteral+source.slice(to);
 ensure(moduleText.replace(nextLiteral,literal)===source,'Root helper code unchanged outside insertion literal');
 return {moduleText,insertions,folder,visiblePath:human.join(' › '),rootHelperLogicUnchanged:true};
}
export function patchE108HumanHierarchy(parentBytes){
 ensure(Buffer.isBuffer(parentBytes)&&digest(parentBytes)===E108_HUMAN_PINS.hierarchy,'exact cleaned v19-r2 hierarchy client');
 const parent=parentBytes.toString('utf8'),anchor='      const record = entry.record; article.append';ensure(parent.split(anchor).length===2,'one existing photo-card branch');
 const insertion=`      const ensembleTemplate = document.getElementById('e108-ensemble-template');
      const ensembleMember = ensembleTemplate && [...ensembleTemplate.content.querySelectorAll('[data-ensemble-object-id]')].find(member => member.dataset.ensembleObjectId === entry.record.digitalObjectId && member.dataset.ensembleLogicalPath === entry.record.logicalPath && member.querySelector('h4')?.textContent === 'Vue ' + Number(entry.record.fileName.literal.replace('.jpg','')) + ' · ' + entry.record.fileName.literal);
      if (ensembleMember) { article.dataset.ensembleObjectId = entry.record.digitalObjectId; article.dataset.ensembleLogicalPath = entry.record.logicalPath; }
`;
 const client=parent.replace(anchor,insertion+anchor);ensure(client.replace(insertion,'')===parent,'hierarchy client restorable');
 return {client,insertion,parentRestorable:true};
}
export function patchE108HumanEnsemble(parentBytes){
 ensure(Buffer.isBuffer(parentBytes)&&digest(parentBytes)===E108_HUMAN_PINS.ensembleJs,'closed reviewed-r3 ensemble client');
 const parent=parentBytes.toString('utf8');
 const facts=" const facts=article=>{const values=new Map();for(const div of article.querySelectorAll('.catalogue-facts > div')){const key=div.querySelector('dt')?.textContent,value=div.querySelector('dd')?.textContent;if(key&&value)values.set(key,value);}return values;};\n";
 const oldMatch="const matches=cards.filter(card=>{const values=facts(card);return values.get('Objet numérique')===member.id&&values.get('Chemin dans le classement')===member.path;});";
 const newMatch="const matches=cards.filter(card=>card.dataset.ensembleObjectId===member.id&&card.dataset.ensembleLogicalPath===member.path);";
 ensure(parent.split(facts).length===2&&parent.split(oldMatch).length===2,'two exact old visible-facts hooks');
 return {client:parent.replace(facts,'').replace(oldMatch,newMatch),oldFacts:facts,oldMatch,newMatch};
}
