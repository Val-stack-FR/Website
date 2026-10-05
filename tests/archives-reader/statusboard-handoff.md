# Handoff — statusboard MVP-G

## Périmètre livré

- `scripts/archives/render-statusboard.mjs` : adaptation pure et rendu HTML statique de deux dossiers de consultation et cinq fiches éditoriales.
- `css/archives-statusboard.css` : mise en page responsive, sans script ni style inline.
- `tests/archives-reader/statusboard.test.mjs` : suite portable sur données entièrement synthétiques ; intégration privée optionnelle par variables d’environnement.

Le renderer refuse tout autre volume que **2 dossiers + 5 fiches**, ainsi que tout export déclaré publiable. Les dossiers et fiches restent deux types d’unités distincts. Aucun pourcentage du fonds ou d’activité d’agent n’est calculé.

## Contrat CLI

```text
node scripts/archives/render-statusboard.mjs \
  --reader <export-candidate.json> \
  --annex <query-index.json>
```

Le document HTML est écrit uniquement sur `stdout`. Le raccord doit enregistrer cette sortie dans le répertoire privé et ignoré choisi par le coordinateur ; le renderer ne choisit ni route ni destination de publication.

Les seules ressources demandées par le HTML sont :

- `/styles.css`
- `/css/archives-statusboard.css`

Aucun JavaScript n’est requis. Les deux liens sortants sont `/archives/` et `/archives/recherche/`.

## Sémantique de la vue réelle

- Monbezon : transcription partielle non relue, traduction absente, deux liens image acceptés, droits en attente ; prochaine action centrée sur la relecture contre ces deux vues.
- E.108 / Tucé : transcription partielle non relue, traduction absente, dates concurrentes, aucune vue déclarée et aucun lien image accepté ; la prochaine action exige une revue explicite avant tout lien image.
- Fiches : références éditoriales, jamais présentées comme actes transcrits ni personnes identifiées. Texte, traduction et image y sont marqués « non applicable », tandis que l’identification, les champs absents, les citations non vérifiées et les droits restent visibles.
- La priorité « Tucé » dépend seulement de la présence de `Tucé` dans le libellé source de l’unité. Elle couvre le dossier E.108 et quatre fiches. Monbezon et Jean de Bouillé restent visibles sans recevoir cette priorité.
- Aucun responsable n’existe dans les exports fournis : les sept unités affichent donc « À attribuer ».

## Validation

Suite portable :

```text
node --test tests/archives-reader/statusboard.test.mjs
```

Résultat : 4 réussites, 1 intégration privée ignorée explicitement, 0 échec.

Intégration privée explicite :

```text
ARCHIVE_STATUS_READER_EXPORT=<export-candidate.json>
ARCHIVE_STATUS_ANNEX_INDEX=<query-index.json>
node --test tests/archives-reader/statusboard.test.mjs
```

Résultat : 5/5 réussites. Le rendu réel contient exactement sept cartes, conserve Monbezon, E.108 et Jean de Bouillé, marque cinq unités prioritaires sur libellé Tucé, n’introduit aucun script/style inline et ne contient aucun pourcentage.

## Limites et raccord attendu

- Le statusboard ne modifie aucune donnée et ne propose aucune API de correction.
- Il ne lit aucun original ni pixel et ne vérifie pas les citations primaires.
- Le coordinateur doit raccorder la route privée et le serveur de prévisualisation, puis fournir l’URL pour la QA navigateur bureau/mobile.
- Cette vue ne doit pas être raccordée au build public tant que les deux exports restent en attente de droits et de revue.
