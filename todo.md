# Website — suivi de reprise

**Objectif :** préparer une unique PR révisable pour nettoyage, sécurité, GEO/SEO et continuité des instructions.

## En cours

- [ ] Finaliser les routes françaises et les contrôles de déploiement.

## À faire

- [x] Lire les instructions, vérifier `main`, les PR, les branches et l'état local — 2026-08-22.
- [x] Créer la branche locale `codex/security-geo-cleanup` depuis `main` — 2026-08-22.
- [ ] Archiver les deux branches personnelles avec tags vérifiés.
- [x] Mettre en place les instructions partagées, puis les adaptateurs `CLAUDE.md` et `AGENTS.md` — 2026-08-22.
- [x] Mettre à jour les commandes Claude obsolètes et les exemples d'URL — 2026-08-22.
- [x] Dépublier la bibliothèque : sortie `dist/`, navigation, sitemap, `llms.txt` et synchronisations supprimés — 2026-08-23.
- [ ] Corriger CI et finaliser les en-têtes de sécurité.
- [x] Isoler et valider le déploiement dans `dist/` — 2026-08-23 (About compilée ; `library.html` et `library/index.json` absents).
- [x] Mettre à niveau SheetJS vers `0.20.3` — 2026-08-22 (`npm audit` des scripts : 0 vulnérabilité).
- [ ] Rendre les pages principales crawlables et générer les routes françaises existantes.
- [ ] Mettre à jour canonicals, hreflang, sitemap, robots, `llms.txt` et JSON-LD.
- [ ] Vérifier UX : clavier, focus, mouvements réduits, langues et défilement Research.
- [x] Exécuter le build et contrôler le contenu de `dist/` — 2026-08-23.
- [ ] Faire une passe adverse Sol, corriger les constats substantiels, puis refaire les contrôles concernés.
- [ ] Créer les commits logiques, pousser et ouvrir une PR unique sans la fusionner.
- [ ] Vérifier le preview Vercel desktop/mobile et consigner les résultats.

## Fait

- [x] Création de ce suivi — 2026-08-22.

## Blocages et décisions en attente

- [x] Scripts natifs de build `esbuild` et `@swc/core` approuvés — 2026-08-23.

## Règles de tenue

- Mettre à jour ce fichier après chaque jalon significatif.
- Ne cocher une étape qu'avec une preuve vérifiable (commande, lien, SHA ou compte rendu).
- Conserver les décisions utilisateur et les blocages dans la section concernée, sans y exposer de données privées.

