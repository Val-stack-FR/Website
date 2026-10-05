# Revue indépendante bornée du MVP-D

Date : 3 octobre 2026

Périmètre : porte fonctionnelle entièrement synthétique, sans corpus, frontend, cloud ni identité humaine.

## Verdict

**Acceptation suspendue.** Les scénarios fournis de permissions, transaction, reprise et idempotence passent, mais la validation de restauration accepte des identifiants hors contrat. Deux écarts de validation moins graves sont également reproductibles.

## Défauts reproductibles

### 1. Bloquant — la restauration accepte des identifiants qui ne sont pas des UUID

`snapshot-validation.mjs` contrôle les identifiants avec `^proposal_[0-9a-f-]{36}$` et `^decision_[0-9a-f-]{36}$`. Ce motif vérifie seulement une longueur et un alphabet ; il ne vérifie pas la structure UUID annoncée par le contrat.

Reproduction synthétique :

1. créer une proposition normale et exporter le snapshot en mémoire ;
2. remplacer son ID, ainsi que l’ID inclus dans le résultat d’idempotence, par `proposal_------------------------------------` ;
3. recalculer correctement le SHA-256 du snapshot ;
4. appeler `restoreSnapshot` vers un magasin neuf.

Résultat observé : la restauration réussit et le magasin restauré réexporte exactement `proposal_------------------------------------`. Le même défaut de motif existe pour `decision_id`.

Impact : un paquet auto-cohérent et correctement hashé, mais extérieur au contrat `proposal_<UUID>` / `decision_<UUID>`, entre dans le magasin. La correction doit valider une forme UUID stricte pour les deux familles avant toute création du magasin cible, avec régressions positives et négatives.

### 2. Moyen — un timestamp calendrier impossible est restauré

La validation exige le motif lexical ISO puis seulement `Number.isFinite(Date.parse(value))`. JavaScript normalise certaines dates impossibles au lieu de les refuser.

Reproduction : une proposition et son résultat d’idempotence ont reçu `created_at: "2026-02-31T00:00:00.000Z"`, puis le hash a été recalculé. La restauration a réussi. JavaScript interprète pourtant cette valeur comme `2026-03-03T00:00:00.000Z` tandis que le magasin conserve littéralement le 31 février.

Impact : l’export peut porter une métadonnée temporelle qui respecte le motif mais ne désigne pas l’instant écrit. Une comparaison aller-retour stricte avec `new Date(value).toISOString()` fermerait ce cas.

### 3. Faible — les contrôles DEL et C1 passent la validation de texte

Le contrat exclut les caractères de contrôle sauf tabulation et sauts de ligne. `boundedText` refuse U+0000–U+001F avec les exceptions prévues, mais pas U+007F–U+009F.

Reproduction : `validatePayload('proposal', …)` accepte un `replacement_text` contenant U+007F et un `reason` contenant U+0085.

Impact : ces caractères invisibles peuvent entrer dans les propositions, clés de comparaison sémantique et exports. Le contrat ou le filtre doivent être alignés.

## Garanties vérifiées sans défaut concret supplémentaire

### Permissions

- Le secret est contrôlé avant toute décision et avant tout rejeu de décision.
- Les propositions restent `anonymous`, même avec le secret propriétaire.
- Les rôles fournis par le client, les preuves non synthétiques, `simulation: false`, les mauvais Host/Origin et l’export anonyme sont refusés.
- Le secret n’apparaît ni dans les réponses, ni dans le snapshot, ni dans les sorties du processus testées.

### Transactions et concurrence

- L’injection d’une erreur SQLite après insertion de révision annule révision, décision et clé de rejeu ; la clé reste réutilisable.
- Deux acceptations arrivant sur la même base via le serveur produisent une création et un conflit.
- Les triggers refusent les `UPDATE` et `DELETE` directs testés.
- La connexion observée retourne `PRAGMA foreign_keys = 1` ; les références déclarées sont donc actives dans ce runtime Node.

### Reprise, export et idempotence

- Les neuf tests fournis passent sous Node 24.19.0.
- Après arrêt brutal et redémarrage, snapshot et rejeux réussis restent identiques.
- Une même clé et un même payload, même avec les champs réordonnés, rendent la même entité ; un payload différent produit le conflit attendu.
- Export HTTP, export hors ligne et réexport après restauration sont identiques dans le scénario nominal.
- Hash corrompu, relations incohérentes testées, fixture historique et cible existante sont refusés.

Commande exécutée :

```text
C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --test tests/archive-corrections/mvp.test.mjs
# 9 tests réussis, 0 échec
```

## Limites de cette revue

- Le test de concurrence fourni utilise deux clients et un serveur Node unique ; il ne démontre pas deux processus serveurs écrivant simultanément dans le même magasin.
- La reprise prouve un arrêt brutal de processus, pas une coupure physique ou une panne de disque.
- La validation hors ligne reste soumise aux droits et courses du système de fichiers local ; aucune ACL ou protection contre un administrateur local n’est revendiquée.
- Aucun original, manifeste de corpus, frontend, service cloud ou autre checkout fonctionnel n’a été lu.

Les sondes ont créé uniquement des magasins synthétiques dans `.archive-corrections-private/`, déjà hors Git. Aucun fichier backend ou test fourni n’a été modifié par cette revue.
