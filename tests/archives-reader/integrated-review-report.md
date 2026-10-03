# Revue critique intégrée — renderer et serveur privé

Date : 3 octobre 2026

## Verdict

Go pour le MVP-B local après deux correctifs bornés. Aucun corpus réel ni manifeste réel n’a été relu ou modifié pendant cette revue ; toutes les reproductions utilisent des fixtures temporaires minimales.

## Défauts reproduits et corrigés

### Évasion de la sortie par jonction

Le contrôle du renderer comparait seulement le chemin lexical au checkout et demandait à Git si ce chemin lexical était ignoré. Une jonction `.private/archives-mvp/renderer-junction-*` pointant vers un dossier temporaire extérieur était donc acceptée. La régression a d’abord échoué avec « Missing expected exception ».

Le contrôle résout désormais le premier ancêtre existant et le chemin physique de destination. Il refuse une destination physique extérieure au checkout. Il vérifie aussi que le chemin physique est ignoré par Git, ce qui interdit une jonction `.private` vers un dossier suivi du checkout. Le writer utilise le chemin physique validé pour créer et écrire les deux fichiers.

### Cohérence préflight et allowlist

Le serveur acceptait `passed: true` même avec `corpus_root_accessible: false`. Il revalidait déjà le SHA-256 des octets, mais ne comparait pas leur taille à `byte_size` et ne vérifiait pas les marqueurs de l’allowlist privée.

Le démarrage exige maintenant :

- un corpus accessible et la référence `env:PHD_CORPUS_ROOT` dans le préflight ;
- un `input_manifest_sha256` syntaxiquement valide ;
- une allowlist `project` et `not-published` ;
- `bytes_verified: true` et `source_reading_status: unreviewed` pour chaque JPEG sélectionné ;
- une taille sûre et identique aux octets relus, en plus du SHA-256 et de la signature JPEG déjà vérifiés.

## Garanties revues sans défaut supplémentaire

- Le serveur reste lié à `127.0.0.1` et n’expose que `/`, `/archives/`, `/archives/index.html`, quatre assets explicites et les SHA présents dans l’allowlist.
- Les chemins privés usuels, un objet corpus non sélectionné, un SHA absent, une query string et une traversée encodée répondent 404. Les méthodes autres que GET et HEAD répondent 405.
- Chaque source média est résolue physiquement sous `PHD_CORPUS_ROOT`; une jonction source vers l’extérieur est refusée par le contrôle `realpath`.
- Le renderer attache une image seulement si le candidat déclare la vue et si un lien `accepted` relie exactement le `source_object_id` du texte à cet endpoint. La régression de rattachement par voisinage reste verte.
- Le manifeste HTML ne porte aucun chemin source. Les interpolations sont échappées, les scripts/styles/événements inline sont refusés par test, et les chemins Windows/UNC dans le contenu rendu arrêtent la génération.

## Validation

```text
node --check scripts/archives/render-reader.mjs
node --check scripts/archives/preview-server.mjs
node --test tests/archives-reader/render-reader.test.mjs tests/archives-reader/preview-server.test.mjs
# 4 tests réussis

node --test tests/build-site.test.cjs
# 4 tests réussis (harnais F04 préservé)
```

## Limite conservée

Le serveur vérifie la forme de `input_manifest_sha256`, mais ne peut pas recalculer ce hash car le manifeste source du préflight ne fait pas partie de ses entrées. La chaîne importer lie ce préflight au manifeste source avant de produire l’allowlist, puis le serveur revalide les octets sélectionnés par SHA-256 et taille. Une liaison cryptographique directe côté serveur demanderait d’ajouter ce manifeste source ou son hash attesté au contrat d’entrée.

Le processus déjà actif sur le port 8766 a chargé l’ancienne version du serveur. Il doit être redémarré pour appliquer ces contrôles supplémentaires.
