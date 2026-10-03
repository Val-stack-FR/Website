# Revue navigateur adversariale du statusboard MVP-G — 3 octobre 2026

## Verdict

**GO pour la consultation locale privée du MVP-G, sur les plans fonctionnel, sémantique et géométrique.** La revue a couvert la page réellement servie à `http://127.0.0.1:8766/archives/avancement/`, au viewport bureau `1280 × 720` puis au viewport mobile demandé `390 × 844`.

Un défaut d’accessibilité matériel a été trouvé pendant la revue : l’indicateur de focus jaune initial n’offrait que `1,37:1` sur le fond de page et `1,50:1` sur les cartes, sous le seuil non textuel de `3:1`. Le coordinateur a remplacé cette couleur par `var(--status-ink)` dans `css/archives-statusboard.css`. La page servie après correction affiche bien un contour `3px solid rgb(11, 54, 37)` ; les contrastes mesurés sont désormais `11,70:1` sur le fond de page et `12,74:1` sur les cartes. Ce point est donc **corrigé et revérifié**.

Le GO ne vaut pas comme validation visuelle par pixels. Les captures raster de cet hôte sont encore inexploitables : en bureau comme en mobile, elles montrent seulement un aplat vert pâle et la barre de défilement, alors que le DOM accessible, les styles calculés et les interactions sont présents. Aucune appréciation de rendu pixel, de finition graphique ou d’absence de défaut visuel subtil n’est revendiquée.

## Code et tests relus

- `scripts/archives/render-statusboard.mjs` impose exactement deux dossiers et cinq fiches, refuse les exports déclarés publiables et échappe les valeurs injectées dans le HTML. Il ne produit aucun script, style inline ni gestionnaire d’événement inline.
- Les unités gardent des clés, types, états, blocages, actions, incertitudes et identifiants source distincts. Les cinq fiches ajoutent une provenance structurée : table source, numéro d’enregistrement, champ daté et SHA-256.
- `css/archives-statusboard.css` passe les grilles principales à une colonne sous `820px`, puis l’en-tête des cartes, les métadonnées et la provenance à une colonne sous `520px`.
- `scripts/archives/preview-server.mjs` n’expose que les routes explicitement autorisées. La CSP servie reste sans `unsafe-inline` et sans `unsafe-eval`.
- Exécution indépendante de `node --test tests/archives-reader/statusboard.test.mjs tests/archives-reader/preview-server.test.mjs` : **10 réussites, 0 échec, 1 intégration privée ignorée faute de variables d’environnement**. Le test hostile confirme l’échappement de balises et d’attributs injectables. Les preuves antérieures de l’intégration privée réelle et de la suite portable plus large sont consignées dans les rapports de handoff et de coordination ; elles n’ont pas été présentées comme réexécutées ici.

## Interactions réelles dans le navigateur

- Le document charge complètement, avec un `h1`, deux sections `h2`, sept cartes `article` correctement reliées à leur `h3` par `aria-labelledby`, puis leurs sous-sections `h4`.
- La séquence `Tab` réelle est cohérente : lien d’évitement, lien vers le lecteur, lien vers la recherche, puis les sept résumés « Incertitudes conservées ». Les dix contrôles reçoivent le contour de focus corrigé.
- Le lien d’évitement est le premier arrêt clavier. Son activation produit `#statusboard`, place la cible au début visible de la page et le `Tab` suivant rejoint « Lecteur d’archives ».
- La première incertitude a été ouverte par activation, puis refermée avec `Espace`. L’incertitude E.108 a aussi été ouverte au viewport mobile ; son contenu reste dans la largeur de la carte.
- « Lecteur d’archives » ouvre réellement `/archives/`, titre « Consultation privée des archives », `h1` « Consultation ».
- « Recherche dans cinq fiches » ouvre réellement `/archives/recherche/`, titre « Recherche dans cinq fiches d’annexes », `h1` « Rechercher dans cinq fiches ».
- Aucun avertissement ni erreur n’apparaît dans les journaux navigateur.

## Contenu réel et bornage

