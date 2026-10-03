# Contrat MVP-D v1

Version : `archive-corrections/v1`. Snapshot : `archive-corrections-snapshot/v1`. Portée : **un passage synthétique** `synthetic-mvp-d-001`, preuve fictive `synthetic:evidence:line-1`.

## Transport et droits

HTTP local sur `127.0.0.1`, API JSON UTF-8, `Cache-Control: no-store`. Les routes et méthodes ci-dessous sont exactes, sans paramètres de requête. Aucun autre passage ni fichier de fixture n'est accepté. `Host` doit correspondre à `127.0.0.1:<port>` (ou `127.0.0.1` sur le port 80). `Origin` peut être absent pour un client HTTP direct ; s'il existe, il doit être **exactement** l'origine normalisée du serveur par `new URL(...).origin`, par exemple `http://127.0.0.1:8787`, ou `http://127.0.0.1` sur le port 80. `localhost`, origine étrangère, `null`, protocole différent et suffixes sont refusés.

Chaque réponse JSON de l'API, normale ou erreur, porte `api_version`, `data_kind: synthetic` et `simulation: true`. Un snapshot porte également ces champs. Chaque proposition, décision et révision porte `simulation: true`, `passage_id` et `evidence_refs`. `actor_role` est **une sortie du serveur**, jamais un champ de requête autorisé. Les objets d'entrée ont exactement les champs documentés ; les champs inconnus sont refusés.

Les décisions et l'export HTTP exigent `Authorization: Bearer <secret local de test>`. Le secret attendu vient uniquement de `ARCHIVE_CORRECTIONS_OWNER_TEST_SECRET` côté serveur. L'égalité est comparée avec `timingSafeEqual`, sans stocker ni afficher le secret. Le rôle résultant est `owner_test`. Un visiteur ou un agent IA sans ce secret peut proposer mais ne peut décider. Un client doté du secret est un propriétaire **simulé** ; l'identité humaine n'est pas vérifiée dans ce MVP.

| Route | Droit | Résultat |
|---|---|---|
| `GET /v1/health` | Anonyme | `status: ready`, `auth_mode: local_test_secret` |
| `GET /v1/passages/synthetic-mvp-d-001` | Anonyme | `passage`, `current_revision`, toutes les `revisions`, `proposals`, `decisions` |
| `POST /v1/proposals` | Anonyme | Proposition enregistrée ; rôle serveur `anonymous` |
| `POST /v1/decisions` | Propriétaire local de test | Décision enregistrée ; rôle serveur `owner_test` |
| `GET /v1/export` | Propriétaire local de test | Snapshot déterministe complet avec clés de rejeu |

Incrément W03 local : `GET /demo/` sert la démonstration HTML fictive, et seuls `GET /demo/styles.css`, `/demo/app.mjs`, `/demo/state.mjs`, `/demo/render.mjs` servent ses actifs. Aucune autre route/fichier/requête avec paramètres n'est servi. Les actifs ont une CSP `default-src 'none'`, scripts/styles/connexion `self`, images/fonts/objets interdits, base URI et frame ancestors interdits, form action `self`. Aucun `unsafe-inline`, `unsafe-eval`, CDN ou en-tête CORS ne permet un accès externe. La page n'autorise rien par elle-même : les décisions gardent exactement le contrôle Bearer serveur décrit ci-dessus. Son secret, ses brouillons et clés restent en mémoire de page ; voir [le lancement et handoff W03](ui/README.md).

## Proposition

En-têtes : `Content-Type: application/json`, `Idempotency-Key: demo-proposal-001`. L'identifiant de révision vient du GET du passage.

```json
{
  "passage_id": "synthetic-mvp-d-001",
  "base_revision": "synthetic-mvp-d-001:r1",
  "replacement_text": "La boîte contient quatre jetons imaginaires.",
  "reason": "Variante inventée pour tester le dépôt.",
  "evidence_refs": ["synthetic:evidence:line-1"],
  "simulation": true
}
```

Création : HTTP `201`, enveloppe `{..., "proposal": {...}, "replayed": false}`. La proposition conserve exactement ce texte, motif, preuve et base, avec `proposal_id: proposal_<UUID>`, `actor_role: anonymous` et `created_at` ISO UTC. Elle ne modifie pas le texte courant. Même une requête dotée du secret propriétaire dépose une proposition de rôle `anonymous`. Les UUID des propositions et décisions sont exclusivement ceux générés par `randomUUID` : minuscules, forme `8-4-4-4-12`, version `4`, variante RFC avec premier caractère du quatrième groupe dans `8`, `9`, `a`, `b`. Cette validation s'applique aussi à l'API de décision et à la restauration.

## Décision

En-têtes précédents plus le Bearer local de test. Le `proposal_id` ci-dessous est remplacé par celui renvoyé par le dépôt ; une chaîne illustrative ne désigne pas une proposition enregistrée.

```json
{
  "proposal_id": "proposal_00000000-0000-4000-8000-000000000000",
  "base_revision": "synthetic-mvp-d-001:r1",
  "outcome": "accept",
  "reason": "Acceptation simulée du texte inventé.",
  "evidence_refs": ["synthetic:evidence:line-1"],
  "simulation": true
}
```

