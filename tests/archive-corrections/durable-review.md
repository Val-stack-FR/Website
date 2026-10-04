# Preuve base durable D4 — 3 octobre 2026

Checkout exclusif `Z:/Codex/repos/Website-archives-corrections`, branche `codex/archive-corrections-mvp`. L'état initial contenait déjà les changements D3 (12 fichiers suivis modifiés et nouveaux fichiers de session/lecteur/tests). Ils ont été préservés. Cette tranche ajoute `scripts/archive-corrections/hosted/`, son test et cette preuve, et adapte runtime/owner-auth/server dans le périmètre attribué. Aucun commit, push, deployment, original, autre checkout, TODO/ETAT global ou ancienne preuve modifié.

## Reproduction et campagne finale

Node 24.19.0 fourni. Baseline locale reproduite **29/29**, zéro échec/skip, 6 166,9184 ms. Premier passage des tests lecteur sans variable = **trois skips déclarés**, jamais comptés comme preuves. Le paquet dérivé a ensuite été retrouvé dans la copie de fixture D3 conservée `binding-test-8c9384e8-71f0-41d8-ae2b-d3e9b6751b88` ; les six empreintes immuables, manifeste/preflight/allowlist/review_id ont été revalidés par le loader, sans lecture d'original ni écriture de cette copie.

Campagne finale exécutée :

```powershell
$env:ARCHIVE_CORRECTIONS_READER_PACKAGE = 'Z:\Codex\repos\Website-archives-corrections\.archive-corrections-private\binding-test-8c9384e8-71f0-41d8-ae2b-d3e9b6751b88'
node --test tests/archive-corrections/mvp.test.mjs tests/archive-corrections/ui.test.mjs tests/archive-corrections/session.test.mjs tests/archive-corrections/reader.test.mjs tests/archive-corrections/hosted.test.mjs
```

**43 tests ; 43 pass ; fail/cancelled/skipped/todo = 0 ; 19 284,3189 ms.** Les 32 cas existants D/D2/D3 passent avec les 11 nouveaux cas PostgreSQL/HTTPS préparé/CLI. Le test Monbezon reproduit liaison fermée, deux propositions, 201/409, arrêt brutal, restauration exacte et exports, en simulation privée uniquement.

Après cette campagne, durcissement ciblé de la CLI : vérifier aussi le snapshot avant d'ouvrir/créer le répertoire du moteur cible ; le retour SQLite → PostgreSQL utilise explicitement le snapshot relu dans SQLite. Suite concernée répétée **11/11, zéro échec/skip, 18 206,5954 ms**. Magasins supplémentaires conservés `hosted-5b903114-c090-48b5-93fd-a834bfb18467`, `pg-to-sqlite-4c45862d-a0ad-437f-9767-161addf291ee`, `pg-restart-cdfd7fe1-6d5c-4845-b3c3-5f13ba0071c7`, `pg-cli-a736bd69-72f3-4711-bbc5-9f71780e5596`. Les preuves/hashes de la campagne complète ci-dessous restent inchangés.

## Preuve PostgreSQL à sa portée réelle

Paquets figés `pg` 8.23.1 et `@electric-sql/pglite` 0.5.8, installés seulement dans le dossier dédié, store de dépendances ignoré dans le checkout ; aucun script d'installation exécuté. Lecture publique des versions et téléchargement autorisés par auto-review ; premier accès sandbox sans réseau a échoué, puis passage explicite à l'approbation réseau, sans création de compte.

`SELECT version()` réellement exécuté dans le magasin après reprise : **PostgreSQL 18.3 (PGlite 0.5.8), wasm32-unknown-emscripten**. SQL 001 exécuté dans une transaction, deuxième passage idempotent. Vraies tables, clés étrangères différées, version de migration/empreinte et triggers testés. UPDATE/DELETE/TRUNCATE refusés avec SQLSTATE 55000 ; référence décision absente refusée à COMMIT avec SQLSTATE 23503 ; autre fixture refusée sans altération du snapshot. Ce n'est pas une génération SQL seule.

Actions sur passage inventé via le service HTTP : propositions anonymes distinctes ; r1 inchangée avant décision ; file/export privés ; cookie Secure/HttpOnly/SameSite + préfixe __Host ; Origin/CSRF/session/role spoof refusés ; deux acceptations concurrentes dans ce moteur à connexion unique = 201/409 et une seule r2 ; rejeu conserve ID. Un trigger de test provoque une panne après insertion r2 : réponse 500 bornée, snapshot entier identique et clé retentable. Rejet après retrait du trigger garde le texte. Rotation du credential et logout invalident les anciennes sessions. Limite de dépôt 429 vérifiée sans faits partiels.

La frontière du proxy est représentée par **HTTP loopback avec en-têtes de proxy contrôlés**, pas un certificat TLS. Lecture GET de l'interface fictive, CSP externe uniquement et absence de contenu utilisateur actif vérifiées ; aucune mutation de navigateur.

