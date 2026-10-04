# Base durable — pilote PostgreSQL préparé, 3 octobre 2026

Ce dossier prépare **un passage fictif** pour un processus Node durable derrière un proxy HTTPS et une base PostgreSQL séparée. Aucune ressource ni publication n'a été créée. Le fournisseur et le budget restent à choisir. SQLite D3 reste le fallback existant ; B2 privé continue son rôle de préservation des sources et n'est pas utilisé comme base des propositions. PostGIS n'est pas requis.

## Portée réellement exécutée

`pg` 8.23.1 et PGlite 0.5.8 sont figés dans le package/lock dédiés. La migration SQL 001, les contraintes relationnelles différées, les triggers append-only y compris TRUNCATE, les transactions, décisions, export/reprise/restauration ont été **exécutés sur PostgreSQL embarqué PGlite avec disque local**. Il s'agit d'un vrai moteur PostgreSQL en WASM, à connexion unique ; ce n'est pas la preuve d'un serveur PostgreSQL réseau ni d'une base managée. Voir [preuves](../../../tests/archive-corrections/durable-review.md).

L'adaptateur réseau `pg` réserve le même client du pool pour BEGIN, requêtes, COMMIT/ROLLBACK. Un verrou transactionnel commun au schéma protège idempotence et révision de départ entre processus. Le chemin réseau est préparé avec TLS vérifié, sans option de désactivation en URL ; aucune connexion réseau PostgreSQL n'a été tentée sans credential. La concurrence multi-connexion, les grants réseau et la reprise du fournisseur restent à tester.

Le serveur réutilise exactement `/v1/passages/{passage_id}`, propositions/décisions et snapshots D3. Les méthodes du stockage peuvent maintenant être asynchrones ; le serveur attend leurs résultats. Aucun ID, champ, révision ou format snapshot lecteur n'a changé. Le paquet Monbezon reste réservé au service D3 privé : il n'est pas importé dans ce pilote hébergé.

## Préparer localement et reproduire

Depuis le checkout, avec Node 24.19.0 et pnpm disponibles :

```powershell
pnpm --dir scripts/archive-corrections/hosted install --frozen-lockfile --ignore-scripts
node --test tests/archive-corrections/mvp.test.mjs tests/archive-corrections/ui.test.mjs tests/archive-corrections/session.test.mjs tests/archive-corrections/hosted.test.mjs
```

Les tests créent des magasins neufs ignorés, phrases aléatoires non affichées et ports dynamiques. Ils ne réutilisent ni 8787 ni 8789. Le service préparé utilise 8791 par défaut et écoute seulement loopback. Aucune installation globale.

Pour une préparation manuelle PGlite, choisir un répertoire neuf privé sous `.archive-corrections-private/`, créer son sous-dossier `auth`, puis renseigner **dans le processus** les noms ENGINE=pglite, PGLITE_DIRECTORY, AUTH_ROOT et PUBLIC_ORIGIN de `config.env.example`. Ce dernier vaut une origine HTTPS de test ou la future origine canonique ; il n'active aucune URL externe. Le serveur exige les requêtes d'un proxy loopback qui remplace Host et X-Forwarded-Proto ; ouvrir directement son URL HTTP sans ces en-têtes est volontairement refusé. Le test HTTP représente ce proxy, sans prouver un certificat TLS.

## Enrôlement, session, rotation et récupération

Le propriétaire/opérateur choisit une phrase privée de 20–256 caractères. Elle ne passe jamais dans les arguments, fichiers exportés ou logs :

```powershell
$ownerPhrase = Read-Host 'Phrase du pilote propriétaire' -AsSecureString
$env:ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE = [System.Net.NetworkCredential]::new('', $ownerPhrase).Password
try { node scripts/archive-corrections/hosted/service.mjs enroll }
finally { Remove-Item Env:ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE -ErrorAction SilentlyContinue }
```

Le root AUTH_ROOT doit exister, être privé et persisté/monté ; le fichier scrypt est sous `hosted-owner/owner-auth.json`. Le root ne contient pas de corpus et ne doit être servi par aucune route. `enroll` refuse l'écrasement. `rotate` remplace atomiquement le vérificateur et révoque les sessions à leur prochaine requête. Répéter le mécanisme de saisie avec `rotate` pour récupérer l'accès via le compte opérateur de l'hôte. Restreindre cet accès et ses sauvegardes séparément du rôle application ; c'est le compte opérateur, pas une récupération publique par email.

Cookie `__Host-archive_owner_session`, Secure/HttpOnly/SameSite=Strict/Path=/, sans Domain ; cookie et jeton CSRF aléatoires distincts. Origin exact obligatoire sur tous les POST hébergés. Session stockée en mémoire, 30 min d'inactivité / 8 h absolues, huit sessions maximum ; arrêt du processus = reconnexion. Déployer **une seule réplique applicative** pour ce pilote : partage de sessions/throttling et récupération humaine du compte hôte ne sont pas qualifiés. Le verrou PostgreSQL prépare l'édition concurrente, sans promettre une authentification multi-réplique. Toute réponse reste identity_verified:false et simulation:true ; la possession de la phrase ne vérifie pas l'identité de Val.

