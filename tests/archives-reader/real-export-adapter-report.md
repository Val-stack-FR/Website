# Adaptateur d’export réel — rapport MVP

Date : 3 octobre 2026

## Périmètre

Cette tranche adapte `atelier-tuce-reader/0.1.0` vers un modèle de vue privé et produit un HTML statique. Elle ne crée ni acte canonique, ni catalogue, ni API de correction. Le prototype public `archives/index.html` reste inchangé et ne reçoit aucune donnée réelle en attente de droits.

## Adaptations explicites

- Une entrée de `candidates[]` devient un **dossier de consultation**. `candidate_id`, `document_id` et `act_id` sont conservés séparément ; des IDs canoniques nuls restent nuls.
- `text_ids`, `date_ids` et `view_ids` sont résolus strictement. Une référence absente arrête le rendu au lieu d’être devinée.
- Une image est affichable seulement si les trois conditions sont réunies : la vue figure dans `candidate.view_ids`, son endpoint figure dans `approved_link.applied_target_object_ids`, et le `source_object_id` du lien accepté est exactement celui du texte du dossier.
- `reading_status: unreviewed`, `review_status: accepted` du lien et `publication_status: blocked-pending-rights` sont trois états affichés séparément.
- Toutes les expressions de dates rattachées au candidat sont affichées. Plusieurs expressions ou une certitude `disputed` déclenchent le libellé de conflit ; aucun arbitrage n’est inventé.
- `translation: null` produit un état absent sobre.
- En mode `local-preview`, chaque image utilise `/__archive_media/<sha256>`. Le manifeste de sortie contient seulement les SHA autorisés et les métadonnées de réponse utiles, jamais un chemin source.
- Le HTML est échappé avant interpolation. Un contrôle final refuse aussi les chemins locaux Windows ou UNC qui apparaîtraient dans les champs rendus.

## Commandes

Validation ciblée :

```text
node --check scripts/archives/render-reader.mjs
node --check tests/archives-reader/render-reader.test.mjs
node tests/archives-reader/render-reader.test.mjs
```

Rendu privé explicite :

```text
node scripts/archives/render-reader.mjs --input <run>/export-candidate.json --output .private/archives-mvp/<run> --media-mode local-preview --private-preview
```

Le CLI refuse une sortie extérieure au checkout ou non ignorée par Git. À entrée identique, il réécrit les mêmes octets pour `index.html` et `reader-media-selection.json`.

## Vérification sur l’export v5

L’export `atelier-e108-20261003-v5` produit un dossier E.108, zéro image et une sélection média vide. C’est le résultat attendu : `candidate.view_ids` est vide et le `source_object_id` de son texte ne correspond pas à celui du lien accepté présent dans ce run. Le HTML privé généré contient E.108, ne contient aucun chemin local et reste ignoré par Git.

`reader-media-selection.json` décrit les SHA effectivement référencés par le HTML ; ce n’est pas l’allowlist privée du serveur, qui conserve séparément les chemins relatifs contrôlés et les décisions approuvées.

## Vérification sur l’export MVP-B Monbezon + E.108

L’export `mvp-i2-monbezon-20261003-v1` produit deux dossiers de consultation dans `.private/archives-mvp/monbezon-v1` :

- Monbezon conserve des identifiants d’acte et de document nuls, résout son texte par `source_object_id` exact et affiche seulement ses deux `view_ids` reliés par le lien accepté ;
- E.108 conserve `view_ids: []`, affiche zéro image et ne récupère aucune photographie par voisinage ;
- les deux SHA sélectionnés sont `9d5a034f86206015b0e0e1f2d857a0ae2875c97a5bab8f401f1de5f665f89e5c` et `82f590739d54c8c74dab7435323fdc3b9375e38422ec63a9166fd9f8d6be59c9` ;
- le HTML ne contient aucun chemin local et reste ignoré par Git.

La QA Chrome du rendu et du serveur local est consignée dans `tests/archives-reader/mvp-browser-report.md`.

## Assets attendus du serveur de preview

- `/favicon.svg`
- `/styles.css`
- `/css/archives.css`
- `/js/archives-reader.js`
- `/__archive_media/<sha256>` pour les seuls SHA du manifeste privé

Aucune police ou ressource réseau n’est requise par le HTML généré.

## Limites

- Le renderer ne lit pas les originaux et ne sert aucun fichier ; le serveur local contrôlé reste un composant de coordination séparé.
- Les types recto/verso/copie ne sont pas déduits de `object_type: other`. Les vues restent numérotées tant que l’export ne porte pas un type attesté.
- Seul le profil privé en attente de droits est accepté dans ce MVP. Une publication réelle exige un autre chemin de release et une revue explicite.
