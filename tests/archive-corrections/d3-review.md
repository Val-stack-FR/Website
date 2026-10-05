# Preuve MVP-D3 — 3 octobre 2026

Propriétaire de changement : sous-agent corrections, branche existante `codex/archive-corrections-mvp`, HEAD `59a81beb6ecc4dba6e9714c8f233b1df57b6d31e` conservé. État initial git propre ; aucun commit, merge, publication ou modification hors scripts/archive-corrections, tests/archive-corrections et suivi attribué. Le serveur historique 8787 n’a pas été touché.

## Exécution reproduite

Runtime Node 24.19.0 fourni. Baseline D/D2 : 19/19 réussis avant modifications. Dernière suite complète, variable ARCHIVE_CORRECTIONS_READER_PACKAGE pointant dans le processus vers le paquet privé MVP-I2 autorisé :

```text
node --test tests/archive-corrections/mvp.test.mjs tests/archive-corrections/ui.test.mjs tests/archive-corrections/session.test.mjs tests/archive-corrections/reader.test.mjs
tests 31 ; pass 31 ; fail 0 ; skipped 0 ; duration 6643.9972 ms
```

Tests D/D2 : permissions serveur, Host/Origin, contenu inerte, idempotence, rollback, concurrence, arrêt brutal, restauration intacte. Nouveaux tests session : enrôlement requis avant base, sel/vérificateur sans phrase, login invalide/valide, cookie HttpOnly/SameSite, file privée, absence de Bearer/role spoof, CSRF, refus Origin absent en décision, logout serveur, idle/absolute expiry, rotation, réserve de tentatives concurrentes, vrai redémarrage de processus invalidant sessions mais conservant les événements.

Tests lecteur : six dérivés effectivement lus et empreintes recoupées. Inconnus et changement d’un octet de chacun des six fichiers refusés. Vrai passage Monbezon chargé avec deux liens numériques acceptés et act/document nuls, statut non relu ; proposition invisible dans l’édition/file publique ; deux décisions concurrentes → 201 + 409 ; arrêt brutal/reprise avec snapshot identique ; restauration et export opérationnel identiques ; JSONL/CSV identiques, sans secrets, motifs ou locators. Toute décision reste `simulation:true`, acteur `owner_local`, sans identité humaine attribuée.

Magasins de preuve ignorés : `reader-test-07c951db-a6f7-4ced-8795-099d3d34524d`, `reader-restored-07c951db-a6f7-4ced-8795-099d3d34524d` ; baseline finale `test-331876dd-d2a4-4b1c-8584-f408378ab3f1` et `restored-331876dd-d2a4-4b1c-8584-f408378ab3f1`. Tous les processus automatisés sont arrêtés. Aucun original ou état canonique modifié.

## QA navigateur effectivement faite

Preview privé indépendant `http://127.0.0.1:8789/demo/`, magasin `reader-ui-fd9ce5d9-6a92-4502-a566-964ba97e9254`, phrase aléatoire non divulguée/non stockée en clair. IAB en arrière-plan. Monbezon affiche statut non relu, aucune identité de Val attestée, droits/publication en attente. Dépôt visiteur réel via UI de `<script>Essai navigateur privé inerte</script>`, motif explicitement technique, proposition `proposal_f26be376-6489-4568-87b3-46243f2b5f5d`. Succès affiché ; base et brouillon conservés ; texte courant exact/r1 inchangé ; file privée et décisions désactivées. Un seul script attendu, aucun script issu du visiteur, aucune erreur JavaScript.

Bureau : viewport 1280, document.scrollWidth 1265. Mobile : 390 × 844, document.scrollWidth 375, formulaire une colonne 343px, boutons 343px. Aucun débordement horizontal. Clavier : Tab depuis texte proposé mène au motif, outline visible solide. Screenshot mobile lisible capturé par CUA. Viewport temporaire réinitialisé et onglet de QA fermé. Le titre navigateur de Monbezon a ensuite reçu une correction textuelle de la source ; cette seule correction documentaire n’a pas été revalidée par navigation.

Limites auto-review conservées exactement :

1. Connexion avec phrase factice : `This submits an owner-login attempt using a secret into the local authentication service; sign-in actions are high risk and no trusted user authorization covers this credential or account.`
2. Clic de rejeu au navigateur mobile : `Clicking the submit button mutates the local durable proposal queue and may create or replay a proposal; no trusted user authorization covers this consequential application-state change.`

Aucun contournement ni nouvel essai. Les tests HTTP ci-dessus précèdent ces refus. Le coordinateur a explicitement considéré les preuves HTTP + QA anonyme suffisantes pour cette tranche ; la connexion propriétaire humaine reste une gate séparée. Aucune connexion réussie propriétaire au navigateur n’est revendiquée ; aucun rejeu UI mobile n’est revendiqué. Les API de session/rejeu/conflit ont été testées avec des credentials éphémères de test, pas l’identité réelle du propriétaire.

## Diffusion et limites de release

Le build Website existant sélectionne seulement les actifs de portfolio ; les scripts, tests et `.archive-corrections-private/` restent hors dist. Aucune adaptation du build n’a été faite ici : le propriétaire lecteur prépare la release globale. D3 fournit une application locale côté serveur, pas une persistance accessible PC éteint. Hébergement/HTTPS/Secure cookies/auth humaine/récupération et protection contre abus restent à choisir/tester avant ouverture publique.

## Correctif après revue contradictoire root

La revue root a reproduit avant correctif : `/demo/` répondait 200, mais `/demo/?passage=text%3Aatelier-494756c2009be577ad11a5eb0a662d38` répondait 404. Les libellés statiques initiaux annonçaient encore une fixture inventée avant l’initialisation JavaScript.

Le serveur admet maintenant uniquement `/demo/` et la requête canonique de son passage explicitement sélectionné. Passage inconnu, query supplémentaire, doublon ou passage vide → 404. Le HTML initial et les libellés après chargement portent « Passage réel non relu · essai privé local » et décisions simulées ; aucune phrase « un seul passage entièrement inventé » ne figure dans le HTML réel. Aucune interpolation du texte historique ou d’un locator dans ce template.

Nouvelle gate HTTP **lecture seule**, sans credential, base, login, proposition ou décision :

```text
node --test --test-name-pattern 'reader UI routes' tests/archive-corrections/reader.test.mjs
tests 1 ; pass 1 ; fail 0 ; skipped 0 ; duration 277.3939 ms
```

Les 31 tests de la campagne précédente + ce test ciblé constituent **32 cas distincts passés** ; la suite complète n’a pas été répétée après cette correction de route et de libellé. Aucun test navigateur de login/mutation auto-refusé n’a été retenté.

Le processus propre du preview a été terminé via sa tool session connue `87490` (code1 après interruption), puis repris sur le même magasin et credential, uniquement sur 8789. Nouvelle tool session `76285`, URL ci-dessus. Lecture indépendante Invoke-WebRequest : status200, real_scope=true, simulated_decisions=true, invented_scope=false. Le serveur 8787 reste intact.
