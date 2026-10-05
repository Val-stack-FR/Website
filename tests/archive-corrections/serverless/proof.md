# Preuve D5 serverless / sessions SQL — 3 octobre 2026

Checkout attribué `Z:/Codex/repos/Website-archives-corrections`, branche `codex/archive-corrections-mvp`, HEAD conservé `59a81beb6ecc4dba6e9714c8f233b1df57b6d31e`. Écriture D5 limitée à **nouveaux** `scripts/archive-corrections/hosted/serverless/`, `tests/archive-corrections/serverless/`, résultats privés neufs et `planning/durable-database/resultat-d5.md`. D4 en revue indépendante ; aucun fichier D4/migration001/test/proof ancien, magasin ancien, lecteur ou service ancien modifié. Aucun commit/push/account/deployment/publication/original/secret affiché.

## Exécution

Node 24.19.0 fourni. Nouveaux packages/lock D5 : pg 8.23.1 et @vercel/functions 3.9.11, installation locale isolée avec --ignore-scripts et store privé D5 ; packages D4 inchangés. PGlite 0.5.8 déjà isolé réutilisé uniquement comme moteur **local**, à connexion exclusive. SQL migrations001+002 exécuté réellement ; deuxième appel idempotent ; initialisation/lecture/mutations/restauration réelles.

```text
node --test tests/archive-corrections/serverless/handler.test.mjs tests/archive-corrections/serverless/operator.test.mjs
tests 12 ; pass 12 ; fail 0 ; cancelled 0 ; skipped 0 ; todo 0 ; duration_ms 22155.9454
```

Les premiers dix tests handler passaient avant ajout de la CLI et des gates de raccord ; la campagne de douze ci-dessus est après tous correctifs de code (namespace D5 explicite, policy positive, expirations idle/absolue distinctes).

Contrôles supplémentaires : **17 fichiers .mjs passent node --check**, dix entrées API importées avec default de type fonction, sans connexion réseau ; `git diff --check` passe. SELECT version() a relu le magasin D5 après fermeture/reprise : **PostgreSQL 18.3 (PGlite 0.5.8), wasm32-unknown-emscripten**.

## Services A/B/C réellement exercés

Deux handlers Node indépendants A/B servis par deux serveurs HTTP loopback sur ports dynamiques, puis handler froid C reconstruit depuis un autre objet store/sessions. Ils partagent **le même moteur PGlite/connexion exclusive**, pas un pool réseau. Les en-têtes Host/Origin/HTTPS de la plateforme sont représentés par le harnais HTTP, sans certificat TLS.

- A ouvre la session ; B et C la reconnaissent depuis SQL et retrouvent le même CSRF. Aucun Map de sessions dans l'application. Cookie __Host Secure/HttpOnly/SameSite/Path=/ ; token brut, CSRF et clé HMAC absents des rows session et exports éditoriaux. identity_verified:false/simulation:true imposés serveur.
- Host/Origin/transport invalides refusés ; POST sans Origin refusé ; routes/query/aliases/méthodes fermés ; Vercel request.body object, getter de JSON malformé et corps trop gros contrôlés. Anonyme/Bearer/role header ne lisent pas file/export et ne décident pas.
- Deux propositions fictives par A/B gardent r1 exacte avant acceptation. CSRF absent/faux refusé. Un trigger provoque une panne SQL après insertion de la révision ; réponse 500 bornée, snapshot entier inchangé. Après retrait du trigger de fixture : deux décisions = **201 + 409**, une r2 et rejeu 200 avec même decision_id.
- Session vérifiée **dans la transaction de décision**, client SQL unique et verrou partagé ; le contrôle n'est pas préalable à une seconde transaction. Contrat du pool contrôlé avec un client simulé BEGIN/query/COMMIT ou ROLLBACK/release et attachDatabasePool appelé une fois ; **aucune connexion pool réseau réelle**.
- Logout et revoke-all par A rendent les cookies refusés par B/C. Rotation offline via store A invalide immédiatement ancienne génération dans B ; ancienne phrase refusée, nouvelle acceptée dans B et utilisable dans A. Une clé HMAC incohérente dans un objet d'instance échoue fermement. Expiration absolue (9 h) puis idle seule (31 min < 8 h) testées contre l'horloge SQL, sans cache local.
- Réservation de tentatives entre deux objets instances : deux calculs scrypt refusés et deux 429 avec limite de fixture=2 ; une réservation de proposition par A est ensuite 429 par B avec limite de fixture=1. Paramètres production : cinq logins/minute et 60 dépôts/minute. Événements auth/révocation/rate/migrations append-only vérifiés avec refus SQLSTATE55000.

## Preuves privées conservées

