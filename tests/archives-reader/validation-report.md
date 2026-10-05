# Validation bornée — lecteur d’archives

Date : 3 octobre 2026

## Contrôles réussis

- `node tests/archives-reader/validate-reader.mjs` : fixture explicitement de démonstration, trois actes statiques, ordre transcription → traduction → images, cinq types de vues, références média présentes, absence de script/style/événement inline, absence de persistance locale et de chemins privés.
- `node --check js/archives-reader.js` et `node --check tests/archives-reader/serve-local.mjs` : syntaxe valide.
- `git diff --check` : aucune erreur d’espace ou de fin de ligne.
- Chrome, affichage bureau : charte claire existante conservée, états éditoriaux visibles, deux panneaux de texte lisibles côte à côte, galerie ensuite.
- Chrome, viewport 390 × 844 : largeur d’un acte 380 px, piste 1 140 px pour trois actes, débordement horizontal du `body` masqué, panneaux internes sur une colonne de 338 px. Les actes restent donc horizontaux tandis que le contenu d’un acte reste vertical.
- Navigation : le contrôle Suivant passe de l’acte A à B, met à jour l’ancre, `2 / 3`, le titre et la région `aria-live`. La flèche droite depuis la piste passe de B à C. Le lien direct `#demo-acte-b` recharge correctement l’acte B.
- Galerie : le lien d’agrandissement ouvre un `dialog` natif ; sur le viewport mobile, sa boîte calculée mesure environ 367 × 776 px, porte l’alternative et la légende attendues, puis rend le focus au contrôle après fermeture.
- Console Chrome : aucune erreur ni alerte pendant les parcours contrôlés.

## Limites connues

- Le build existant copie et pré-rend ses pages habituelles, puis s’arrête parce que `npm.cmd` n’est pas disponible dans l’environnement d’exécution. Le build complet reste donc non vérifié ici.
- Le build partagé n’inclut pas encore `/archives/`, conformément au périmètre réservé au coordinateur. La proposition exacte est dans `integration-notes.md`.
- `prefers-reduced-motion` est traité dans la feuille de styles et utilise un déplacement sans animation dans le script ; la préférence système n’a pas été simulée dans le navigateur disponible.
- Aucun audit automatisé WCAG complet n’a été exécuté. La structure accessible, les intitulés, l’ordre du DOM, le clavier, le focus du dialogue et les annonces ont été contrôlés via l’arbre d’accessibilité du navigateur.
- Les SVG sont de petits substituts de QA. Aucun scan, média B2, texte réel ou donnée privée n’est inclus.
