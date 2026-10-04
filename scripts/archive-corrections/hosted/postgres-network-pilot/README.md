# D6 — PostgreSQL réel en TCP loopback

Ce pilote utilise exclusivement des fixtures inventées, un cluster PostgreSQL neuf et deux processus Node A/B neufs. D4, D5, H06, le handler corrigé par le coordinateur et leurs anciennes preuves sont lus sans modification. Le runtime, la base, les credentials aléatoires et les preuves restent dans un nouveau `.archive-corrections-private/d6-network-*`. Aucune installation, service Windows, compte humain, configuration système, publication ou modification Git.

## Runtime et préparation

Les emplacements PostgreSQL habituels et le runtime fourni ont été inspectés, sans scan de Z ni lecture de configuration de production. Aucun PostgreSQL utilisable n’y a été trouvé.

[PostgreSQL Windows](https://www.postgresql.org/download/windows/) renvoie officiellement vers les [archives ZIP EDB](https://www.enterprisedb.com/download-postgresql-binaries). La page effectivement enregistrée lie Windows x64 version 18.6 à `fileid=1260609`, qui redirige vers [postgresql-18.6-5-windows-x64-binaries.zip](https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip). Taille observée : 384620317 bytes. SHA-256 local : `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2`.

Le fournisseur ne présentait aucun SHA-256 publié dans cette page ni dans la réponse. Ce hash constitue un pin local des bytes téléchargés via HTTPS officiel, sans prétendre vérifier un checksum publié. Les exécutables ont leurs hashes et états Authenticode consignés ; toutes les DLL/fichiers extraits sont épinglés avant exécution. Seuls `pgsql/bin`, `pgsql/lib`, `pgsql/share` et les mentions de licence sont extraits. Aucun installateur lancé.

`prepare-runtime.ps1` refuse tout écrasement. `plan-run.ps1` relit les pins et produit le manifeste d’entrée, le préflight et un manifeste opérationnel avant PostgreSQL. La configuration privée contient quatre secrets aléatoires de fixture. Elle n’est jamais un log ni un output publiable ; aucun secret n’est passé dans une URL/argument ou enregistré dans les preuves. L’archive/runtime peuvent être réutilisés **en lecture seule** par un nouveau run via `-RuntimeRunDirectory`.

## Gate et concurrence

La première gate crée une base vide, exécute les migrations 001/002 figées, constate deux clients TCP avec backend PID/port client distincts et serveur 127.0.0.1. Un INSERT non commis est invisible à l’autre connexion ; une erreur SQL réelle `22012` entraîne ROLLBACK et zéro ligne persistée. Aucun handler n’est démarré tant que cette gate n’est pas entièrement passée.

Une deuxième base neuve reçoit la seule fixture D5 et un rôle SQL applicatif créé pour le test. Les grants D5 existants sont réellement appliqués. A/B sont deux processus Node et deux pools `pg` 8.23.1 indépendants, chacun à deux connexions. Ils utilisent le `sharedPoolDriver`, `ServerlessStore`, `SharedSessions` et `createHandler` originaux ; aucune connexion PGlite, shim ou faux SQL. Le handler requis a le hash `1a2235125ab644bfe3b031750ef4c9c650bd334d18d7bf37076a1e30bfa1ba33`.

Les preuves visent : session A reconnue par B, autorisation/CSRF, deux décisions concurrentes sur la même révision (201/409), rejeu identique sur A/B, logout/revoke-all partagés, six tentatives concurrentes et limite SQL commune de cinq/minute, puis export éditorial et restauration exacte dans une troisième base neuve. Des traces sans paramètres ni corps HTTP montrent le PID du client et BEGIN/COMMIT/ROLLBACK, avec autorisation et insertion de décision sur le même client/transaction. Aucun token, phrase, HMAC, salt ou verifier n’est copié dans ces traces.

## Portée

Le serveur PostgreSQL et les deux handlers écoutent seulement sur `127.0.0.1`, ports libres. Les credentials PostgreSQL utilisent SCRAM. Le transport SQL de ce test est **sans TLS**, uniquement en loopback. Le label HTTPS/Host/Origin du handler est une fixture de proxy, pas une preuve HTTPS. La création réseau D5 avec TLS fournisseur, `attachDatabasePool`, Vercel, le build/déploiement, les accès distants et la charge restent à qualifier séparément. Aucune identité humaine ni lecture historique.

`execute.ps1` vérifie les sources/runtime avant tout programme PostgreSQL, utilise les binaires absolus sans changer PATH, initialise une base neuve et arrête uniquement son propre cluster par `pg_ctl -D` après vérification du PID dans ce dossier. Les workers A/B sont arrêtés par leur propre IPC ; aucun processus existant n’est recherché ou tué. Aucun nettoyage récursif. Les bases et logs sont conservés après arrêt.

Pour une reprise, utiliser un **nouveau** dossier privé ; les runs sont immuables et `pgdata` ne peut pas être réinitialisé par le script :

```powershell
& ./scripts/archive-corrections/hosted/postgres-network-pilot/plan-run.ps1 `
  -RunDirectory $NewPrivateRun -RuntimeRunDirectory $ExistingRuntimeRun `
  -NodeExecutable $BundledNode -ProtocolRepository $PaleographyHarnessCheckout
& ./scripts/archive-corrections/hosted/postgres-network-pilot/execute.ps1 -RunDirectory $NewPrivateRun
```

La clôture recalcule les hashes réels et contrôle le schéma opérationnel ainsi que le checker existant du protocole. Les URIs `checkout:` sont logiques : les hashes sont relus localement par le pilote, même lorsque le checker générique ne résout pas un autre checkout. `publication=private`, `identity_verified=false`. Les fichiers credentials et le cluster SQL restent privés et sont exclus du manifeste des preuves ordinaires.
