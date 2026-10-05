# D5 — contrat d'intégration Vercel/Node, 3 octobre 2026

Le handler est une fonction Node `(request, response)` sans port d'écoute et sans filesystem d'auth. Sessions, expirations, rotation, révocations et compteurs de tentatives sont partagés dans PostgreSQL. Le module conserve uniquement un pool/cache de préparation ; la session n'est pas un objet en mémoire d'une réplique. Tout reste un pilote **entièrement fictif**, `simulation:true`, `identity_verified:false` ; aucun compte humain de Val ni corpus réel n'est chargé.

D4, migration 001, anciens magasins et services sont préservés. D5 utilise un nouveau schéma `archive_corrections_serverless` (ou préfixe `archive_corrections_d5...`) et refuse le namespace D4. Le contenu SQL 001 est relu sans modification puis une **migration 002 séparée** ajoute l'auth partagée. Les révisions, propositions, décisions, clés d'idempotence et snapshots éditoriaux gardent exactement leur structure et IDs D4.

## Contrat HTTP explicite

Origine HTTPS canonique fournie dans ARCHIVE_CORRECTIONS_PUBLIC_ORIGIN, Host exact et `X-Forwarded-Proto: https` fourni par Vercel. Toute Origin présente doit être exacte ; chaque POST exige Origin. Aucun CORS, alias `/v1`, origine approchante, query supplémentaire ou rôle client n'est accepté. JSON seulement, corps 32 KiB, mêmes limites/champs exacts D4 pour propositions/décisions. Transport `api_version:archive-corrections/serverless-v1` ; flags simulation/identity sont imposés par le serveur.

| Route | Contrat |
|---|---|
| GET `/api/archive/health` | État du pilote, auth_mode shared_postgres_session et passage_id ; aucun secret/locator |
| GET `/api/archive/passage?passage_id=synthetic-mvp-d-001` | Requête canonique exacte du seul passage fictif ; passage/current_revision/revisions, jamais file ou motifs privés |
| POST `/api/archive/corrections` | Idempotency-Key obligatoire ; JSON D4 exact `passage_id, base_revision, replacement_text, reason, evidence_refs, simulation:true` ; 201 ou rejeu 200 ; dépôt sans changement de l'édition |
| POST `/api/archive/auth/login` | JSON exact `{passphrase}` ; cookie HttpOnly et CSRF dans le JSON, aucun token de cookie dans le corps |
| GET `/api/archive/auth/session` | authenticated et CSRF seulement si session valide ; fonctionne depuis une autre instance avec le même secret de signature |
| POST `/api/archive/auth/logout` | JSON `{}`, session + Origin + X-CSRF-Token ; inscription de révocation SQL et cookie supprimé |
| POST `/api/archive/auth/revoke-all` | Même contrat ; révocation SQL de toutes les sessions du pilote, visible aux autres instances |
| GET `/api/archive/owner/corrections` ou `?status=pending` | Session requise ; propositions sans décision, décisions et révision courante. Une proposition ancienne reste conservée : le lecteur compare base_revision à current_revision.text_revision |
| POST `/api/archive/owner/decisions` | Idempotency-Key, session/Origin/CSRF ; JSON D4 exact `proposal_id, base_revision, outcome, reason, evidence_refs, simulation:true` ; contrôle de session et mutation dans **la même transaction et le même client SQL** ; conflit 409 sans fait partiel |
| GET `/api/archive/owner/export` | Session requise ; réponse `{snapshot, ...flags D5}`. `snapshot` est exactement le format D4, hash inclus ; limite 2 MiB |

Ce MVP ne définit ni catalogue complet, actes, recherche, images, carte ni traduction. Le passage réel Monbezon demeure dans D3 privé ; aucun endpoint D5 ne l'accepte. Le champ base_revision n'est pas silencieusement remplacé par expected_revision_id. Les paths `/api/owner/*` du mémo général ne sont pas ajoutés : les dix routes D5 sont toutes sous `/api/archive/*`, conformément à ce mandat. Toute extension exigera un nouveau contrat et ses sources/manifeste/preflight.