Magasins nouveaux ignorés, aucun export dans dist. Phrases et secret HMAC fictifs aléatoires n'ont pas été affichés ou persistés en clair. Aucun processus de test restant.

| Magasin/fichier | Preuve |
|---|---|
| `d5-5c85facc-dba9-49d1-ae0e-099e1bbd50fb` | Handler A/B/C, migrations, sessions/révocation/rotation, 201/409/rejeu/rollback, expirations, rate partagé ; schémas supplémentaires neufs de restauration et limites |
| son `editorial-export.json` / `editorial-restored.json` | Identiques : **4 351 octets**, 2 révisions/2 propositions/1 décision/3 clés, fichier SHA `c4a6ffb8b6e8220b9d6808051b6af23fb7b48d1d9cc78bf91725c2a1d70aaeaa`, snapshot SHA `a59ea8cc728e1a56b3a180ec8a6b3cda482f97c63767c914c91602c54adc4e04` |
| `d5-operator-15bc67fd-a6d3-42df-a001-67e5816e56ca` | **Vraies commandes CLI** migrate, seed, enroll, rotate, export, restore et re-export dans des processus distincts. Session créée avant fermeture du moteur, rotation depuis le processus CLI et ancien cookie/phrase refusés après reprise. Aucun fichier/root d'auth créé |
| son `export.json` / `restored.json` | Identiques : **1 786 octets**, 1 révision/1 proposition/0 décision/1 clé, fichier SHA `97b7c6338d3afbfd0e21f1659ac7b7c8228bbaf5413ff2a4980692131dffe8ca`, snapshot SHA `56d8b4cc31c41bff2c79b446b620ee9f168bb53ec4f5cc860d71dce1d07bbc3b` |
| `d5-overlay-c2f1b4b5-a254-4a17-a160-03e88ca42a64` | Dix entrées API à imports relatifs prêts à intégrer, proposition de fusion Vercel et manifeste sans secret ; aucune copie dans un checkout lecteur/site actif |

Restauration : IDs et relations inchangés, hash/bytes identiques, cible non vide refusée ; fichier existant jamais écrasé. Snapshot invalide refusé **avant création du répertoire moteur**. Le format éditorial D4 est intact ; la réponse D5 transporte ce snapshot dans `.snapshot`. Credentials/sessions/journal auth ne sont pas dans cet export ; cible restaurée sans propriétaire, ancien accès refusé et réenrôlement distinct requis. Cette restauration éditoriale n'est pas une sauvegarde intégrale des tables auth. Backup SQL natif hors-site reste à préparer avec fournisseur.

Les magasins du premier essai/préflight et l'overlay du test précédent sont conservés ; aucune ancienne preuve n'a été écrasée.

## Conservation D4 et services historiques

Baseline de **13 fichiers D4** (tous fichiers racine hosted, migrations001/grants, test hosted et preuve D4) calculée avant D5 dans :

```text
.archive-corrections-private/d5-boundary-deba21c3-95e3-4f2b-a6ad-6a562df15857/d4-before.json
```

Contrôles after/final nouveaux : **checked13, changed[]**. Migration001 reste SHA `7d0c5cac493c4d36898b32d092ba3d552e870e8a2e2c028e84de36e4e6ecedf2`. Aucune suite D4 relancée dans ce chantier pendant la revue ; seuls moteurs D5 neufs ouverts. État git de D5 = dossiers nouveaux non suivis, HEAD/branche inchangés. Les sorties finales santé historiques : **8787→200, 8789→200** ; aucun signal/redémarrage/mutation de ces services.

## Limites précises

Pas de PostgreSQL réseau, rôle runtime réel, pooler fournisseur, TLS réel, Vercel build/deploy ou test PC éteint. Le pool/attach est une préparation contractuellement testée avec client simulé ; PGlite n'atteste ni workers PostgreSQL concurrents ni scaling réseau. Le bundle/routage Vercel/includeFiles/installCommand proposés attendent une gate de plateforme autorisée, sans modification des en-têtes/CSP/build du site.

Ni identité humaine de Val, credential réel, secret manager réel, récupération réelle du compte opérateur, backup intégral auth/hors-site/B2 ou règle de rétention activés. Le mécanisme de récupération testé utilise seulement une nouvelle phrase fictive et l'accès opérateur SQL de fixture.

Les anciennes mutations navigateur refusées par auto-review (login propriétaire non autorisé credential/account ; rejeu mobile non autorisé file durable) n'ont pas été réessayées. D5 ne revendique aucune QA navigateur propriétaire complète. Aucun compte/service payant, publication ou contournement de review.

Contrat et raccord concret : [INTEGRATION.md](../../../scripts/archive-corrections/hosted/serverless/INTEGRATION.md), routes/options/grants/overlay et rollback. Le coordinateur reste propriétaire de l'intégration et de TODO/ETAT.
