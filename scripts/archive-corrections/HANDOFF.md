# Handoff MVP-D local — 3 octobre 2026

## Tranche livrée

Checkout exclusif `Website-archives-corrections`, branche `codex/archive-corrections-mvp`, base `3763681cb0059350ed837489d608e106c082f343`. Écritures limitées à `scripts/archive-corrections/`, `tests/archive-corrections/` et l'ajout de la seule sortie runtime à `.gitignore`.

Service HTTP local exécutable, SQLite sans dépendance externe, fixture unique entièrement inventée, API/snapshot v1 documentés. Le secret de test côté serveur autorise les seules décisions simulées ; les propositions restent anonymes. Les révisions, propositions, décisions et requêtes réussies sont ajoutées, jamais réécrites.

Le test source ne lit que les modules de cette tranche, `schema.sql` et les données runtime qu'il produit. Aucune source historique, lecture humaine validée, photo, donnée Monbezon/E108 ou autre checkout n'a été lu ni modifié. Aucun événement n'a été envoyé au harnais. Aucun build partagé, frontend, navigation, config Vercel ou TODO n'a été modifié.

## Vérification exécutée

Node fourni **v24.19.0**, SQLite **3.53.3**. Commande depuis ce checkout :

```powershell
& 'C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/archive-corrections/mvp.test.mjs
```

Scénario HTTP intégré, onze étapes, plus refus de démarrage sans secret : **13 tests passés, 0 échec, 0 ignoré** lors de la vérification finale après correction des trois écarts de la revue indépendante. Deux clients utilisent des agents HTTP distincts, avec connexions indépendantes, vers un vrai processus serveur enfant. Les étapes vérifient :

1. Dépôt anonyme ; décisions anonymes/IA, faux secret et auto-rôle refusés ; simulation/preuves/ID réels interdits.
2. Rejeu après réordre des champs ; même clé/payload différent refusé ; deux dépôts simultanés avec une clé produisent un seul ID.
3. DEL/NEL/contrôle C1 refusés à l'API dans texte de remplacement et motif de proposition, ainsi que motif de décision, sans modification du snapshot. TAB/LF/CR sont présents dans les motifs des propositions et décisions réussies.
4. Rejet enregistré sans changement du texte/révision ; rejeu de décision et conflit de clé.
5. Deux acceptations simultanées sur r1 donnent une création et un conflit ; ancienne révision inchangée, proposition périmée refusée, rejeu accepté malgré l'avancée vers r2.
6. Trigger de test faisant échouer l'insertion de décision **après** insertion de la nouvelle révision : snapshot avant/après identique ; clé réutilisable ; ensuite r3 créée. `UPDATE`/`DELETE` directs refusés.
7. Arrêt brutal du processus et nouveau lancement : snapshot intégral identique et rejeu des mêmes IDs, sans flush applicatif.
8. UUID invalides pour proposition et décision : 36 tirets, version non-v4 et variante incorrecte. Les six snapshots conservent leurs liens internes et un SHA recalculé valide ; chacun est refusé par le validateur et la CLI avant toute création du magasin cible.
9. Dates impossibles `2026-02-31T00:00:00.000Z` dans proposition et décision, avec résultats d'idempotence, révision liée éventuelle et SHA cohérents, refusées avant toute création cible.
10. DEL/C1 dans texte de proposition et motifs de proposition/décision, avec liens, résultats d'idempotence et SHA cohérents, refusés avant toute création cible.
11. Export hors ligne identique à l'export HTTP ; restauration puis réexport identiques octet par octet ; nouveau secret possible ; corruption du hash, incohérence même avec hash recalculé, fixture historique et écrasement refusés avant création du magasin cible.

Les sorties démonstratives sont conservées dans `.archive-corrections-private/` et ignorées par Git ; elles contiennent seulement les textes inventés et décisions simulées. Les serveurs de test sont arrêtés en fin de scénario. Le hash du snapshot prouve l'identité de cet export, sans prouver une validation humaine.

