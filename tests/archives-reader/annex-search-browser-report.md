# QA navigateur — recherche des annexes MVP-F

Date : 2026-10-03  
Route : `http://127.0.0.1:8766/archives/recherche/`  
Navigateur : Chrome 154.0.8037.93  
Verdict : **GO borné pour les cinq fiches**

## Couverture exécutée

- Vue bureau Chrome : largeur utile mesurée à 1910 px, `scrollWidth === clientWidth`, cinq cartes visibles au chargement.
- Vue mobile Chrome émulée par le protocole DevTools : viewport réel `390 × 844`, `html/body scrollWidth === clientWidth === 390`, aucun élément dépassant horizontalement. Le champ, le sélecteur et le bouton sont empilés sur 327 px de large.
- Sept options sont présentes dans le sélecteur : « Tous les champs » puis les six portées noms, variantes, qualificatifs, lieux, seigneuries et juridictions.

## Résultats fonctionnels

| Portée et saisie | Résultat observé |
| --- | --- |
| Noms — `Guillaume de Tuce` | 2/5 : fiches 217 et 225, conservées comme cartes distinctes avec homonymie non résolue. |
| Qualificatifs — `ecuyer` | 3/5 : 217 « Écuyer », 580 « Écuyer (pas encore cité) », 374 « Écuyer (pas cité) ». |
| Lieux — `sedille` | 1/5 : fiche 580. |
| Seigneuries — `guierche` | 2/5 : fiches 28 et 580. |
| Juridictions — `Dollon` | 1/5 : fiche 225. |
| Variantes — `Jehan de Bouille` | 1/5 : fiche 374. La variante est marquée « variante d’index uniquement », « occurrence non attestée » et « rattachement candidat ». Les noms de fiche restent « Jean de Bouillé » ; aucun nom-source `Jehan` n’est ajouté. |
| Tous — valeur volontairement hors lot | 0/5 avec le message : « Aucune de ces cinq fiches ne correspond. Ce résultat ne concerne pas le reste du corpus. » |

La recherche est insensible aux accents et à la casse dans les cas testés (`Tuce/Tucé`, `ecuyer/Écuyer`, `sedille/Sédille`). Le bouton « Effacer » restaure la portée globale, les cinq cartes et un champ vide, puis rend le focus au champ.

## Accessibilité, provenance et navigation

- Parcours clavier observé : champ → sélecteur → bouton. Le champ focalisé reçoit un contour jaune plein de 3 px.
- La saisie clavier déclenche le filtrage ; `Entrée` sur « Effacer » restaure les cinq résultats et le focus du champ.
- Les cinq cartes exposent un titre, une date littérale et un état de lecture/identification. Les deux Guillaume gardent leurs identifiants d’en-tête `fiche-217-title` et `fiche-225-title`.
- 62 blocs de provenance exposent table, fiche candidate, enregistrement, champ et SHA-256 source. Chaque fiche affiche l’avertissement « citations primaires non vérifiées » et un détail repliable pour les champs absents.
- Le lien « Ouvrir le lecteur d’archives » mène à `/archives/`. Le lecteur conserve ses deux dossiers et ses deux JPEG réels décodés (`3968 × 2976`, `naturalWidth > 0`). Le retour navigateur restaure la recherche et ses cinq cartes.

## Console, CSP et ressources

- Aucun événement `Runtime.exceptionThrown`, `Log.entryAdded` ou `Network.loadingFailed` n’a été relevé dans la session mobile isolée.
- La console de la session Chrome bureau ne contient aucune erreur de la page. Deux erreurs proviennent exclusivement de l’extension Zotero (`chrome-extension://…`) et sont hors application.
- Réponse HTML : `200`, `no-store`, `nosniff`, `no-referrer` et CSP `default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`.
- Ressources observées : `/styles.css`, `/css/archives-search.css` et `/js/archives-search.js`, toutes servies en `200`. Aucun script ou style inline ni origine distante n’est utilisé.

## Limites de cette passe

- La capture raster Chrome/CUA et Chrome headless est sortie uniformément couleur de fond sur cet hôte, alors que l’arbre d’accessibilité, les rectangles DOM, `elementFromPoint`, les styles calculés et les interactions indiquent tous le contenu visible. Ce défaut de capture empêche de joindre une preuve visuelle utile ; la capture vide n’est pas conservée comme preuve.
- La passe valide uniquement les cinq fiches du paquet privé courant. Elle ne couvre ni un catalogue élargi, ni l’exactitude historique des valeurs, ni les citations primaires.
