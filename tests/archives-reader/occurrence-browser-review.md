# Revue navigateur adversariale de la lacune H05 — 3 octobre 2026

## Verdict

**GO borné pour la consultation locale privée sur les plans fonctionnel, sémantique, géométrique, clavier et de confidentialité, après correction du lien d’évitement.** La page réellement servie à `http://127.0.0.1:8766/archives/formes/` a été contrôlée à `1280 × 720` puis `390 × 844`. La lacune, la fenêtre SVG et l’image complète respectent le contrat H05. Aucun débordement horizontal, erreur console ou chargement privé inattendu n’a été observé.

La première passe avait isolé un écart d’accessibilité : « Aller à la lacune » était le premier arrêt clavier, devenait visible et recevait un contour sombre de `3px`, mais son activation ne transférait pas le focus au `<main id="occurrence">`. Depuis un chargement propre, `Entrée` produisait bien `#occurrence` et un léger défilement (`39px` au bureau, `27px` sur mobile), puis `document.activeElement` redevenait `body`; la tabulation suivante revenait au lien d’évitement.

Le coordinateur a ensuite ajouté `tabindex="-1"` au `main` et régénéré la page privée. La revue ciblée après redémarrage confirme la réparation dans les deux viewports : après `Entrée`, `document.activeElement.id === "occurrence"`, la cible satisfait `:focus-visible` et reçoit un contour `2px solid rgb(13, 61, 37)` avec un décalage de `3px`. La tabulation suivante atteint « Ouvrir la même image complète », premier contrôle suivant dans le contenu, avec son contour `3px solid rgb(13, 61, 37)` et un décalage de `4px`. Le défaut initial est donc **corrigé et revérifié**.

## Invariants de contenu et de cadrage

- Une seule balise `mark` contient exactement `----`, avec le nom accessible « Lacune sélectionnée, quatre tirets ». Les autres groupes de tirets et les retours à la ligne restent littéraux.
- Le SVG possède `viewBox="648 756 3127 564"`, `preserveAspectRatio="xMidYMid meet"`, un titre, une description et une image source. Il contient zéro `<rect>` : aucun rectangle exact de mot n’est fabriqué.
- Le `<image>` du SVG, le `<img>` complet et le lien « Ouvrir la même image complète » utilisent tous `/__archive_media/9d5a034f86206015b0e0e1f2d857a0ae2875c97a5bab8f401f1de5f665f89e5c`.
- L’image complète est décodée (`complete === true`) avec `naturalWidth = 3968` et `naturalHeight = 2976`; ses attributs HTML annoncent les mêmes dimensions.
- Le volet de détails conserve l’occurrence, les empreintes, l’intervalle `[133, 137)`, le rectangle de contexte, `candidate / possible`, `unresolved / unreviewed / private` et `null / []`. Aucune lecture, alternative, confirmation humaine, identification ou promotion en mémoire n’est affichée.
- L’avertissement « Cadrage à vérifier » reste visible et indique explicitement que l’orientation EXIF et l’affichage du navigateur ne sont pas conciliés et que le repère n’est pas un alignement validé à l’écran.

La mesure de métadonnées fournie séparément est conservée sans réinterprétation : **IFD0Orientation est présent avec la valeur `0`, invalide**. Elle n’est ni assimilée à une absence de balise ni remplacée par `1`. Le comportement effectif observé dans ce navigateur est une surface décodée de `3968 × 2976`, rendue au ratio `4:3`; cela ne prouve pas que le repère photographique est concilié avec l’orientation. L’avertissement de cadrage doit donc rester en place.

## Responsive et rendu effectif

Au bureau, la zone cliente mesure `1270px` pour le viewport `1280 × 720`. Les deux panneaux de comparaison occupent chacun environ `539px`; le SVG rendu mesure environ `539 × 99px` et l’image entière environ `1148 × 861px`. Aucun élément applicatif n’a `scrollWidth > clientWidth`.