Mapping de raccord à utiliser explicitement dans le futur client :

| D4 | D5 | Écart à traiter |
|---|---|---|
| `/v1/passages/{ID}` | `/api/archive/passage?passage_id={ID encodé}` | ID fictif exact, même contenu/révisions ; version de transport D5 |
| `/v1/proposals` | `/api/archive/corrections` | Même payload et Idempotency-Key ; Origin HTTPS obligatoire |
| `/v1/decisions` | `/api/archive/owner/decisions` | Même payload/IDs ; nouveau cookie D5 et CSRF partagé SQL |
| `/v1/owner/history` | `/api/archive/owner/corrections?status=pending` | File pending ; historique complet dans le snapshot de l'export, révisions publiques dans passage |
| `/v1/export` | `/api/archive/owner/export` | Extraire `.snapshot` ; ses bytes/formats/hashes restent D4 |
| `/v1/auth/login`, `/session`, `/logout` | `/api/archive/auth/login`, `/session`, `/logout` | Nouveau cookie Secure ; logout exige maintenant JSON `{}` ; revoke-all est une nouvelle route |

Le client demande GET auth/session à chaque reprise pour retrouver le CSRF, puis utilise X-CSRF-Token sur les décisions/révocations et garde sa clé de rejeu après une réponse incertaine. Ne pas conserver phrase/token/CSRF dans un stockage navigateur persistant. La reconnaissance d'une session par B ne constitue pas une identité humaine de Val.

## Session et autorisation multi-instance

Le login réserve d'abord dans SQL une tentative globale au schéma, puis vérifie scrypt N32768/r8/p1 hors transaction longue. Une seconde transaction vérifie que la génération/verificateur n'a pas changé pendant le calcul, applique la limite de huit sessions actives et insère le hash du token aléatoire 256 bits. Token brut et CSRF ne sont jamais stockés en SQL. Le CSRF est HMAC-SHA256 du token, du schéma et d'un secret de fonction commun aux instances ; un hash de ce secret dans la session empêche une instance mal configurée d'accepter son cookie.

Cookie `__Host-archive_owner_session_d5`, Secure/HttpOnly/SameSite=Strict/Path=/, sans Domain. Expirations 30 min d'inactivité / 8 h absolues évaluées avec **l'horloge de PostgreSQL**, pas celle de la fonction. Chaque contrôle consulte génération, key_hash, révocation et dates SQL. La dernière activité est mise à jour en SQL ; une nouvelle instance reconnaît ainsi la session, et une révocation/rotation est visible immédiatement à son prochain contrôle. Les actions commencées avant une rotation sont sérialisées par le verrou SQL : celle qui acquiert le verrou en premier termine avant l'autre ; aucune autorisation séparée d'une décision par un second BEGIN.

Logout/revoke-all ajoutent des faits immuables à session_revocations. L'enrôlement/rotation hors ligne modifie la seule ligne owner_credentials et ajoute un événement owner_events sans phrase/verificateur. La génération invalide toutes les anciennes sessions, sans nettoyage destructeur du journal. Le runtime ne peut pas enrôler/rotater le credential ; ses grants donnent seulement SELECT sur owner_credentials et UPDATE(touched_ms) sur owner_sessions. Grants préparés, **non appliqués à un rôle réseau ici**.

Limites SQL partagées : cinq tentatives login/minute, 60 dépôts/minute, huit sessions actives. rate_events est append-only et indexé par fenêtre ; aucune rétention/purge du journal n'est activée. Ces limites globales permettent encore un déni de service par saturation ; protection de frontière et politique de rétention restent une gate avant public.

## Fonction Vercel et fichiers de raccord préparés

Les dix entrées natives sont dans `serverless/api/archive/`. Elles exportent la même fonction default. `prepare-overlay.mjs` a produit **un overlay privé neuf** avec les dix entrées ajustées pour la racine réelle du site, une proposition de fusion Vercel et un manifeste sans secret. Il n'a modifié aucun fichier du site :

