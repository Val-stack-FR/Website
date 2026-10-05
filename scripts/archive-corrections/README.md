# MVP-D — collaboration durable locale sur un passage inventé

La tranche suivante [MVP-D3 — session propriétaire locale](OWNER-SESSION.md) conserve cette démonstration et ses 19 tests. Elle ajoute un enrôlement hors ligne, des sessions révocables, une file privée et un [raccord privé Monbezon fermé](READER-CONTRACT.md). Le mode D3 ne constitue pas une authentification humaine ni une publication ; tous ses événements restent des simulations locales.

Le service permet à un visiteur anonyme de proposer un texte et au **propriétaire local de test** de l'accepter ou de le refuser. SQLite conserve propositions, décisions, anciennes révisions et clés d'idempotence. Le serveur écoute exclusivement `127.0.0.1`.

Tout contenu est explicitement `data_kind: synthetic` / `simulation: true`. La seule entrée initiale est une phrase inventée dans `fixture.mjs`. Aucun fichier historique, photo, lecture validée ou autre checkout n'est ouvert. Une acceptation simule une décision ; elle ne confirme aucune lecture historique et n'envoie aucun événement vers la mémoire.

## Lancer et démontrer

Prérequis : Node **24.19.0**, avec `node:sqlite` fourni. Aucune dépendance ni installation supplémentaire. Depuis la racine de ce checkout, dans PowerShell :

```powershell
$nodeRuntime = 'C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$env:ARCHIVE_CORRECTIONS_OWNER_TEST_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
& $nodeRuntime scripts/archive-corrections/server.mjs demo 8787
```

Le secret est créé dans l'environnement, sans être affiché ni enregistré. Le processus affiche seulement son URL locale, la version et le mode `local_test_secret`. `Ctrl+C` arrête le service. Un lancement avec le même nom `demo` retrouve les données. Le port `0` sélectionne un port libre, utile pour les tests.

La [mini-interface MVP-D2](ui/README.md) est accessible sous `/demo/` sur ce même service. Elle utilise le passage inventé et les contrôles serveur du MVP-D. Le parcours à deux onglets et la conservation exacte de l’historique après redémarrage ont été vérifiés ; voir [le rapport navigateur](../../tests/archive-corrections/ui-browser-review.md).

Le test automatisé réalise la démonstration complète avec **deux clients HTTP distincts** ; leurs secrets sont éphémères et générés dans le processus :

```powershell
& $nodeRuntime --test tests/archive-corrections/mvp.test.mjs
```

Le test conserve ses seules sorties synthétiques dans des magasins uniques du dossier ignoré `.archive-corrections-private/`. Il termine tous ses serveurs. Chaque magasin contient `corrections.sqlite` et éventuellement `export.json` ; les fichiers SQLite auxiliaires restent dans ce dossier. Un nom de magasin est limité à 1–64 caractères ASCII lettres, chiffres, `_` ou `-`. Aucun chemin de corpus n'est accepté en argument. Répertoires et fichiers symboliques sont refusés.

## Export et restauration

Arrêter le serveur, puis utiliser les commandes hors ligne :

```powershell
& $nodeRuntime scripts/archive-corrections/snapshot.mjs export demo
& $nodeRuntime scripts/archive-corrections/snapshot.mjs restore demo demo-restored
& $nodeRuntime scripts/archive-corrections/server.mjs demo-restored 8787
```

L'export est écrit dans `.archive-corrections-private/demo/export.json`. Un export existant n'est jamais écrasé ; utiliser un autre magasin ou sauvegarder/déplacer cet export localement avant un nouvel export. La restauration exige un **nom neuf** et lit seulement l'`export.json` du magasin source. Elle vérifie la version, la fixture exacte, la simulation, l'empreinte SHA-256, les révisions contiguës, les liens proposition/décision/révision et les enregistrements d'idempotence avant création du magasin cible. Les insertions sont atomiques et le résultat est comparé intégralement à la source. Un export source supérieur à 2 MiB est hors du périmètre de ce MVP.

L'accès hors ligne relève des droits sur les fichiers locaux ; il n'utilise pas le secret HTTP. Le secret n'est jamais inclus dans l'export et peut changer entre source et restauration. L'empreinte constate l'intégrité du paquet, sans attester l'identité humaine de son auteur.

## Contrat et limites

Voir [CONTRACT.md](CONTRACT.md) pour l'API versionnée et [HANDOFF.md](HANDOFF.md) pour la preuve et les limites de passage. Le runtime SQLite utilisé est documenté par la [documentation officielle Node 24.19.0](https://nodejs.org/download/release/v24.19.0/docs/api/sqlite.html) ; son API est encore au stade « release candidate ».

L'authentification est un secret Bearer **local de test**, vérifié côté serveur. Posséder ce secret suffit pour tenir le rôle simulé `owner_test`. Ce mécanisme ne représente ni une session du propriétaire réel, ni une authentification hébergée. Un champ `actor_role` ou un en-tête annonçant « owner »/« ai » ne donne aucun droit.

Le runtime doit rester sur un système de fichiers local, utilisé depuis une seule machine. L'emplacement d'essai `Z:` est déclaré `Fixed` / `NTFS` par Windows. Les vérifications démontrent la persistance après arrêt de processus, pas une résistance à une panne physique du disque. Les droits locaux hérités restent ceux de Windows ; `.gitignore` protège contre l'ajout accidentel au dépôt et ne constitue pas un chiffrement ou une ACL.

Les routes exigent le `Host` loopback annoncé. Un `Origin` absent ou exactement égal à l’origine normalisée du service est accepté ; les autres origines sont refusées. Seuls `/demo/` et ses quatre actifs explicitement sélectionnés servent l’interface fictive ; aucun en-tête CORS ne permet l’accès externe. Aucun raccord public, corpus, JWT ou hébergement n’est actif. L’authentification réelle, PostgreSQL, protection des abus à l’échelle publique et tests équivalents en hébergement restent à réaliser avant l’ouverture publique des corrections.
