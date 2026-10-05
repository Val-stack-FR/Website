# Remise — consultation privée d’une lacune H05

## Fichiers livrés et propriété

- `scripts/archives/render-occurrence.mjs` : fonctions pures `prepareOccurrence(input)` et `renderOccurrence(input)`, puis CLI de lecture du dérivé JSON et sortie HTML sur stdout.
- `css/archives-occurrence.css` : identité personnelle verte du Website, mise en page responsive, focus sombre, aucun chargement distant.
- `tests/archives-reader/occurrence.test.mjs` : huit tests portables regroupant les contrôles fonctionnels et un test réel uniquement opt-in.
- `tests/archives-reader/fixtures/synthetic-occurrence.mjs` : données entièrement inventées, sans pixels ni donnée historique.
- Cette remise.

Le renderer ne choisit aucune route, ne sauvegarde aucun HTML et ne modifie aucun dossier. Le raccord privé `/archives/formes/`, son autorisation de serveur et la QA navigateur appartiennent au coordinateur. Aucun build, ancien renderer, ancien asset, corpus, schéma canonique, navigation, todo ou autre dépôt n’a été modifié par cette tranche. Aucun commit, push ni publication.

## Contrat CLI et assets

Depuis le dépôt Website :

```powershell
node scripts/archives/render-occurrence.mjs --input <occurrence.json>
```

L’entrée est le seul objet privé `h05-real-occurrence/0.1.0` produit par le pilote H05. Les listes, autres profils, champs absents ou supplémentaires et états promus sont refusés. Le renderer n’accepte pas de paramètre de sortie. Enregistrer stdout seulement dans le répertoire privé `.private/` ignoré et validé par le coordinateur ; jamais dans `dist/`.

Ressources exactes du HTML réel :

- `/styles.css`
- `/css/archives-occurrence.css`
- `/favicon.svg`
- `/__archive_media/9d5a034f86206015b0e0e1f2d857a0ae2875c97a5bab8f401f1de5f665f89e5c`

La même URL image est utilisée trois fois : SVG de contexte, image entière et lien d’ouverture de la vue entière. Son empreinte vient exclusivement de l’objet accepté ; aucune URL ni origine externe n’est fournie par l’entrée. Aucun JavaScript n’est requis. Il n’y a aucun script, style ou événement inline.

## Cas réel et états conservés

Le dérivé réel a été lu, sans rouvrir l’original ni consulter de nouveaux pixels. Il a passé le validateur et le rendu en mémoire.

- Occurrence : `occurrence:h05-monbezon-photo1-001`.
- Image/vue : `object:path-d409e2fd87b2f1ae2c423d684945dbfd79ef5d68b7e2e5bbfc0f2cf05692c02f`.
- Dimensions natives déclarées : `3968 × 2976`.
- Révision du texte : `7be10cb405aadd1628c565dcbac7a6442d2b970c69a01f45cf6d43dd76b0e6b4`.
- Lacune littérale `----` : intervalle `[133, 137)`, index de base zéro en points de code Unicode, fin exclue. Le contexte précédent/suivant et ses retours à la ligne sont conservés ; seule cette lacune reçoit un surlignage textuel.
- Rectangle de contexte natif : `x=648, y=756, width=3127, height=564`.
- `target_bbox=null`, `alignment.status=candidate`, `alignment.confidence=possible`, `alternatives=[]`.
- `private`, `unreviewed`, `unresolved` ; aucune confirmation humaine, identification, lecture proposée ni promotion en mémoire.

Les identifiants, empreintes et révision sont dans un volet de détails. Les champs de chemin relatif, racine d’environnement, preuve locale, auteur/modèle, méthode et annexes privées ne sont ni incorporés au modèle d’affichage ni copiés dans le HTML. Le texte contextuel reste échappé comme texte littéral.

## Orientation et frontière de preuve

La fenêtre utilise le `viewBox` natif `648 756 3127 564` et un `<image href>` de même origine. Le navigateur affiche un cadrage de la même source, sans fichier crop, raster, copie, rotation ni aplatissement.

Le renderer vérifie la cohérence du relevé déclaré : limites entières, mêmes dimensions, référence de vue identique et conversion conservatrice du relevé d’affichage avec bornes basse arrondies vers le bas et hautes vers le haut. Il ne vérifie pas les bytes de la photographie, la permission de diffusion ou l’authenticité du dossier d’approbation ; le préflight et l’allowlist du serveur restent nécessaires.

L’orientation EXIF et celle appliquée par le navigateur ne sont pas conciliées dans cet incrément. Une alerte visible signale que le cadrage doit être vérifié et que le repère déclaré n’est pas un alignement validé à l’écran. La légende SVG et celle de l’image entière le rappellent. L’inspection séparée de métadonnées pourra établir ou refuser cette correspondance ; elle ne permettrait toujours pas de transformer le rectangle de contexte en rectangle de mot.

Les droits publics et une URL de session vérifiée restent non établis. Cette consultation ne crée aucun catalogue ou acte identifié, ne valide pas l’histoire et ne produit aucun gain de performance.

## Validation exécutée

Suite portable, sans variable locale :

```powershell
node --test tests/archives-reader/occurrence.test.mjs
```

Résultat : **8 réussites, 1 intégration réelle ignorée explicitement, 0 échec**.

Intégration réelle explicite, avec le chemin du dérivé privé fourni localement :

```powershell
$env:ARCHIVES_OCCURRENCE_INPUT = '<chemin local du dérivé occurrence.json>'
node --test tests/archives-reader/occurrence.test.mjs
Remove-Item Env:ARCHIVES_OCCURRENCE_INPUT
```

Résultat : **9/9 réussites**. Le test opt-in borne l’identité réelle, SHA image, vue, dimensions, intervalle textuel et rectangle. Aucune lecture d’image ou écriture de rendu réel n’est effectuée.

Les tests couvrent pureté, contexte Unicode astral/CRLF, positions et unités, limites de coordonnées, cohérence du relevé, source/vue/révision, profil/champs stricts, refus des promotions et lectures, injection textuelle/attributaire et absence des champs privés dans le HTML. La CLI est testée avec un JSON temporaire entièrement inventé, stdout seul, refus de `--output` et erreur JSON sans contenu sensible.

`node --check scripts/archives/render-occurrence.mjs` a passé. La QA navigateur bureau/mobile, l’affichage SVG sous CSP, le décodage de l’image réelle, la route privée et le focus clavier restent au coordinateur après raccord.
