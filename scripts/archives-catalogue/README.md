# Catalogue local des fonds

Ce prototype affiche uniquement des métadonnées de découverte. Sa route prévue est `/archives/catalogue/`; le serveur autonome de contrôle écoute seulement sur `127.0.0.1` et expose les résultats filtrés par `/__catalogue_data`.

## Contrat rendu

`contract.mjs` accepte au maximum 20 000 occurrences et renvoie au maximum 50 occurrences par page. La vue initiale est `CLEAN`; la vue `all` doit être choisie explicitement. Une occurrence reste un fichier et ne devient jamais un acte. Les noms, dates, groupes et doublons conservent leur qualification de candidat ou d’inconnu. Un lien vers `/archives/` n’est accepté que s’il porte un identifiant `review:*` préservé.

Le navigateur reçoit des chemins logiques, des identifiants, des tailles, des états et des empreintes de provenance. Le contrat refuse les chemins absolus, les champs supplémentaires et les sources contenant un chemin physique. La page utilise `textContent` et ne place qu’une page de résultats dans le DOM.

## Adaptateur coverage

`adapt-coverage.mjs` convertit `coverage-object/1.0.0` et `coverage-relation/1.0.0` sans lire les originaux. Avant la conversion, il vérifie les empreintes de `catalogue.jsonl`, `relations.jsonl`, `summary.json` et `input-manifest.json` contre `checksums.json`. Il exige aussi :

- `summary.source_originals_read === false` ;
- `summary.excluded_rows === 0` ;
- un nombre de lignes égal à `summary.catalogued_rows` ;
- `coverage-input-manifest/1` ;
- une date de génération fournie explicitement par l’appelant.

Seules les entrées `discovery_role=image` sont projetées. Les neuf extensions image reconnues par le producteur coverage sont conservées. Les dates ne sont pas déduites des noms de fichiers. Les textes ne sont pas liés ou fusionnés.

La CLI projette maintenant CLEAN par défaut (`--collection-scope clean`).
`--collection-scope all` reste une option explicite d'inspection de l'adaptateur ;
le serveur de consultation intégré refuse toute occurrence hors CLEAN. Les
suffixes de fichiers nonimage et les marqueurs sans extension restent des
entrées d'inventaire contrôlées, sans être transformés en images. Tucé est
prioritaire dans l'ordre stable, sans exclure les autres familles CLEAN.

Le raccord lecteur fermé et la frontière du build public sont décrits dans
[`LOCAL-INTEGRATION.md`](../archives/LOCAL-INTEGRATION.md).

Les liens du lecteur nécessitent un second fichier explicite :

```json
{
  "schema_version": "archives-catalogue-reader-allowlist/0.1.0",
  "entries": [
    {
      "object_id": "object:path-<64 caractères hexadécimaux>",
      "href": "/archives/#identifiant-existant",
      "review_id": "review:identifiant-existant"
    }
  ]
}
```

L’adaptateur refuse une entrée si `canonical_link_status` n’est pas `accepted` ou si le même `review_id` n’apparaît pas dans `canonical_link_evidence`. Sans allowlist, aucun lien n’est produit.

Exemple de commande, à exécuter uniquement après validation des entrées privées :

```powershell
node scripts/archives-catalogue/adapt-coverage.mjs `
  --catalogue <catalogue.jsonl> `
  --relations <relations.jsonl> `
  --summary <summary.json> `
  --input-manifest <input-manifest.json> `
  --checksums <checksums.json> `
  --allowlist <allowlist.json> `
  --generated-at <date-ISO> `
  --output .private/catalogue-preview/catalogue.json
```

L’écriture utilise le mode création exclusive et refuse d’écraser une sortie existante.

## Contrôle avec données inventées

```powershell
node --test tests/archives-catalogue/*.test.mjs
node tests/archives-catalogue/write-invented-preview.mjs
node scripts/archives-catalogue/server.mjs --catalogue .private/catalogue-preview/invented-catalogue.json --port 8767
```

Le serveur ne sert aucun fichier arbitraire. Les pages, deux ressources propres à ce prototype, la feuille globale et le favicon forment sa liste fermée de routes. Les méthodes autres que `GET` et `HEAD` sont refusées.

