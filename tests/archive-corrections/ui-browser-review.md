# Revue navigateur indépendante — démonstration corrections

Date : 2026-10-03  
Route : `http://127.0.0.1:8787/demo/`  
Navigateur : Chrome 154.0.8037.93  
Verdict : **GO pour la porte fonctionnelle synthétique**

## Scénario transactionnel à deux onglets

1. Deux onglets ont été ouverts sur `synthetic-mvp-d-001:r1`.
2. Une proposition anonyme a été déposée depuis le premier onglet. Le texte courant est resté en r1 et la proposition a été enregistrée « En attente » avec sa base r1.
3. Une tentative de refus avec un secret incorrect a été rejetée. La proposition est restée en attente, le texte courant est resté en r1 et le motif de décision est resté dans le formulaire.
4. L’acceptation autorisée de cette proposition a créé `synthetic-mvp-d-001:r2`. L’historique conserve r1 et r2, ainsi que la proposition et la décision simulée.
5. Le second onglet, resté sur r1, a tenté de déposer un brouillon. Le service a signalé la base périmée sans créer de proposition et a conservé séparément le texte, le motif et la base r1.
6. Le bouton « Actualiser l’historique » a affiché r2 tout en conservant ce brouillon et sa base r1. Le bouton explicite « Utiliser la version affichée comme base » a ensuite changé seulement la base vers r2.
7. Le nouveau dépôt sur r2 a créé une seule proposition. Le rejeu strictement identique a retourné le même identifiant et le message « Rejeu confirmé, sans doublon » ; le nombre de propositions est resté à deux.
8. Le refus autorisé de cette seconde proposition a conservé le texte courant en r2 et ajouté une décision r2 → r2. Après rechargement complet, les deux propositions, les deux décisions et les deux révisions sont encore visibles.

Le champ secret est vide après rechargement complet. Le rechargement remet le formulaire de proposition sur le texte et la base courants, conformément au message de l’interface ; la conservation du brouillon a été validée avec l’actualisation interne, avant ce rechargement complet.

## Texte hostile et séparation données/DOM

La première proposition contenait volontairement des balises `<b>` et `<script>` dans son texte. Après acceptation et rechargement :

- les balises sont affichées littéralement dans r2 et dans l’historique ;
- leur représentation HTML est échappée (`&lt;b&gt;`, `&lt;script&gt;`) ;
- aucun élément `b` ou `script` n’est créé dans le bloc de version courante ;
- aucun script inline n’existe dans la page et le marqueur JavaScript de test reste indéfini.

## Accessibilité et mise en page

- Vue bureau : `clientWidth === scrollWidth === 1905`, sans débordement horizontal.
- Vue mobile Chrome via DevTools : viewport exact `390 × 844`, `html/body clientWidth === scrollWidth === 390`, aucun élément détecté hors du viewport.
- À 390 px, les contrôles principaux occupent 358 px et s’empilent verticalement. Les boutons accepter/refuser restent côte à côte à 173 px chacun.
- Parcours clavier observé : base → bouton de nouvelle base → texte → motif → dépôt. Chaque contrôle reçoit un contour vert plein de 2 px.
- Les formulaires portent des libellés accessibles ; les actions désactivées et les états de propositions sont exposés dans l’arbre d’accessibilité.

## Console, CSP et ressources

- Aucun événement `Runtime.exceptionThrown`, `Log.entryAdded` ou `Network.loadingFailed` n’a été relevé dans la session mobile isolée.
- La console de la session bureau ne contient aucune erreur de la page. Deux erreurs proviennent exclusivement de l’extension Zotero (`chrome-extension://…`) et sont hors application.
- La réponse HTML est `200`, `no-store`, `nosniff`, `no-referrer` et applique une CSP restrictive : `default-src 'none'`, scripts/styles/connexions limités à `self`, images/polices/objets interdits, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`.
- La page charge uniquement `/demo/app.mjs` et `/demo/styles.css`, sans script ni style inline.

## Limites

- Le passage, les identifiants fonctionnels et les décisions sont entièrement synthétiques. Cette revue ne couvre aucune archive réelle, identité humaine, authentification de production ou hébergement.
- La capture raster de cet hôte restitue seulement la couleur de fond malgré un DOM visible et interactif ; aucune capture trompeuse n’est jointe. Les mesures proviennent du DOM Chrome, du protocole DevTools et des interactions réelles.