Limites serveur : JSON 32 KiB, contrôle de champs exacts, textes 5 000 caractères, cinq tentatives login/minute et 60 dépôts/minute globalement par processus. Préparer aussi une limite d'abus à la frontière HTTPS avant ouverture publique ; la limite globale du pilote permet encore un déni de service. Les refus n'appliquent aucun texte ni événement partiel. Le navigateur reçoit une file privée seulement après contrôle serveur. CSP reste sans inline/eval, contenu visiteur rendu en texte.

## Mise en service future, sans exécution cloud ici

1. Choisir et autoriser fournisseur/plan de base + hôte de processus Node durable, coût, backups et région. Un disque éphémère de fonction Vercel ne remplace pas PostgreSQL ; l'hôte de processus doit fonctionner PC éteint. Le site statique Vercel reste indépendant.
2. Mettre le credential PostgreSQL dans le secret manager de l'hôte. Utiliser le propriétaire de migration seulement pour `service.mjs migrate`. La migration est transactionnelle, versionnée par empreinte, refuse un schéma déjà occupé par autre chose. Le serveur refuse une migration absente/incompatible et ne la lance jamais au démarrage.
3. L'opérateur applique les grants préparés avec un rôle runtime existant distinct, après substitution du schéma validé. Il n'a besoin que d'USAGE, SELECT et INSERT, sans droits DDL/UPDATE/DELETE/TRUNCATE. Les grants sont une préparation, **pas une preuve d'application** ici.
4. Monter le root d'auth privé, enrôler le propriétaire, puis `node scripts/archive-corrections/hosted/service.mjs serve 8791`. Garder une seule réplique ; superviser le processus et protéger le compte opérateur qui permet la récupération/rotation.
5. Configurer un proxy HTTPS réel qui remplace Host/X-Forwarded-Proto selon `proxy.conf.example`, n'expose jamais le port loopback et ne cache aucune réponse. Certificat et stockage privés du proxy à fournir séparément. Préparer les seules réécritures même origine `/v1/*` et `/demo/*` du site Vercel vers cet hôte ; **aucun vercel.json du site n'a été modifié**. Revoir les en-têtes de rewrite sur la cible réelle : ne pas supposer que Vercel conserve Host.
6. Rejouer le parcours fictif contre le serveur PostgreSQL réel, avec deux clients/connexions indépendants, TLS réel, rôle runtime, redémarrage de processus et restauration ailleurs. Puis faire une connexion propriétaire humaine et le parcours navigateur autorisé. Le lecteur réel attend son manifeste/preflight et autorisation de diffusion ; l'essai fictif n'accorde pas des droits publics à Monbezon.

## Backup et rollback

Après arrêt ou pendant un processus PostgreSQL réseau (snapshot cohérent REPEATABLE READ), choisir un **nouveau fichier privé absolu** :

```text
node scripts/archive-corrections/hosted/service.mjs export NEW-ABSOLUTE-PRIVATE-FILE
```

Le snapshot logique exporte révisions, propositions, décisions, clés de rejeu et SHA-256, jamais la phrase/verificateur/session. Il reste privé (motifs/file) ; ne pas le placer dans dist. Le conserver dans deux domaines de panne avant de parler de sauvegarde hors-site. Aucune copie B2 ou sauvegarde managée n'a été exécutée ici. Conserver séparément configuration/version du code et credential opérateur, avec accès restreint ; restaurer le credential éditorial n'est pas implicite.

Pour restaurer, sélectionner une base/schéma corrections neuf, migrer puis :

```text
node scripts/archive-corrections/hosted/service.mjs migrate
node scripts/archive-corrections/hosted/service.mjs restore ABSOLUTE-PRIVATE-SNAPSHOT
node scripts/archive-corrections/hosted/service.mjs export NEW-ABSOLUTE-RESTORED-FILE
```

Import limité à 2 MiB dans ce MVP ; corps/hash/liens/révisions/idempotence vérifiés avant écriture. La restauration est transactionnelle, refuse une cible non vide, garde exactement IDs et révisions. Enrôler un credential distinct pour la cible restaurée. Pour PGlite, arrêter tout autre processus sur ce dataDir avant commande offline ; ne pas partager ce moteur entre processus.

Rollback d'une future bascule : fermer les mutations, produire un nouvel export, contrôler son hash/restauration, revenir au code précédent **compatible** et au magasin restauré (ou au service SQLite D3 local grâce au snapshot identique). Retirer la réécriture publique si nécessaire et garder les schémas/exports anciens intacts. Aucune migration de destruction/DROP de tables de journal n'est fournie ; le rollback conserve les preuves. Un fallback SQLite local ne fonctionne toujours pas PC éteint.

## Sources techniques vérifiées

[Transactions node-postgres](https://node-postgres.com/features/transactions), [TLS node-postgres](https://node-postgres.com/features/ssl), [verrous transactionnels PostgreSQL](https://www.postgresql.org/docs/18/functions-admin.html), [PGlite/PostgreSQL WASM](https://pglite.dev/docs/about), [persistance PGlite sur filesystem](https://pglite.dev/docs/filesystems). Ces références fondent la préparation ; elles ne prouvent pas notre cible cloud.
