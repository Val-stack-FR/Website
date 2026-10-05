import {createHash} from 'node:crypto';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const TONAL_READING_PINS=Object.freeze({
 p09:'6cadb5705d7438a598bdfb6b2525d27d482159ec9a339012cb14957c62154dac',
 component:'05550ada78ce38a5966549a29ed7030ab6f113ee6f9bbfa1620ac9f522c29da4',
 css:'5dfd755d00b2ebca93752d95f0e93940f37acf395fd535e0555496b04f520939',
 js:'16cdf2bb63ee750128540bd061d834e0903515f06a0915f80d07146135e61013',
 contract:'c413011d4c7193f57d7e966a0e36abd27b0ca9606ea75813506a8a3c1a00850c',
 crop:'f5288c08f3099e89a05da4eeca0fe941140528af4574c4ef576315d5c5626cb1'
});
export const TONAL_READING_ROUTES=Object.freeze({
 page:'/archives/fichiers/p09/',comparisonCss:'/assets/archives-tonal-comparison.css',comparisonJs:'/assets/archives-tonal-comparison.js',bridgeCss:'/assets/archives-p09-tonal-reading.css',bridgeJs:'/assets/archives-p09-tonal-reading.js',crop:'/archives/review-crops/p09/'+TONAL_READING_PINS.crop+'.png'
});
const ensure=(value,message)=>{if(!value)throw Error('P09 tonal help: '+message);};
const prefix='p09-l04-tonal-';
export function p09TonalComponent(componentBytes){
 ensure(Buffer.isBuffer(componentBytes)&&digest(componentBytes)===TONAL_READING_PINS.component,'closed r2 reusable component');
 const html=componentBytes.toString('utf8');
 const matches=[...html.matchAll(/<!-- Begin reusable component;[^>]*-->\s*([\s\S]*?)\s*<!-- End reusable component\. -->/g)];
 ensure(matches.length===1,'one reusable component');let component=matches[0][1];
 const option=component.match(/<option value="l04-souille"[^>]*>[\s\S]*?<\/option>/)?.[0];ensure(option,'closed L04 option');
 const selected=option.replace('data-src="crops/l04-souille.png"','data-src="'+TONAL_READING_ROUTES.crop+'"');
 component=component.replace(/<select id="crop-choice" data-role="crop-choice">[\s\S]*?<\/select>/,'<select id="crop-choice" data-role="crop-choice" hidden>'+selected+'</select>');
 component=component.replace('<label class="sr-only" for="crop-choice">Extrait à revoir</label>','<label for="crop-choice" hidden>Extrait à revoir</label><p>L04 · ⟦souille ?⟧</p>');
 component=component.replace('crop-l01-name','crop-l04-souille');
 component=component.replaceAll('src="crops/l01-name.png"','src="'+TONAL_READING_ROUTES.crop+'"').replaceAll('width="510" height="170"','width="530" height="165"').replaceAll('L01, autour de ⟦[…]trix ?⟧','L04, autour de ⟦souille ?⟧').replaceAll('L01, affichage ajustable','L04, affichage ajustable');
 for(const id of ['crop-choice','contrast','brightness','grayscale','zoom'])component=component.replaceAll('id="'+id+'"','id="'+prefix+id+'"').replaceAll('for="'+id+'"','for="'+prefix+id+'"');
 component=component.replace('data-tonal-crop-review','id="'+prefix+'comparison" data-tonal-crop-review');
 ensure(!/\b(?:src|data-src)="crops\//.test(component)&&!component.includes('L01')&&!component.includes('L21'),'L04 only, existing image route');
 ensure((component.match(/<option value="l04-souille"/g)||[]).length===1&&(component.match(/data-role="(?:intact|processed)-image"/g)||[]).length===2,'one choice and paired images');
 return component;
}
export function composeP09TonalReading({enabled=false,parentHtml,parentSha256=TONAL_READING_PINS.p09,componentBytes}){
 ensure(typeof parentHtml==='string'&&/^[a-f0-9]{64}$/.test(parentSha256)&&digest(Buffer.from(parentHtml))===parentSha256,'caller-pinned parent HTML');
 if(!enabled)return {html:parentHtml,added:false};
 ensure(!parentHtml.includes('data-p09-tonal-help')&&!parentHtml.includes(TONAL_READING_ROUTES.comparisonJs),'not already composed');
 const cards=[...parentHtml.matchAll(/<article\b[^>]*\bid="point-l04"[^>]*>[\s\S]*?<\/article>/g)];ensure(cards.length===1,'one existing L04 card');
 const card=cards[0][0],figure=`<img src="${TONAL_READING_ROUTES.crop}" width="530" height="165"`;
 ensure(card.includes(figure)&&card.includes('<span data-point-quote>⟦souille ?⟧</span>')&&card.includes('<li>souille</li>')&&card.includes('<li>soille</li>'),'exact existing L04 difficulty, crop and proposals');
 const anchor='<p><a href="#ligne-l04">Revenir à L04 dans la transcription</a></p>';ensure(card.split(anchor).length===2,'one L04 return link');
 const help=`<details class="p09-tonal-help" data-p09-tonal-help><summary>Ajuster l’image</summary><template data-p09-tonal-template>${p09TonalComponent(componentBytes)}</template><div data-p09-tonal-host></div><noscript><p>L’extrait intact et les suggestions restent consultables ci-dessus. Les réglages nécessitent JavaScript.</p></noscript></details>`;
 const nextCard=card.replace(anchor,help+anchor),head=`<link rel="stylesheet" href="${TONAL_READING_ROUTES.comparisonCss}"><link rel="stylesheet" href="${TONAL_READING_ROUTES.bridgeCss}"><script src="${TONAL_READING_ROUTES.comparisonJs}" defer></script><script src="${TONAL_READING_ROUTES.bridgeJs}" defer></script>`;
 ensure(parentHtml.split('</head>').length===2,'one head');
 const html=parentHtml.replace(card,nextCard).replace('</head>',head+'</head>');
 ensure(html.replace(help,'').replace(head,'')===parentHtml,'parent restored byte-identical');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);ensure(new Set(ids).size===ids.length,'unique IDs including inert template');
 return {html,added:true,parentRestorable:true,point:'L04',lazyMount:true,originalSmallExcerptUnchanged:true};
}
