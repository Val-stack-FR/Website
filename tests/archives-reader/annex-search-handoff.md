# Handoff W02 — recherche bornée dans les annexes

Date : 3 octobre 2026

## Livrable

Ce mini-incrément transforme uniquement `mvp-f-annexes-20261003-v1/query-index.json` en une page HTML statique privée. Il couvre les mêmes cinq fiches : 28, 217, 225, 580 et 374. Il n’ajoute aucun catalogue, aucune identité, aucune source, aucune API et aucune persistance navigateur.

Le passage réel contrôlé contient cinq fiches, dix mentions de nom issues des fiches, treize entrées de variantes d’index, 105 localisateurs et deux sources munies d’un SHA-256. Le renderer ne lit aucun CSV ni original ; il consomme seulement l’index transmis.

## Comportement

- Recherche `contains` insensible à la casse et aux accents.
- Portées : noms, variantes, qualificatifs, lieux, seigneuries et juridictions.
- Les cinq fiches sont visibles sans JavaScript ; le script masque seulement les cartes qui ne correspondent pas.
- Les fiches 217 et 225 restent deux cartes distinctes pour « Guillaume de Tucé ». Leur homonymie est affichée comme non résolue, sans fusion.
- Une variante héritée est répétée sur chaque fiche candidate concernée avec le libellé explicite « occurrence non attestée dans cette fiche · rattachement candidat ».
- Chaque carte affiche la date littérale, les qualificatifs et autres expressions, puis la table, le numéro de fiche candidate, le numéro d’enregistrement, le champ et le SHA-256 de la source.
- Les références éditoriales du tableau sont présentées comme non vérifiées sur les citations primaires.
- Un résultat nul rappelle qu’il ne concerne que ces cinq fiches.
- Un lien interne mène au lecteur existant `/archives/`.

## Garde-fous du renderer

`prepareAnnexSearch` refuse notamment :

- un profil autre que `atelier-tuce-annex-query/0.1.0`, un index publiable ou une portée supplémentaire ;
- plus de cinq fiches ou plus de dix mentions de nom issues des fiches ;
- les IDs dupliqués, localisateurs/sources/dates/fiches absents et SHA-256 invalides ;
- une variante présentée comme occurrence de fiche ;
- une date, claim ou mention rattachée à une autre fiche ;
- deux numéros de fiche identiques, qui produiraient des IDs HTML concurrents ;
- une fiche qui ne conserve pas les états `unresolved` et `unreviewed`.

Toutes les valeurs injectées dans le HTML, y compris les attributs de recherche, sont échappées. Le document ne contient ni script, style ou événement inline, ni ressource réseau.

## CLI et raccord attendu

Le CLI écrit uniquement le HTML sur stdout :

```text
node scripts/archives/render-annex-search.mjs --index <query-index.json>
```

Le coordinateur peut rediriger cette sortie vers son emplacement privé déjà validé. Assets exacts à exposer par le serveur local :

- `/favicon.svg`
- `/styles.css`
- `/css/archives-search.css`
- `/js/archives-search.js`
- `/archives/` comme destination du lien vers le lecteur

Le renderer ne choisit pas de route ni de dossier de sortie et ne modifie pas le serveur, le build ou la navigation.

## Validation

```text
node --check scripts/archives/render-annex-search.mjs
node --check js/archives-search.js
node --test tests/archives-reader/annex-search.test.mjs
```

Résultat : quatre tests réussis. Ils couvrent l’index réel borné, les deux Guillaume distincts, la normalisation accent/casse, les six portées, la provenance complète, l’échappement XSS, la compatibilité CSP, les références invalides, les limites de périmètre, le refus d’un index publiable et l’identité exacte stdout du CLI.

Le passage critique final a ajouté deux contrôles avant handoff : unicité du numéro de fiche et cohérence fiche/date/claim/mention. La QA navigateur reste à effectuer après raccord de la route privée par le coordinateur.