```text
.archive-corrections-private/d5-overlay-c2f1b4b5-a254-4a17-a160-03e88ca42a64/
```

Le coordinateur peut revoir/copier les seuls fichiers `api/archive/*.mjs`, `api/archive/auth/*.mjs`, `api/archive/owner/*.mjs` de cet overlay dans son futur checkout d'intégration. Imports relatifs → `scripts/archive-corrections/hosted/serverless/function.mjs`. La proposition `vercel.merge-proposal.json` complète functions/includeFiles/maxDuration et installCommand ; **elle ne remplace pas vercel.json**, son buildCommand/outputDirectory ni les en-têtes du site. Node 24.x et Fluid compute doivent être configurés/vérifiés sur la cible réelle.

`pg` 8.23.1 + helper officiel `@vercel/functions` 3.9.11 sont figés dans le package/lock D5 indépendant. Le pool de deux connexions est créé une fois par module chaud et attaché par attachDatabasePool. Chaque transaction réserve un client unique et le libère après COMMIT/ROLLBACK ; un échec de rollback détruit ce client. Les connexions cumulées de fonctions/répliques exigent encore un pooler/base dimensionné et une limite fournisseur. Aucune connexion réseau n'a été testée ici. TLS PostgreSQL vérifié, sans option URL qui pourrait le désactiver ; secret runtime différent du secret opérateur.

Le bundle doit inclure les SQL 001/002 en fichiers **lecture seule**, nécessaires à la vérification des empreintes. Il ne comprend aucune credential filesystem, fixture privée, export, PGlite ou script opérateur comme endpoint. Les imports du handler n'utilisent ni owner-auth D4 ni son root. Le projet peut conserver son site statique dans dist ; les API sont des fonctions serveur distinctes. Le `connect-src 'self'` existant permet les fetch de même origine ; ne pas relaxer CSP, form-action, scripts/styles ni créer des fetch cross-origin pour ce raccord. Aucun client/HTML du lecteur n'est modifié.

En l'absence de credentials, le handler renvoie une erreur bornée 503 ; aucun seed, migration ou enrôlement n'est lancé par une requête. Les routes explicites évitent tout rewrite wildcard/alias implicite. **Vercel build/deploy et le routage réel de plateforme restent non exécutés** ; la preuve locale est la signature Node et les requêtes HTTP du handler, y compris le helper request.body simulé. La proposition d'includeFiles et la découverte des dix routes nécessitent encore un build de plateforme autorisé.

## Configuration / opérateur / récupération

`env.example` contient les **noms seulement**, valeurs vides. À fournir dans le secret manager/runtime : URL PostgreSQL du rôle application, origine HTTPS exacte, schéma D5 neuf, SESSION_HMAC_KEY (256 bits hex). Pas de root disque d'auth, ENGINE/PGlite ou phrase d'enrôlement dans la fonction.

Hors ligne uniquement : OPERATOR_DATABASE_URL pour le rôle opérateur, OWNER_PASSPHRASE le temps d'une commande. Les opérations suivantes ont été exécutées sur des fixtures aléatoires dans un moteur local neuf ; préparer les mêmes commandes avec la base réseau future :

```text
node scripts/archive-corrections/hosted/serverless/operator.mjs migrate
node scripts/archive-corrections/hosted/serverless/operator.mjs seed
node scripts/archive-corrections/hosted/serverless/operator.mjs enroll
node scripts/archive-corrections/hosted/serverless/operator.mjs rotate
node scripts/archive-corrections/hosted/serverless/operator.mjs export NEW-PRIVATE-ABSOLUTE-FILE
node scripts/archive-corrections/hosted/serverless/operator.mjs restore PRIVATE-ABSOLUTE-FILE
```