La page contient exactement **7 cartes** : **2 dossiers de consultation** et **5 fiches éditoriales**. Elle contient exactement **5 priorités** dérivées du libellé `Tucé` : le dossier E.108 et quatre fiches. Monbezon et Jean de Bouillé restent présents avec la priorité ordinaire. Les sept responsables valent « À attribuer ».

- Monbezon conserve `1 transcription · partielle · non relu`, `Absente de l’export` et `2 liens image acceptés`. Ses blocages séparent transcription partielle, traduction absente, lecture non relue et droits en attente.
- E.108 conserve `Aucun lien image accepté`, le blocage « Aucune vue déclarée et aucun lien image accepté » et « Dates concurrentes non départagées ». Son détail d’incertitude demande de départager les dates sur pièces.
- Les cinq fiches sont explicitement présentées comme des fiches éditoriales, pas comme des actes transcrits, des personnes identifiées ou des originaux lus. Texte, traduction et image y sont « Non applicable » ; identification, citations primaires, champs absents, homonymies éventuelles et droits restent en attente.
- Jean de Bouillé est conservé comme cinquième fiche, avec identification non résolue et priorité ordinaire.
- Les cartes ne contiennent aucun lien, image ou script. Les dossiers exposent seulement leur identifiant source ; les fiches exposent en plus leur provenance structurée. Aucun endpoint d’original ou d’export brut n’est lié depuis la page.

Deux incohérences éditoriales mineures restent visibles et ne bloquent pas le MVP local : le qualificatif de certitude E.108 apparaît comme `disputed`, et plusieurs contenus d’incertitude issus des sources restent en anglais. Une normalisation française est recommandée avant une diffusion à un public plus large, sans altérer les valeurs sources.

## Géométrie et lisibilité mesurées

Au bureau, la zone cliente mesure `1270px` pour un viewport de `1280px` ; la grille est composée de deux colonnes de `591px`, sans élément hors largeur ni débordement intrinsèque. Sur mobile, la zone cliente mesure `380px` pour le viewport `390 × 844` ; la grille principale, l’en-tête de carte, les métadonnées, les blocs de travail et la provenance passent tous à une colonne. Les cartes mesurent `352px` et aucun élément visible ne dépasse horizontalement.

Les couleurs de texte représentatives satisfont la lisibilité mesurable : texte principal `14,39:1`, texte atténué du héros `5,43:1`, titre de carte `12,74:1`, statut `9,36:1`, responsable `5,91:1`, résumé d’incertitude `5,63:1` et badge prioritaire `9,42:1`. Les libellés monospace les plus petits calculés à `10,36px` restent toutefois un point à inspecter sur un hôte où le raster fonctionne ; cette revue ne peut pas confirmer leur confort visuel réel.

## Routes, en-têtes et absence d’exposition brute

Les contrôles HTTP indépendants donnent `200` pour `/archives/avancement/`, `/archives/`, `/archives/recherche/`, `/styles.css` et `/css/archives-statusboard.css`. Ils donnent `404` pour `/export-candidate.json`, `/query-index.json`, `/private-status.html`, `/archives/avancement/?file=.env`, `/.git/config` et `/.private/archives-mvp/integrated-v2/export-candidate.json`.

La réponse du statusboard porte `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` et la CSP attendue. Le HTML source servi contient sept marqueurs de carte, cinq marqueurs prioritaires, zéro script, zéro style inline, zéro gestionnaire inline, zéro lien vers original/export/JSON/média et zéro chemin local absolu ou `.private`.

## Limite de preuve

Cette revue prouve le comportement du navigateur, la navigation, le clavier, les états de détails, la géométrie calculée, les contrastes calculés, les journaux et les réponses HTTP. Elle ne prouve pas le rendu visuel pixel à pixel : les deux captures produites par le navigateur sont uniformément vides malgré un DOM valide et interactif. Une capture sur un hôte fonctionnel reste utile avant tout élargissement ou présentation visuelle, sans remettre en cause le GO fonctionnel et géométrique local établi ici.
