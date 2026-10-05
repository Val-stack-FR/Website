# Rapport du MVP catalogue local

Date de revue : 2026-10-03. Périmètre : données inventées, interface autonome et contrat d’adaptation. Aucun original, aucune transcription privée et aucune sortie complète C03 n’ont été lus.

## Décision bornée

**GO pour revue et raccord local du prototype sur données inventées.** La route prévue est `/archives/catalogue/`. Le prototype n’est pas qualifié sur le catalogue réel : le producteur C03 prépare encore une v2 et le feu vert de lecture n’a pas été donné. La navigation globale, le build public et les fichiers existants du lecteur n’ont pas été modifiés.

## Contenu livré

- `scripts/archives-catalogue/render-page.mjs`, `catalogue.css` et `catalogue.js` : page simple, responsive et accessible, sans style ou script en ligne.
- `scripts/archives-catalogue/contract.mjs` : validation stricte, 20 000 occurrences maximum, vue CLEAN par défaut, 50 résultats maximum par page, ordre stable.
- `scripts/archives-catalogue/server.mjs` : serveur autonome lié à `127.0.0.1`, routes fermées et données filtrées par `/__catalogue_data`.
- `scripts/archives-catalogue/adapt-coverage.mjs` : adaptateur structurel de `coverage-object/1.0.0` et `coverage-relation/1.0.0`.
- `tests/archives-catalogue/fixtures/invented-catalogue.mjs` : 123 occurrences entièrement inventées couvrant homonymes, autre famille, inconnus, groupes candidats, doublons possibles, pagination, chaîne HTML hostile et lien fictif allowlisté.

L’interface affiche clairement « fichier inventorié · pas un acte identifié ». Les noms, dates, groupes et doublons gardent une qualification candidate ou inconnue. Les occurrences possibles d’un doublon restent séparées. Les versions de texte inventées restent distinctes et non validées. Le seul lien de consultation de la fixture provient d’une allowlist explicite.

## Preuves automatisées

Commande : `node --test tests/archives-catalogue/*.test.mjs`.

Résultat final : **10 tests réussis, 0 échec**, durée 0,80 s. Couverture utile :

- vue CLEAN par défaut et opt-in « toutes les collections » ;
- recherche dans noms candidats et chemins logiques, filtres type/état/priorité ;
- homonymes et doublons conservés comme occurrences distinctes ;
- pages stables de 50, 123 occurrences réparties 50/50/23 ;
- charge contractuelle de 20 000 métadonnées, page 400 limitée à 50 ;
- refus d’un chemin absolu, d’une source contenant un chemin, d’un champ physique supplémentaire et d’un lien non autorisé ;
- absence de puits HTML (`innerHTML`, `document.write`, etc.) ;
- serveur : `GET`/`HEAD` seulement, CSP, `no-store`, paramètres bornés, routes privées/arbitraires en 404 ;
- adaptateur : contrôle des quatre empreintes, rejet de dérive, preuve `source_originals_read=false`, projection image seulement, lien exigeant le même `review_id`.

Les cinq sources JavaScript ont aussi passé `node --check`.

## Revue navigateur CUA

Serveur autonome contrôlé sur `http://127.0.0.1:8767/archives/catalogue/` avec la fixture inventée.

### Bureau — 1280 × 720

- largeur utile 1 270 px et largeur déroulante 1 270 px : aucun débordement horizontal ;
- 123 fichiers inventoriés, 106 dans CLEAN, 1 lien fictif autorisé, 106 correspondances par défaut ;
- 50 cartes dans le DOM, page 1 sur 3 ; dernière page : 6 cartes et libellé 101–106 sur 106 ;
- recherche « Marie Martin » : deux cartes et deux identifiants distincts ;
- recherche « durand » après choix de toutes les collections : une occurrence `AUTRE/Famille Durand/portrait.jpg` ;
- remise à zéro : champ vide, scope `clean`, 106 résultats et focus rendu au champ de recherche ;
- chaîne `<img ...>` et nom `<script>...` rendus littéralement : zéro élément `img` et zéro élément `script` dans les résultats ;
- aucun avertissement ou erreur console provenant de `127.0.0.1:8767`.

Parcours clavier : premier `Tab` rend visible « Aller à la recherche » avec contour ; `Entrée` place le focus sur `form#catalogue-search` ; le `Tab` suivant place le focus sur `input#catalogue-query`, contour 3 px.

### Mobile — 390 × 844

- largeurs document 380/380 px : aucun débordement horizontal ;
- formulaire et liste sur une colonne ; 50 cartes maximum ;
- même parcours d’évitement et même indicateur de focus 3 px ;
- filtre hostile ramené à une carte, détails de provenance ouverts au clavier/souris et valeurs lisibles ;
- empreinte, fraîcheur `not_provided`, date d’observation et modification inconnue affichées séparément.

Les captures CUA ont montré un rendu effectif lisible dans les deux tailles. La collecte automatisée des entrées Resource Timing n’était pas disponible dans le contexte isolé CUA. La confidentialité réseau reste couverte par la liste fermée de routes du serveur, le CSP `connect-src 'self'`, l’inspection du client (seul `/__catalogue_data` est appelé) et les tests HTTP qui refusent les chemins arbitraires.

## Contrat de raccord C03 préparé

L’adaptateur attend `catalogue.jsonl`, `relations.jsonl`, `summary.json`, `input-manifest.json` et `checksums.json`. Il recalcule les empreintes de ces quatre entrées déclarées, exige une projection complète (`excluded_rows=0`) et refuse toute exécution si les originaux sont déclarés lus. Il ne copie jamais les locators du manifeste dans la réponse navigateur.

Seules les lignes `discovery_role=image` sont projetées. Le nom de fichier reste candidat, la date reste inconnue, les groupes restent candidats, et les autres collections restent isolées de la vue CLEAN. Les liens du lecteur demandent un fichier `archives-catalogue-reader-allowlist/0.1.0`; sans ce fichier, aucun lien n’est rendu.

## Limites et raccord restant

- Aucun chiffre réel, nom réel ou fait historique n’a été contrôlé dans cette voie.
- La v2 C03 annoncée par le producteur doit être finalisée puis revue avant toute adaptation réelle.
- L’allowlist réelle des liens lecteur doit être construite depuis les liens déjà approuvés; `canonical_link_status=accepted` seul ne suffit pas.
- Le coordinateur doit intégrer la route, les deux ressources propres et la navigation dans le serveur privé principal. Le serveur autonome n’a touché ni au build public ni aux fichiers du lecteur existant.
- Le serveur 8767 de contrôle a été arrêté après la revue.