Premier essai SQL a révélé que PGlite query n'accepte pas plusieurs commandes préparées : migration corrigée vers exec dans la même transaction. Premier harnais HTTP utilisait fetch qui normalisait Host : remplacé par de vraies requêtes HTTP de proxy avec Host explicite, sans affaiblir le serveur. Campagne finale ci-dessus après correctifs.

## Magasins et sauvegardes conservés

Tous sous `.archive-corrections-private/`, hors Git/dist ; phrases aléatoires non affichées/non stockées en clair, vérificateurs séparés des snapshots. Aucun processus de test restant.

| Preuve finale | Résultat |
|---|---|
| `hosted-755ab99c-3871-49f0-86a9-2f65b4ed9da3` | Migration, transactions, deux propositions concurrentes puis panne/rejet ; restauration logique dans schémas neufs `archive_corrections_restored` et `archive_corrections_from_sqlite` |
| son `postgres-export.json` | Point de sauvegarde : 2 révisions, 3 propositions, 2 décisions, 5 clés ; 6 549 octets ; snapshot SHA `18549437839d83583969c4cfa12d8fa534df10cd665cb8cfac4d981448b09524` ; fichier SHA `3871bb223fc4781bb98c1a34527220584a8a0245703b98ad280f719eb89bbb28` |
| `pg-to-sqlite-a7224473-cf31-48b6-850d-86569767d67a` | Restauration PostgreSQL → SQLite exacte, aucun credential restauré. Nouvelle restauration SQLite → PostgreSQL avec tous les mêmes IDs |
| `pg-restart-71bb7260-7178-4df5-9787-76b7ba7f5325` | Processus distinct tué brutalement après proposition/acceptation ; nouvelle connexion requise, rejeu 200 et snapshot identique ; 2 révisions/1 proposition/1 décision/2 clés ; SHA `76c414a5716dc184f3c565306c95d9b8553ca5971cdcd73195538f4595b783ef` |
| `pg-cli-fe37ec2b-5d6e-4b23-b013-a680e2316da8` | Vraies commandes CLI migrate, restore et export, trois processus distincts ; source.json/restored.json égaux octet pour octet (1 791 octets, SHA fichier `88a236aa42edb67add9983a93f78564292dc1c3be90885143649a24b133ffe98`), aucun credential importé ; export sur fichier existant refusé et intact |
| `reader-test-c8c9c932-2857-4f71-8626-ccad60bafb33` / `reader-restored-c8c9c932-2857-4f71-8626-ccad60bafb33` | Reproduction privée Monbezon D3, aucune promotion de validation historique |

Le point de sauvegarde PostgreSQL précède la dernière fixture de limite d'abus, qui ajoute une quatrième proposition à la seule base source ; le snapshot reste immuable et les cibles restaurées reproduisent son état exact. Ne pas confondre ce point de sauvegarde avec l'état final enrichi de la base source.

Lecture santé des services historiques, après campagne : **8787 → 200 et 8789 → 200**. Aucun signal ni redémarrage envoyé à leurs processus. Tous nouveaux tests ont utilisé des ports dynamiques, le service préparé a pour défaut distinct 8791.

`git diff --check` passe. Les contrats lecteur D3 et les anciennes preuves sont conservés ; aucun build/release du site requis pour les fichiers serveur hors dist. Le build global et les rewrites restent au coordinateur du site.

## Limites explicites / prochaine gate

- **Aucune base réseau/managée provisionnée ou contactée.** Aucune variable de credential PostgreSQL n'était présente au relevé des noms ; pas de Docker/psql/PostgreSQL natif disponible. L'adaptateur pg est préparé, son contrat de client transactionnel testé, ses requêtes exécutées sur PGlite. TLS PostgreSQL et concurrence réelle de plusieurs connexions/processus restent non attestés ; PGlite est à connexion exclusive.
- **Aucun HTTPS réel, compte humain de Val, récupération de compte hôte, grants runtime réseau, backup hors-site/B2 ou availability PC éteint attesté.** Ces dépendances sont décrites dans [RUNBOOK.md](../../scripts/archive-corrections/hosted/RUNBOOK.md). Une seule réplique de service pour les sessions/throttling en mémoire ; aucun fallback disque éphémère Vercel silencieux.
- **Pas de QA navigateur propriétaire supplémentaire.** Auto-review avait refusé la connexion propriétaire factice et le rejeu mobile dans D3, pour absence d'autorisation reconnue de credential/account et mutation de file durable. Ces mêmes actions n'ont pas été réessayées. La nouvelle preuve est API sur fixtures fictives + interface HTTP en lecture seule, pas une QA navigateur complète ni une approbation humaine.

Le premier incrément est exécuté/testable et sa préparation hébergée concrète ; l'ouverture publique attend fournisseur/accès/HTTPS et une gate fictive distante puis humaine autorisée. Aucun secret n'est demandé ou affiché dans cette remise.
