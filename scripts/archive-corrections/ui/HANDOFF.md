# Handoff W03 local — 3 octobre 2026

Base backend revue et acceptée : `eb096a8`. Checkout/branche inchangés : `Website-archives-corrections`, `codex/archive-corrections-mvp`. Cette tranche ajoute `ui/` et son test, adapte seulement le serveur et le contrat de transport, et ne modifie aucun lecteur réel, source historique, mémoire, build partagé, navigation globale ou TODO.

## Livré

- Une page fictive locale `/demo/`, CSS et trois modules externes. Consultation de version/propositions/révisions/décisions, dépôt anonyme, acceptation/refus simulés avec secret manuel.
- Origine normalisée ; Host et Origin exacts, origine absente autorisée pour les clients HTTP directs. Bearer serveur des décisions inchangé. Routes d'actifs explicitement listées, CSP restrictive sans script/style inline et sans ressource externe.
- Saisies, motifs, bases et sélection conservés dans la page en cas d'erreur et d'actualisation. Le choix d'une nouvelle base est un bouton explicite ; aucune acceptation/rebase automatique. Clé/payload identiques pour réessayer une action incertaine ; nouvelle clé après édition/changement d'action.
- Secret vide au chargement et seulement en mémoire, effacé sur demande/sortie/retour ; aucune persistance ni inclusion dans URL, logs ou export. Textes visiteurs rendus comme texte via `textContent`.
- Style sobre reprenant les couleurs du site personnel, sans modifier ses CSS globaux. États focus visibles, formulaires étiquetés, région de statut, layout à une colonne sur petit écran.

## Validation

Commande dans [README.md](README.md). Dernier run complet réellement exécuté : **19 tests passés, 0 échec, 0 ignoré** (backend 13 cas, plus 6 cas W03). W03 démontre HTTP actifs/CSP, refus des origines étrangères/null/voisines et vrai Host modifié, proposition autorisée sur origine valide, Bearer toujours requis pour décider, ancien texte conservé après acceptation, markup visiteur transmis littéralement sans insertion HTML, état de brouillon/rejeu indépendant du rafraîchissement, et origine HTTP sur port 80 normalisée sans bind d'un port réservé. Tous les serveurs de test sont arrêtés ; aucun service persistant n'a été lancé pour la QA.

Le premier essai du contrôle Host via `fetch` ne changeait pas réellement cet en-tête ; le test emploie désormais une requête `node:http` qui l'envoie effectivement. Le contrôle des chaînes visiteur utilise les fonctions de rendu avec un document de test qui interdit `innerHTML` et vérifie les nœuds/valeurs texte. Cela constitue une preuve de chemin de rendu sûr, pas une QA visuelle du navigateur.

## Porte suivante

Revue indépendante puis QA navigateur par le coordinateur, bornée au passage fictif : page/console/CSP, clavier/mobile, proposition/révision, secret incorrect, conflit entre onglets, champs conservés, nouvelle base explicite et rejeu après réponse réseau incertaine. Le service ne doit pas être raccordé à une lecture historique ou présenté comme validation humaine. Authentification réelle, service public, PostgreSQL et événements mémoire restent futurs.

Un rechargement complet abandonne la mémoire de page (brouillons, clés, secret) ; le bouton « Actualiser l’historique » conserve cette mémoire. Cette limite est visible dans le guide. Les données ne sont que synthétiques ; les magasins runtime sont ignorés et les serveurs de test arrêtés. Aucun push, PR, publication, fusion ou extension du corpus.
