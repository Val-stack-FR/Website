# Website — suivi de reprise

**Objectif :** préparer une unique PR révisable pour nettoyage, sécurité, GEO/SEO et continuité des instructions.

## En cours

- [ ] Site prêt pour graphiques, images raster et tableaux illustrés dans les essais — 2026-10-17 : branche `figures/conventions-images` (empilée sur `figures/essai-temps-gagne`) ; `docs/figures.md` (arborescence, bloc `<figure>`, variantes, raster `srcset`, tableaux, accessibilité, impression, mobile, incohérences du design system), variantes CSS dans `css/essay-detail.css`, contrôle `scripts/check-figures.js` sans dépendance. Preuves : contrôle sur copie jetable avec les 3 snippets → 0 erreur ; cas fautifs (alt court, fichier absent, `style=`, légende absente, nombre de figures FR≠EN) → 7 erreurs détectées ; rendu `prerender.js` d'un raster `srcset`, d'un double panneau et d'un tableau : conservés hors `<p>`, 390 px et 1280 px sans défilement horizontal ni violation de CSP ; `node scripts/build-site.js` → exit 0, `docs/` et `scripts/` absents de `dist/`.
- [ ] Figures SVG FR/EN pour l'essai « La demi-heure introuvable » (non publié) — 2026-10-17 : branche `figures/essai-temps-gagne` ; 6 SVG copiés dans `essays/figures/` (aucun `style`, script ni lien) et CSS `.essay-figure` ajouté à `css/essay-detail.css`, sans insertion dans un essai publié. Preuves : blocs insérés dans une copie jetable de `who-pays-when-ai-is-wrong` (EN/FR) ; `prerender.js` avec `SITE_ROOT` → 3 `<figure>` intactes par page, aucune enveloppée dans `<p>` ; Chromium 390 et 1280 px sur `/essays/…/` et `/fr/essays/…/` : 3/3 images chargées, aucun défilement horizontal, aucun arrêt de Tab dans les figures, aucune violation de CSP ; route héritée (marked 9.1.6, EN) : 3 `figure.essay-figure` conservées ; `node scripts/build-site.js` → exit 0, `dist/essays/figures/` contient les 6 SVG. Décisions en attente ci-dessous.

- [x] Corrections factuelles FR/EN de *All the Unwritten Processes* et *Who Pays When AI Is Wrong?* — 2026-09-27 : outils radiologiques distincts ; corrélation Buçinca non établie retirée ; résultats expérimentaux et hypothèse d'ownership bornés. Branche `codex/fix-published-essay-evidence` ; sources : audits directs C-apprentissage-02 et C-apprentissage-06 dans BLOG_RECHERCHE. Rendu statique contrôlé sur les quatre routes, numéros de citations inchangés, quatre miroirs identiques octet par octet ; diff sans erreur d'espacement. Relecture manuelle ciblée FR/EN : mêmes dénominateurs et réserves, aucun problème restant identifié dans les passages modifiés. PR de revue à ouvrir, sans fusion automatique.

- [x] Redéploiement Vercel final vérifié ; PR #41 conservée en brouillon pour revue utilisateur — 2026-08-23 (commit `001982a`, check Vercel en succès, aucune fusion).

## À faire

- [x] Lire les instructions, vérifier `main`, les PR, les branches et l'état local — 2026-08-22.
- [x] Créer la branche locale `codex/security-geo-cleanup` depuis `main` — 2026-08-22.
- [x] Archiver les deux branches personnelles avec tags vérifiés — 2026-08-23 (`archive/pr-39-library` → `428c7e3`, `archive/pr-40-drafts-to-articles` → `577b021`; branches source conservées).
- [x] Mettre en place les instructions partagées, puis les adaptateurs `CLAUDE.md` et `AGENTS.md` — 2026-08-22.
- [x] Mettre à jour les commandes Claude obsolètes et les exemples d'URL — 2026-08-22.
- [x] Dépublier la bibliothèque : sortie `dist/`, navigation, sitemap, `llms.txt` et synchronisations supprimés — 2026-08-23.
- [x] Corriger CI et finaliser les en-têtes de sécurité — 2026-08-23 (aucun workflow GitHub Actions restant à pinner ; CSP sans `unsafe-*`, `frame-ancestors 'none'`, X-Frame-Options `DENY`).
- [x] Isoler et valider le déploiement dans `dist/` — 2026-08-23 (About compilée ; `library.html` et `library/index.json` absents).
- [x] Mettre à niveau SheetJS vers `0.20.3` — 2026-08-22 (`npm audit` des scripts : 0 vulnérabilité).
- [x] Rendre les pages principales crawlables et générer les routes françaises existantes — 2026-08-23 (12 essais et 3 critiques sous `/fr/.../`).
- [x] Reprendre les accroches des 12 essais en anglais et en français — 2026-08-23 (chaque promesse annonce désormais le mécanisme central ; « The Hand That Sorts the Cards » explicite le pont avec les tactiques et le « lieu propre » de Michel de Certeau).
- [x] Mettre à jour canonicals, hreflang, sitemap, robots, `llms.txt` et JSON-LD — 2026-08-23 (canonicals auto-référents, alternates EN/FR réciproques et JSON-LD `inLanguage: fr`).
- [x] Vérifier UX : clavier, focus, mouvements réduits, langues et défilement Research — 2026-08-23 (focus visible et `prefers-reduced-motion` sur les trois surfaces ; preview contrôlé sans débordement desktop/mobile, sélecteur EN/FR et Research opérationnels).
- [x] Exécuter le build et contrôler le contenu de `dist/` — 2026-08-23 (About compilée ; 15 routes FR ; ni Library ni fichiers internes dans `dist/`).
- [x] Faire une passe adverse, corriger les constats substantiels, puis refaire les contrôles concernés — 2026-08-23 (revue manuelle exhaustive : routes générées, artefacts `dist/`, CSP, entrées HTML et UX ; aucun constat bloquant. Le sous-agent Sol n'est pas disponible dans cette conversation latérale.)
- [x] Publier la branche et ouvrir la PR brouillon #41 sans fusion — 2026-08-23.
- [x] Vérifier le preview Vercel desktop/mobile et consigner les résultats — 2026-08-23 (deployment Ready ; Chrome authentifié : 1920×889 et 390×844, aucune erreur/avertissement console, aucun débordement, métadonnées FR et bascule EN/FR vérifiées ; Research charge et affiche ses cartes correctement).

## Fait

- [x] Création de ce suivi — 2026-08-22.

## Blocages et décisions en attente

- Figures de l'essai « La demi-heure introuvable » (PR brouillon, à relire) : slug et version EN de l'essai ; police des SVG (système actuellement) ; largeur 520 px ; légende longue sur mobile (repli ?) ; numérotation « Figure 1-3 » ; commit ou non des pages `index.html` régénérées.

- Corrections factuelles des deux essais FR/EN : [PR brouillon #42](https://github.com/Val-stack-FR/Website/pull/42), à relire et fusionner ; contrôles ciblés réussis, aucune fusion automatique.

- [x] Scripts natifs de build `esbuild` et `@swc/core` approuvés — 2026-08-23.
- PR distante : https://github.com/Val-stack-FR/Website/pull/41

## Règles de tenue

- Mettre à jour ce fichier après chaque jalon significatif.
- Ne cocher une étape qu'avec une preuve vérifiable (commande, lien, SHA ou compte rendu).
- Conserver les décisions utilisateur et les blocages dans la section concernée, sans y exposer de données privées.

