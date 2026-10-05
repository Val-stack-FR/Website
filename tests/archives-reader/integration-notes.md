# Proposition d’intégration — fichiers réservés au coordinateur

Cette note ne modifie aucun fichier partagé.

- `scripts/build-site.js` : copier `archives/`, `css/archives.css` et `js/archives-reader.js` dans `dist/`. La fixture `archives/fixtures/reader-demo.json` sert uniquement au développement ; l’exclure de la publication réelle dès que l’adaptateur de corpus produit le HTML final.
- `scripts/prerender.js` : ne rien exiger pour le prototype, dont le contenu est déjà statique. Au raccord du corpus, générer une route `/archives/acts/<slug>/` par acte et conserver `/archives/#<slug>` comme repli ou redirection stable pendant la transition.
- navigation partagée : ajouter « Archives » vers `/archives/` aux pages existantes, après validation commune de l’ordre. La nouvelle page contient déjà son propre état actif.
- `vercel.json` / CSP : aucun nouvel hôte n’est requis pour cette tranche ; styles, script, SVG et JSON sont locaux. Ajouter plus tard uniquement l’origine exacte des dérivés d’image approuvés.
- `sitemap.xml` : ajouter `/archives/`, puis chaque route d’acte réellement générée. Ne pas indexer les identifiants `demo-*`.
- `todo.md` : noter le lecteur statique, la fixture isolée et les validations ; garder comme travaux ouverts l’adaptateur de corpus, les routes individuelles, les dérivés autorisés et l’API de propositions.

Le build final doit exclure `tests/archives-reader/`, les notes d’intégration et toute fixture de démonstration retirée de la release.