Création : HTTP `201`, enveloppe `{..., "decision": {...}, "replayed": false}`. La décision ajoute `decision_id: decision_<UUID>`, `passage_id`, `text_revision`, `actor_role: owner_test` et `created_at`.

- `accept` crée la révision suivante `synthetic-mvp-d-001:r<N+1>`, contenant exactement `proposal.replacement_text`. Cette révision porte `revision_number`, `based_on_revision`, `decision_id`, les preuves de la décision et le même horodatage. L'ancienne version reste intacte.
- `reject` conserve la révision courante : `decision.text_revision === decision.base_revision`. Aucun texte ni révision supplémentaire n'est créé.
- Une proposition ne peut recevoir qu'une décision. Une décision ne peut changer sa base : sa `base_revision` doit correspondre à celle de la proposition **et** à la révision courante, y compris pour un rejet. Une proposition périmée exige une nouvelle proposition après relecture ; aucun rebase automatique.

Une proposition sans décision est en attente ; son caractère périmé se déduit de la différence entre sa base et `current_revision.text_revision`. Les décisions sont historiques, y compris lorsqu'une révision plus récente existe.

## Concurrence et idempotence

Les clés contiennent 8–100 lettres/chiffres ASCII ou `._:-`. Leur portée est la route de mutation (`proposal` ou `decision`), pour l'ensemble de ce service. Les clés ne sont pas des secrets ; ne pas en inclure dans celles-ci.

La charge utile est canonicalisée en triant récursivement les clés d'objets. L'ordre des champs JSON ne compte pas ; l'ordre des tableaux et les valeurs de chaînes comptent. Aucune normalisation du texte n'est appliquée.

Même clé et même payload : HTTP `200`, `replayed: true`, **même entité, mêmes IDs et horodatage**, sans insertions. Ce rejeu reste possible après avancée de révision, redémarrage et restauration. Le contrôle du propriétaire précède le rejeu de décision ; connaître une clé de décision ne donne aucun droit. Même clé et payload différent : HTTP `409 idempotency_conflict`.

Après le contrôle de rejeu, `base_revision` périmée : HTTP `409 revision_conflict`, sans mutation. Deux acceptations concurrentes sur la même base produisent exactement une acceptation et un conflit. Proposition/décision/nouvelle révision éventuelle/enregistrement de clé sont dans un seul `BEGIN IMMEDIATE` / `COMMIT`. Une erreur annule tout ; les échecs ne consomment pas la clé. La transaction utilise les contraintes SQLite et les références étrangères différées. La révision courante est calculée depuis la dernière révision ajoutée ; aucun pointeur mutable n'existe. Des triggers refusent `UPDATE` et `DELETE` de toutes les tables ; cela ne protège pas contre un administrateur ayant accès au fichier et au schéma SQLite.

## Validation et erreurs

Texte de remplacement : 1–5 000 caractères ; motif : 1–1 000 ; absence de texte blanc seul. Les contrôles C0/C1 (`U+0000–U+001F` et `U+007F–U+009F`) sont interdits, avec les seules exceptions explicites TAB `U+0009`, LF `U+000A`, CR `U+000D`. DEL `U+007F` et NEL `U+0085` sont donc refusés, à l'API et dans les snapshots. `evidence_refs` doit être un tableau sans doublon, non vide, au plus 8 entrées, appartenant exclusivement aux preuves synthétiques du passage. JSON : au plus 32 KiB ; timeout de réception : 10 secondes. `simulation` doit être le booléen `true`.

Erreurs : enveloppe `{..., "error": {"code": "...", "message": "..."}}`. Les erreurs internes ne renvoient ni SQL, ni trace, ni secret.

| HTTP | Exemples de codes |
|---|---|
| `400` | `invalid_json` |
| `403` | `owner_test_required`, `local_clients_only` |
| `404` | `route_not_found`, `proposal_not_found` |
| `409` | `revision_conflict`, `idempotency_conflict`, `proposal_decided` |
| `413` | `body_too_large` |
| `415` | `json_required` |
| `422` | `invalid_fields`, `simulation_required`, `synthetic_only`, `invalid_evidence`, `invalid_text`, `invalid_idempotency_key` |
| `500` | `internal_error` — transaction annulée |

## Snapshot

Champs exacts : `api_version`, `snapshot_version`, `data_kind`, `simulation`, `passage`, `revisions`, `proposals`, `decisions`, `requests`, `sha256`. Les révisions sont triées par numéro ; propositions et décisions par ID ; requêtes par `(scope, key)` en ordre ASCII. Une requête exportée contient `scope`, `key`, `payload`, `result` original. Chaque mutation réussie possède exactement un enregistrement ; les échecs et rejeux n'en créent pas.

`sha256` est calculé sur le JSON canonicalisé de tous les autres champs. Il n'y a pas d'horodatage d'export ; deux exports du même état sont identiques. Le secret et la configuration du serveur en sont absents. Les timestamps des entités originales sont conservés, sans leur attribuer une valeur de preuve historique. Leur forme est UTC canonique `YYYY-MM-DDTHH:mm:ss.sssZ` et leur conversion en date puis `toISOString()` doit reproduire exactement la valeur initiale ; une date impossible normalisée silencieusement est refusée. La restauration ne prend pas de fichier arbitraire ou de fixture externe ; elle lit un export local borné et le restitue dans un magasin neuf. Voir les commandes dans [README.md](README.md).
