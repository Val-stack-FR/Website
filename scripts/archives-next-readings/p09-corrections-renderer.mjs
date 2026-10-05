import {createHash} from 'node:crypto';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const P09_PARENT_PAGE_SHA256='e60188224311aaccd9ddc46b2f18d3e52483c2d7decc0af68673178a7aeaa693';
export const P09_D14_FORM_SHA256='12a54efe8c109b2246c2f42e90db0a0834b35dd95d400b669ec769c1640cb5f2';
export const P09_D14_SELECTION_SHA256='511f2e7fd18a51634f819a9466c09c0f7cfa97a1e33ef19d4debe90b3d5e8a1b';
export const P09_UI_ASSETS=Object.freeze([
 {route:'/assets/archives-p09-corrections/selection.mjs',run_file:'assets/archives-p09-corrections/selection.mjs',contentType:'text/javascript; charset=utf-8'},
 {route:'/assets/archives-p09-corrections/form-adapter.mjs',run_file:'assets/archives-p09-corrections/form-adapter.mjs',contentType:'text/javascript; charset=utf-8'},
 {route:'/assets/archives-p09-corrections/session.mjs',run_file:'assets/archives-p09-corrections/session.mjs',contentType:'text/javascript; charset=utf-8'},
 {route:'/assets/archives-p09-corrections/client.mjs',run_file:'assets/archives-p09-corrections/client.mjs',contentType:'text/javascript; charset=utf-8'}
]);
export function renderP09CorrectionsPage({parentHtml,parentSha256=P09_PARENT_PAGE_SHA256,formAdapterBuffer,selectionBuffer}){
 if(typeof parentHtml!=='string'||parentSha256!==P09_PARENT_PAGE_SHA256||digest(Buffer.from(parentHtml))!==parentSha256)throw Error('Pinned v11 correction page required.');
 if(!Buffer.isBuffer(formAdapterBuffer)||digest(formAdapterBuffer)!==P09_D14_FORM_SHA256||!Buffer.isBuffer(selectionBuffer)||digest(selectionBuffer)!==P09_D14_SELECTION_SHA256)throw Error('Exact D14 browser modules required.');
 const navigation=parentHtml.match(/<nav class="atelier-navigation"[^>]*>[\s\S]*?<\/nav>/gu);if(navigation?.length!==1)throw Error('One existing navigation required.');
 const html=`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Proposer une lecture P09 — atelier historique</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/archives-integration-corrections.css"><link rel="stylesheet" href="/assets/archives-integration-navigation.css"></head>
<body><a class="skip" href="#p09-correction-main">Aller au passage P09</a>${navigation[0]}
<main id="p09-correction-main"><p>Atelier historique · travaux en cours</p><h1>Proposer une lecture P09</h1>
<p id="p09-correction-label">Édition de travail P09 — proposition non confirmée</p>
<p><a href="/archives/#next-reading-p09-author-pilot">Revenir à la lecture P09</a></p>
<h2>Texte diplomatique de l’édition de travail · 21 lignes</h2>
<div class="source-text" id="p09-correction-source" aria-busy="true">Chargement du passage P09…</div>
<details><summary>Français proposé · lecture non confirmée</summary><p class="notice">Cette reformulation est présentée séparément. Le formulaire ci-dessous porte uniquement sur le texte diplomatique.</p><div class="source-text" id="p09-correction-french">Chargement du français proposé…</div></details>
<form id="correction-form" aria-describedby="p09-correction-notice"><label for="p09-correction-replacement">Votre lecture du texte diplomatique</label><textarea id="p09-correction-replacement" name="replacement" rows="12" minlength="1" maxlength="5000" required disabled></textarea><p class="notice">5 000 caractères maximum.</p>
<label for="p09-correction-reason">Ce qui motive votre proposition</label><textarea id="p09-correction-reason" name="reason" rows="3" minlength="1" maxlength="1000" required disabled></textarea><p class="notice">Motif obligatoire · 1 000 caractères maximum.</p><button id="p09-correction-submit" type="submit" disabled>Enregistrer la proposition</button></form>
<p id="correction-status" role="status" aria-live="polite">Chargement de l’édition de travail P09…</p><button id="p09-correction-reload" type="button" hidden>Réessayer le chargement du passage</button><button id="p09-correction-retry" type="button" hidden>Réessayer le même envoi</button>
<p class="notice" id="p09-correction-notice">Votre proposition reste en attente de revue humaine. Elle ne modifie pas le texte de cette édition et ne confirme pas la lecture historique.</p>
<noscript><p>Le chargement et l’envoi des propositions nécessitent JavaScript.</p></noscript></main>
<script type="module" src="/assets/archives-p09-corrections/client.mjs"></script></body></html>
`;
 if(/<script(?![^>]*\bsrc=)|\bon[a-z]+\s*=|\bstyle\s*=/iu.test(html))throw Error('External assets only.');
 return {html,route:'/archives/corrections/p09/',additionalAssets:structuredClone(P09_UI_ASSETS),existingNavigationPreserved:true,parentModified:false,inlineCode:false,apiRoutes:[{method:'GET',route:'/api/archive/public/p09/passage?passage_id=text%3Ap09-full-comparison-r1-proposed'},{method:'POST',route:'/api/archive/public/p09/corrections'}]};
}
