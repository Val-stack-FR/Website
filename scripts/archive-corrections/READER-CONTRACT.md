# Raccord corrections ↔ lecteur privé Monbezon

Cette gate charge **un passage réel non relu** depuis le paquet MVP-I2 autorisé en consultation privée. Le service ne lit aucun original, image ou locator de corpus. Le contexte est fermé par six empreintes SHA-256 immuables dans `reader-binding.mjs` : export lecteur, paquet de recherche, manifeste d’entrée, preflight, allowlist et vérification finale. Un octet changé, une sélection inconnue, une correspondance invalide ou un fichier symbolique est refusé avant l’ouverture d’une base de corrections.

Le loader recoupe texte ↔ transcription ↔ objet source ↔ révision, `review_id` accepté pour l’association numérique seulement, objets/view_ids allowlistés et autorisation de consultation locale. Il préserve `act_id:null`, `document_id:null`, `reading_status:unreviewed`, `translation:null` et droits/publication en attente. L’autorisation du lien texte–images ne valide pas les mots, dates ou identités. E.108 n’est pas admis dans cette gate et aucune photo lui est attribuée.

## Lancer sans exposer les locators

Après l’enrôlement explicite d’un magasin neuf décrit dans [OWNER-SESSION.md](OWNER-SESSION.md), mettre seulement dans l’environnement du processus le chemin du **paquet dérivé** autorisé :

```powershell
$env:ARCHIVE_CORRECTIONS_READER_PACKAGE = '<dossier privé du paquet MVP-I2 autorisé>'
node scripts/archive-corrections/reader-session.mjs serve monbezon-local 8789
```

Cette variable référence les dérivés, pas le corpus. `PHD_CORPUS_ROOT` n’est ni lu ni nécessaire : aucun original n’est ouvert. Aucun chemin de corpus, storage_uri, relative_path ou secret n’entre dans la réponse HTTP. Sorties privées sous `.archive-corrections-private/`, jamais sous `dist/`.

API : `archive-corrections/reader-local-v1`, `data_kind:historical-local`, `simulation:true`. Passage = `text:atelier-494756c2009be577ad11a5eb0a662d38`. Route exacte :

```text
GET /v1/passages/text%3Aatelier-494756c2009be577ad11a5eb0a662d38
```

La réponse contient `passage`, `current_revision`, `revisions`. `passage` porte les IDs candidate/transcription/objet source, empreinte source, evidence_refs, linked_view_ids, link_review_id et `link_review_scope:digital-object-association-only`. Les ancres sont la transcription entière (literal import, 0–534 caractères source) ; aucune segmentation ligne/zone ni traduction supplémentaire n’est inventée. `text_revision` commence à `{passage_id}:r1`. `source_revision` garde l’empreinte préexistante, distincte de la révision collaborative locale.

Proposition : `POST /v1/proposals`, Idempotency-Key obligatoire et JSON exact : `passage_id`, `base_revision`, `replacement_text`, `reason`, `evidence_refs`, `simulation:true`. La base doit être la révision courante retournée par le service. Décision : `POST /v1/decisions`, session propriétaire/Origin exact/CSRF, champs exacts `proposal_id`, `base_revision`, `outcome:accept|reject`, `reason`, `evidence_refs`, `simulation:true`. Une acceptation crée une révision privée `owner_local` ; elle ne promeut ni la lecture historique ni sa publication. Une base périmée renvoie 409 sans écriture partielle. Changer la base d’une proposition exige une nouvelle proposition.

Le lecteur peut ouvrir `/demo/?passage=text%3Aatelier-494756c2009be577ad11a5eb0a662d38` sur le service local, après sa propre vérification object_id + review_id + allowlist. `/demo/` reste l’entrée du passage sélectionné par le processus. La requête est exacte : identifiant inconnu, paramètre supplémentaire ou doublon de passage → 404, sans inférence ni import. Il ne doit pas ouvrir ce lien pour un résultat arbitraire du catalogue. Le HTML initial et l’UI après chargement indiquent passage réel non relu, essai privé et décisions simulées. Aucun CORS n’est activé : la première liaison est une navigation locale, pas un fetch entre ports. Un raccord serveur même origine ultérieur exige une route de proxy explicitement allowlistée et un transport de cookie/CSRF testé.

## Persistance et portabilité

SQLite WAL/synchronous FULL : magasin local sur une machine, append-only, révisions/motifs/idempotence transactionnels. Reprise après arrêt brutal de processus et restauration dans un magasin neuf démontrées avec ce vrai texte. L’original et le paquet dérivé n’ont pas été modifiés.

Commandes hors ligne, avec la même variable de paquet, après arrêt du service :

```text
node scripts/archive-corrections/reader-session.mjs export monbezon-local
node scripts/archive-corrections/reader-session.mjs restore monbezon-local monbezon-restored
node scripts/archive-corrections/portable.mjs reader-local monbezon-local
```

Le snapshot opérationnel `export.json` est complet et privé ; validation des relations/hash avant création cible, restauration identique, aucun credential/session inclus. Enrôler séparément le credential du magasin restauré. `revisions.jsonl` et `revisions.csv` sont des projections portables privées sans file, motifs, secrets ou locators. Le CSV encode le contenu exact dans `text_json` (décoder par JSON.parse) pour conserver les retours/quotes et éviter une cellule formule. Exports existants jamais écrasés. Ces projections ne sont pas autorisées à la publication ; le texte source reste non relu/droits en attente.

Décisions de stockage relues dans `atelier-tuce/planning/corrections-stockage.md` : JSONL/CSV portables, Parquet/DuckDB snapshots reconstruisibles, B2 privé pour préservation, PostgreSQL cible transactionnelle future, PostGIS conditionnel. La tranche D3 ne crée ni base cloud, bucket, compte, facturation, upload ou migration. SQLite ne prétend pas remplacer la future concurrence hébergée ou résister à une panne matérielle du disque.
