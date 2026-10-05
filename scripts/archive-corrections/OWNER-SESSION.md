# MVP-D3 — accès propriétaire local explicite

Le mode `session.mjs` remplace le secret Bearer du MVP-D par un credential enrôlé **hors ligne** dans un magasin nommé. Le mode original `server.mjs` reste exclusivement une démonstration synthétique `owner_test`. Ne jamais l’exposer comme authentification publique.

## Enrôlement et lancement

Utiliser Node 24.19.0 du runtime fourni, avec `node:sqlite`. Aucune dépendance, compte ni service hébergé à créer. Le propriétaire/opérateur choisit sa phrase privée ; aucun nom de personne, adresse ou identité historique n’est demandé. PowerShell, depuis ce checkout :

```powershell
$ownerPhrase = Read-Host 'Phrase propriétaire locale (20 caractères minimum)' -AsSecureString
$env:ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE = [System.Net.NetworkCredential]::new('', $ownerPhrase).Password
try { node scripts/archive-corrections/owner.mjs enroll monbezon-local }
finally { Remove-Item Env:ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE -ErrorAction SilentlyContinue }
```

L’enrôlement écrit seulement `.archive-corrections-private/monbezon-local/owner-auth.json`, contenant version, génération, sel et vérificateur scrypt N=32768/r=8/p=1. La phrase n’est ni affichée ni sauvegardée. Le fichier n’entre pas dans les snapshots éditoriaux. Un credential existant n’est jamais écrasé par `enroll` ; la récupération locale exige explicitement `rotate` avec le même mécanisme de saisie. Rotation = nouvelle génération + révocation des sessions actives dès leur prochaine requête. Conserver les droits locaux Windows appropriés : ce dossier ignoré n’est pas une ACL ou un chiffrement.

Pour la fixture synthétique, enrôler séparément un magasin `demo-session`, puis lancer `node scripts/archive-corrections/session.mjs demo-session 8789`. Pour Monbezon réel privé et son magasin `monbezon-local`, utiliser [reader-session.mjs](READER-CONTRACT.md). Aucun magasin n’est automatiquement transformé d’une fixture à l’autre : le service vérifie la correspondance exacte du passage/API à chaque reprise et refuse une base incompatible.

## Session et file

- `POST /v1/auth/login`, JSON exact `{passphrase}` : vérification scrypt côté serveur, puis cookie aléatoire 256 bits `HttpOnly; SameSite=Strict; Path=/` et réponse `csrf_token`, `authenticated:true`, `identity_verified:false`.
- `GET /v1/auth/session` : état de la session et jeton CSRF seulement si authentifiée. Le cookie ne figure jamais dans le JSON. La lecture utilise Host exact et refuse toute Origin étrangère.
- `POST /v1/auth/logout` : cookie valide et `X-CSRF-Token` obligatoires ; révocation effective côté serveur et suppression du cookie.
- `GET /v1/owner/history` et `GET /v1/export` : session valide obligatoire. Aucun Bearer, champ `actor_role` ou en-tête déclaratif ne donne accès en mode D3.
- `POST /v1/decisions` : session, Origin exact et jeton CSRF obligatoires ; mêmes transactions append-only, idempotence et conflits 409 que le MVP-D.
- `GET /v1/passages/{passage_id encodé}` : passage, révision courante et anciennes révisions uniquement. La file de propositions, les motifs et les décisions restent privés. `POST /v1/proposals` reste anonyme ; déposer une proposition ne change jamais l’édition.

Les sessions restent en mémoire : maximum huit, expiration après 30 minutes d’inactivité ou huit heures absolues. Redémarrage du processus = nouvelle connexion, avec corrections durables conservées. Cinq tentatives de login par minute maximum sur ce service local ; les tentatives concurrentes sont réservées avant le calcul scrypt. Cette limite globale n’est pas une protection contre les abus suffisante pour un service public.

L’interface `/demo/` détecte le mode, montre la connexion locale et masque les anciens champs Bearer. La phrase est effacée après chaque tentative ; le cookie reste HttpOnly, le CSRF n’existe que dans la mémoire de page. Aucun stockage navigateur persistant, HTML utilisateur actif, script/style inline, CORS ni accès aux fichiers privés. Le serveur écoute seulement `127.0.0.1`, avec Host/Origin exacts. Sur HTTP loopback le cookie ne porte pas Secure : un adaptateur hébergé devra exiger HTTPS, Secure, une origine de production vérifiée et une méthode de récupération choisie par le propriétaire.

## Preuve et limite

[Preuve de tests](../../tests/archive-corrections/d3-review.md) : 31 tests complets (19 D/D2, dix session/enrôlement, deux paquet Monbezon), puis une gate ciblée lecture seule sur l’URL réelle après revue, soit 32 cas distincts passés. Login valide/invalide, spoof, CSRF, expiration, révocation, rotation, redémarrage, export, concurrence 409 et reprise exacte sont testés par HTTP/processus.

Le credential vérifie sa possession locale, **pas l’identité humaine de Val**. Les sorties gardent `identity_verified:false` et les décisions `simulation:true`. L’ouverture d’une session par un propriétaire humain, la récupération de son compte et un fournisseur d’authentification hébergée restent une gate distincte. Aucune approbation humaine n’a été inventée.

Deux essais navigateur ont été refusés par auto-review : connexion propriétaire avec phrase factice ; rejeu de dépôt. Ils n’ont pas été réessayés par une autre voie. Voir les motifs exacts et la QA anonyme/mobile dans la preuve D3.