Dernière preuve conservée : magasins `test-75698ffc-8031-41d6-ab66-f6079622ff24` et `restored-75698ffc-8031-41d6-ab66-f6079622ff24`. Leurs exports sont identiques octet par octet, avec **3 révisions, 4 propositions, 3 décisions, 7 enregistrements de rejeu**. SHA-256 du contenu versionné : `708c15202c868fd8efc1437b7af0feaf904cc221988ae3e3b6bbd199caf7d071`. Le résultat est enregistré ici sans ajouter ces données runtime au dépôt. `git diff --check` passe pour le changement suivi ; les nouveaux fichiers ont aussi été contrôlés pour les espaces de fin de ligne.

## Audit des trois écarts corrigés

La revue indépendante a trouvé trois entrées hors contrat pourtant acceptées par les premières validations : ID constitué de 36 tirets, date impossible normalisée par `Date.parse`, contrôles DEL/NEL hors de l'ancienne plage C0. Les corrections partagent une validation d'ID UUID v4 exacte, imposent le round-trip UTC `Date` → `toISOString()` et étendent le refus aux contrôles C0/C1, hors TAB/LF/CR. Les régressions ci-dessus soumettent des snapshots autrement cohérents, avec hash recalculé valide ; elles vérifient la raison de rejet et l'absence du magasin cible, en plus des cas HTTP sans mutation. Les premiers 9 tests verts ne constituaient donc pas une preuve suffisante pour ces entrées ; la preuve finale inclut ces cas adversariaux.

## Ce que cette preuve débloque

Revue par le coordinateur du contrat B01 et des règles locales B02. Elle permet de préparer un futur adaptateur client à ces IDs et à ces erreurs, après acceptation de la tranche. La preuve ne constitue pas une intégration au lecteur, une validation historique ou un service public.

## Limites et prochaine porte

- Un passage synthétique, remplacement complet de son texte ; aucune zone/image, identité de visiteur, recherche, modération ou UI.
- `owner_test` est un détenteur du secret local, sans vérification du propriétaire réel. Une identité réelle côté serveur reste requise avant une décision non simulée.
- Service loopback sur une machine, SQLite sur un disque local ; pas de haute disponibilité, de test de coupure physique ni de déploiement cloud. L'emplacement Windows d'essai indique `Fixed` / `NTFS`.
- Export source borné à 2 MiB ; pas de migration générique depuis une autre version/fixture et pas de mécanisme de publication vers le corpus ou la mémoire.
- Dossier hors publication et ignoré, avec les droits Windows hérités. Le secret n'est pas stocké, les fichiers ne sont pas chiffrés.
- API native `node:sqlite` au stade release candidate en Node 24.19.0 ; aucune extension SQLite chargée.

La porte hébergée reste ouverte : authentification réelle, stockage/sauvegarde hébergés et répétition des cas de permissions, concurrence, idempotence, restauration et reprise dans l'environnement raccordé. PostgreSQL et route publique sont futurs. Aucun original ne doit être raccordé automatiquement à ce service synthétique ni aucune décision locale présentée comme humaine. Le lecteur réel Monbezon/E108 et la mémoire sont des voies distinctes jusqu'à revue du raccord et de l'authentification.

Aucune installation globale, publication, push, PR ou fusion. Le coordinateur conserve la responsabilité du suivi TODO et de l'acceptation du MVP ; la présence de ce handoff n'en coche pas l'acceptation.
# Suite MVP-D3 — 3 octobre 2026

Le backend/UI original reste reproductible. Voir [OWNER-SESSION.md](OWNER-SESSION.md), [READER-CONTRACT.md](READER-CONTRACT.md) et [la preuve D3](../../tests/archive-corrections/d3-review.md) pour l’extension locale : 31 tests réussis, session propriétaire enrôlée hors ligne, file protégée, passage Monbezon réellement chargé depuis six dérivés vérifiés, reprise et restauration privées. Aucun propriétaire humain n’a été authentifié ; aucune lecture historique ou publication n’a été approuvée.
