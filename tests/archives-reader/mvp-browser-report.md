# QA navigateur du lecteur privé MVP-B

Date : 3 octobre 2026

## Périmètre vérifié

La vérification porte sur le rendu privé `.private/archives-mvp/monbezon-v1`, produit depuis l’export `mvp-i2-monbezon-20261003-v1` et servi localement sur `http://127.0.0.1:8766/archives/`. Elle ne couvre ni publication, ni catalogue, ni API de correction.

Navigateur : Chrome piloté par CUA, en 1920 × 959 puis en 390 × 844. Les captures ont été inspectées pendant la session mais ne sont pas conservées dans Git, car elles montrent les photographies réelles.

## Résultats

### Données et états

- Le lien direct `#candidate-atelier-47958c7faa376f7e4729edd9babe9b40` ouvre Monbezon en position `1 / 2`, avec deux images associées.
- Le lien direct `#candidate-atelier-tuce-t03` ouvre E.108 en position `2 / 2`, avec zéro image associée.
- Les deux JPEG Monbezon sont réellement décodés par Chrome : `complete: true`, `naturalWidth: 3968`, `naturalHeight: 2976` pour chacun.
- E.108 affiche les états sobres « Traduction absente » et « Images non reliées ».
- Les expressions de date concurrentes de E.108 sont visibles, avec le libellé « Dates en conflit ou non départagées » ; aucun arbitrage historique n’est ajouté.
- Monbezon distingue bien `Publication · bloqué — droits en attente`, `Identification · candidat`, `Lecture · non relu` et `Lien image · accepté`.
- E.108 distingue `Publication · revue en attente`, `Identification · candidat`, `Lecture · non relu` et `Lien image · absent`.

### Navigation et focus

- Les boutons Suivant et Précédent mettent à jour l’ancre, la position `1 / 2` ou `2 / 2`, le titre courant et l’état désactivé du bouton de bord.
- Après le défilement animé, la piste atteint respectivement `scrollLeft: 1910` et `scrollLeft: 0` sur bureau. Le mouvement reste horizontal entre les deux dossiers.
- Les touches Flèche droite et Flèche gauche produisent le même résultat. Après chaque navigation, le focus arrive sur l’article cible (`tabindex="-1"`).
- Le zoom s’ouvre dans une boîte de dialogue, place le focus sur « Fermer », affiche une image décodée en 3968 × 2976, puis rend le focus au lien de vignette à la fermeture.

### Mise en page

- Sur bureau, chaque dossier mesure 1910 px et la piste 3820 px ; les panneaux transcription et traduction apparaissent sur deux colonnes.
- Sur mobile 390 × 844, le corps reste à 380 px sans débordement horizontal de page. Chaque dossier mesure 380 px, la piste reste horizontale, et les panneaux passent sur une colonne de 338 px.
- Les deux photographies Monbezon restent décodées sur mobile et s’affichent à 300 px de large dans leur panneau.
- La vue mobile de E.108 conserve le conflit de dates, les quatre états distincts et l’absence explicite de traduction et d’images.

### Ressources et console

Toutes les ressources attendues répondent en local :

| URL | Statut | Type | Taille reçue |
| --- | ---: | --- | ---: |
| `/archives/` | 200 | `text/html` | 13 909 octets |
| `/favicon.svg` | 200 | `image/svg+xml` | 1 714 octets |
| `/styles.css` | 200 | `text/css` | 16 639 octets |
| `/css/archives.css` | 200 | `text/css` | 11 600 octets |
| `/js/archives-reader.js` | 200 | `text/javascript` | 6 717 octets |
| `/__archive_media/9d5a…89e5c` | 200 | `image/jpeg` | 2 730 010 octets |
| `/__archive_media/82f5…59c9` | 200 | `image/jpeg` | 2 561 247 octets |

Un SHA tout à zéro, absent de l’allowlist, répond 404. La console Chrome ne contient ni avertissement ni erreur après les parcours testés.

## Limites

- Ce passage couvre Chrome et le serveur local contrôlé, pas d’autres moteurs ni un lecteur d’écran réel.
- Le chemin `prefers-reduced-motion` est présent dans le JS et le CSS, mais l’émulation de ce réglage n’était pas exposée par ce pilote navigateur ; il n’a donc pas été exercé en conditions réelles dans ce passage.
- Les captures CUA de cette page longue ont parfois saisi une étape intermédiaire de peinture pendant le défilement doux. Les positions finales, la géométrie DOM et les captures stabilisées concordent ; aucun défaut fonctionnel n’a été observé.