Sur mobile, la zone cliente mesure `380px` pour le viewport `390 × 844`. Les panneaux passent à une colonne de `352px`, séparés par `17,5px`; l’en-tête de l’image entière passe en colonne et l’image est rendue à `322 × 242px`. Le volet de détails ouvert garde une largeur de `352px`, sa liste passe à une colonne et les identifiants longs se replient sans débordement. `documentElement.scrollWidth === clientWidth === 380`.

Contrairement à la limite raster rencontrée dans d’autres passes sur cet hôte, les captures CUA de cette revue ont montré le contenu réel en bureau et en mobile : texte, surlignage, photographie, panneaux et avertissement. Cette observation visuelle reste un échantillon et non une comparaison pixel à pixel. Les preuves fonctionnelles et géométriques ci-dessus reposent séparément sur le DOM, les dimensions calculées et les interactions.

## Sémantique, clavier et navigation

- Le document est en français, contient un seul `main`, un seul `h1`, trois sections et deux figures. Le SVG a `role="img"` avec titre, description et avertissement d’orientation associés. L’image complète possède un texte alternatif qui exclut explicitement tout mot délimité.
- Le lien d’évitement est le premier arrêt clavier. Son activation focalise désormais `main#occurrence`; la tabulation suivante passe au lien de l’image complète. Le comportement et les indicateurs de focus ont été reproduits à `1280 × 720` et `390 × 844`.
- Le volet « Révision, identifiants et limites » reçoit un contour de focus sombre de `3px`. `Entrée` l’ouvre et `Espace` le referme en conservant le focus sur `summary`, au bureau comme au format mobile testé.
- Le lien vers l’image complète reçoit le même contour de focus et expose la bonne URL SHA-256.
- Dans le lecteur `/archives/`, la navigation « Autres vues de l’atelier » contient « Rechercher dans les fiches », « Avancement des travaux » et « Une lacune à relire ». Ce dernier lien reçoit un contour sombre de `2px`; son activation clavier ouvre réellement `/archives/formes/`, avec le titre et le `h1` attendus.
- `/archives/recherche/` et `/archives/avancement/` restent accessibles et conservent respectivement leurs titres « Rechercher dans cinq fiches » et « État des unités ».

## Ressources, console et confidentialité

L’inventaire des ressources observées sur la page contient exactement deux feuilles de style locales (`/styles.css`, `/css/archives-occurrence.css`) et une image locale, celle de l’empreinte attendue. Il ne contient aucun script, font, vidéo, origine distante, JSON, chemin `.private`, chemin de corpus ou ressource d’original distincte. L’overlay interne du navigateur injecte ses propres éléments de commentaire ; ils sont exclus des constats sur le HTML applicatif.

Le journal de la page ne contient aucune erreur ni aucun avertissement après chargements bureau/mobile et interactions. Le HTML applicatif ne contient aucun script, gestionnaire d’événement inline ou style inline. Le `meta robots` vaut `noindex,nofollow,noarchive`.

La suite indépendante `node --test tests/archives-reader/occurrence.test.mjs tests/archives-reader/preview-server.test.mjs` donne **15 réussites, 0 échec, 1 intégration privée ignorée faute de variable explicite**. `node --check scripts/archives/render-occurrence.mjs` passe également. Ces tests confirment notamment que la route optionnelle et sa feuille de style sont les seules nouvelles ressources exposées et que les chemins privés restent refusés.

## Limites de preuve

Cette passe n’a rouvert aucun original, corpus, dérivé brut ou photographie hors de la ressource déjà servie par le serveur privé. Elle ne confirme ni lecture historique, authenticité, droits, crédits, orientation photographique, rectangle de mot, fermeture canonique ou gain mesuré. Elle valide uniquement le comportement de la page locale, ses ressources observables, sa sémantique, sa navigation et sa géométrie.