Saisir la phrase hors chat avec Read-Host -AsSecureString et la transmettre dans la variable temporaire, puis retirer cette variable dans finally. La phrase ne passe ni dans les arguments ni dans les exports/logs. Pour la récupération, l'opérateur disposant de sa connexion SQL privée choisit une nouvelle phrase et exécute rotate : possession de cet accès administrateur est le mécanisme de récupération, **pas une identité de Val ni une récupération email réelle testée**. Enrôlement ne remplace jamais un credential existant. Aucune route publique de rotation/enrôlement/récupération n'est exposée.

Le secret HMAC reste le même sur les instances d'un déploiement. Sa rotation requiert une procédure opérateur : arrêter les mutations, faire rotate du credential pour invalider l'ancienne génération, mettre à jour le secret dans tous environnements/recréer les fonctions, contrôler le refus des anciens cookies. Ne pas laisser des instances anciennes et nouvelles avec des secrets différents accepter le trafic. Cette opération de secret manager/déploiement n'a pas été exécutée ici.

## Backup, restauration et rollback

Le snapshot exporté reste **éditorial et privé**, format/hash D4 conservé, sans credentials, tokens, secret HMAC, sessions, rate_events ni journal auth. C'est volontaire : restaurer une édition ne restaure aucun accès actif. Sur cible D5 neuve, migrate → restore → export donne exactement les mêmes bytes/IDs/relations ; réenrôler le credential séparément. Un fichier existant, une cible non vide ou un snapshot invalide est refusé. Validation/hash avant ouverture du moteur cible ; export/import bornés à 2 MiB.

Pour une sauvegarde complète de l'auth/journal SQL, préparer un backup natif chiffré du fournisseur, restreint à l'opérateur, et son test de restauration ailleurs. Aucun backup réseau/hors-site/B2 ni restauration d'un compte réel n'est attesté ici. Les événements auth restent conservés dans le SQL source ; le snapshot éditorial n'en est pas la sauvegarde. Le rôle application ne reçoit aucun droit de suppression.

Rollback d'intégration : fermer les mutations, exporter/valider l'édition, retirer les nouvelles routes ou revenir au code précédent **avec un schéma compatible distinct restauré**, jamais en supprimant migration 002. D4 refuse un journal de migrations D5 ; restaurer le snapshot inchangé dans un magasin/schéma D4 neuf et réenrôler D4 séparément si cette reprise est choisie. Conserver la base D5 et les journaux comme preuves. Les anciens services 8787/8789 ne sont pas affectés ; un retour local D4 ne fonctionne pas PC éteint.

## Reproduction et portée

```powershell
pnpm --dir scripts/archive-corrections/hosted/serverless install --frozen-lockfile --ignore-scripts
node --test tests/archive-corrections/serverless/handler.test.mjs tests/archive-corrections/serverless/operator.test.mjs
```

12/12 tests passés dans la campagne D5, sans skip : instances A/B/C indépendantes, état partagé SQL, cookie/CSRF/origine, révocation/rotation, expirations, propositions/201+409/rejeu/rollback, export/restauration, CLI opérateur et overlay. **PGlite 0.5.8 à connexion exclusive** : trois handlers dans un processus, ports loopback dynamiques ; on ne prétend pas tester un pool réseau, la concurrence de workers PostgreSQL réels, TLS réel ou un deployment Vercel. D4 est en revue indépendante et n'a pas été retesté/muté dans D5.

Anciennes mutations navigateur refusées par auto-review (login propriétaire et rejeu mobile) non réessayées. Preuve D5 = API et SQL sur fixtures fictives ; aucune QA navigateur propriétaire, identité humaine ou approbation historique déduite.

Sources officielles consultées : [runtime Node Vercel et helpers body](https://vercel.com/docs/functions/runtimes/node-js), [pool et attachDatabasePool](https://vercel.com/kb/guide/connection-pooling-with-functions), [configuration functions/includeFiles](https://vercel.com/docs/project-configuration/vercel-json), [en-têtes Vercel](https://vercel.com/docs/headers/request-headers), [Node 24 sur Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Elles fondent cette préparation, sans attester la plateforme de ce projet.
