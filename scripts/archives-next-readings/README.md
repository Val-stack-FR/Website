# P09 — raccord minimal préparé

Préparation **synthétique seulement**, 4 octobre 2026. Aucune transcription P09 réelle ni image n’est lue ou admise. Les prochaines données et leurs empreintes doivent venir du coordinateur après la revue visuelle indépendante. Ce module est une projection portable, **pas une gate d’admission** et pas un serveur.

## Sélection par le coordinateur

```js
import { composeNextReading } from './scripts/archives-next-readings/adapter.mjs';

const result = composeNextReading({
  enabled: enableAcceptedP09, // false : HTML strictement identique, aucun actif ajouté
  parentHtml,                // HTML du lecteur accepté par Root
  parentSha256,             // SHA-256 des bytes UTF-8 exacts du parent
  reading,                  // archive-next-reading/1, après admission Root
  sourceBuffers,            // Map source_id → Buffer texte/JSON accepté et épinglé
  qualifiedImages,          // un tuple accepté : IDs, vue, source/dérivé SHA, route, dimensions
});
// Remplacer seulement l'HTML du lecteur par result.html.
// Ajouter result.additionalAssets au manifeste/routage sélectionné par Root.
```

La carte anonyme est ajoutée **à la fin du rail existant**. Le client existant du lecteur compte les dossiers présents et prend en charge sa navigation et le zoom. Les trois onglets locaux sont « Texte de travail », « Français modernisé », « Photo ». Les sources, incertitudes et limites sont accessibles en détails. Aucun nom de personne, date ou acte canonique n’est construit depuis un filename. Le client ne fait ni requête applicative, stockage, formulaire, DB ni décision.

Actifs supplémentaires uniquement : `/assets/archives-next-reading.css` et `/assets/archives-next-reading.js`, provenant de `card.css` et `card.js` dans ce répertoire. CSP externe ; aucun code/style/handler inline. Aucun changement de route catalogue, texte C07, recherche, occurrences ou propositions. Root conserve ses166pages et992/89 ; le module ne les lit ni ne les réécrit. `scripts/archives-integration` et le H07 fermé restent hors ownership. Aucun TODO/ETAT ou `dist` n’est modifié.

## Entrée minimale

`reading.version = 'archive-next-reading/1'`. Le mode réel est `private-candidate` ; le mode de test est `synthetic-preparation`. Identifiants opaques exacts `candidate_id`, `fragment_id`, `slug`. Les champs `document_identified`, `historical_confirmation`, `publication_approved` sont `false`, `canonical_act_id` et `date` sont `null`, `person_ids=[]`, `human_review='pending'`, `rights='unknown'`. `limitations` est une liste non vide.

Une ou deux `sources` exactement consommées : `{id, format: 'utf8-text' | 'json', sha256}`. Chaque buffer est fourni par le coordinateur et rehashé avant décodage. Les deux `versions`, dans l’ordre `diplomatic` puis `modern-french`, portent `{id, kind, text_exact, text_sha256_utf8, utf8_byte_length, source_locator, uncertainties}`. Le locator contient `source_id`, `json_pointer` (null pour texte UTF-8), et `span: {coordinate_system:'unicode-codepoints', start, end}` demi-ouvert. Le texte affiché doit égaler exactement la tranche du conteneur : aucun trim, NFC ou remplacement CR/LF/BOM. Les pointeurs JSON sont RFC6901. Les fins CRLF/LF/CR sont reconnues et les **deux versions doivent chacune compter six lignes**, sans compter un terminateur final comme ligne supplémentaire. La signature des marqueurs de lacune est conservée ligne par ligne ; le module ne produit aucune modernisation.

Une incertitude contient `{id, status:'unresolved', span:{coordinate_system:'unicode-codepoints',start,end,exact_text}, note, alternatives:[]}` ; ses positions sont relatives à sa version. Zéro ou une alternative est permis, sans candidat ajouté. La fidélité paléographique et les correspondances sémantiques appartiennent à la revue amont ; une validation structurelle n’est pas cette revue.

Le tuple `qualifiedImages[0]` contient `qualification:'accepted-private-view'`, `source_object_id`, `view_id`, `source_sha256`, `derivative_sha256`, `route`, `width`, `height`, `canonical_view_id:null`, `limits`. `reading.photo` répète exactement les IDs/hash/route/dimensions/vue et ajoute `text_fragment_id===reading.fragment_id`, `transformation_applied:false`. Pas de résolution par basename ni de lecture/crop de pixels. La route est une route locale à hash dérivé admise : `__archive_draft_derivative`, `archives/media-releases/<32hex>/media/<64hex>.jpg` ou `archives/next-readings/media/<64hex>.jpg`. Le module n’en crée pas l’endpoint : Root doit conserver ou ajouter explicitement la vue qualifiée dans son allowlist.

En synthétique, la qualification est `synthetic-reference`, le panneau entier précise qu’aucune image n’est fournie/affichée, les hashes désignent des descripteurs inventés, et aucun `<img>` ni lien zoom n’est émis. Ne pas convertir ce run en dossier réel ni le publier.

## Petit build privé et preuves

`prepareNextReadingRun` de `build.mjs` prend les mêmes arguments et un `outputPath` neuf directement sous `.private/archives-next-readings/`. Il produit `reader.html`, `card.css`, `card.js`, et une preuve privée distincte. Les deux actifs sont copiés avec leurs bytes exacts ; aucun buffer texte source, image, DB ou configuration hôte n’est copié. Le dossier doit être neuf, jamais écrasé. La preuve et les sources de scripts ne sont pas des routes publiques. Ce build portable n’exécute pas le build public Root v5.

Commande de micro-vérification : `node --test scripts/archives-next-readings/adapter.test.mjs`. **3 tests passés sans skip**,12 refus ciblés (absence, offsets, source, vue, identité, lacune,5lignes, déplacements de lacune), régressions commentaires/raw-text, CRLF/BOM et deux textes dans un seul JSON ; build frais vérifié. Revue indépendante : trois P2 corrigés et recontrôlés, aucun constat restant. Pas de nouvelle batterie H07.

Run synthétique qualifié : `.private/archives-next-readings/p09-synthetic-94772049-0550-4e5c-bf58-577a963cec4f`, preuve `build-proof.json` SHA-256 **47538615c2983a0e628d980431ae308a2bbf95899dd70192481a6e7e31af69a4**. Les deux préparations antérieures sont conservées sans qualification finale ; aucune image n’existe dans ces runs. `preparation-checks.json` dans ce run consigne la remise et la conservation textuelle H07. Il n’existe aucun nouveau service, port ou navigateur P09 à ce stade.

**Suite autorisée après réception de Root :** consommer les chemins/pins P09 et preuve visuelle acceptés, relier leurs champs exacts à cette entrée, préparer un run réel neuf, puis effectuer l’unique gate navigateur ciblée avec texte diplomatique/modernisé, photo qualifiée, incertitudes, clavier/mobile. Aucun accès réel n’est nécessaire avant cette réception.
