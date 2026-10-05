# W03 local minimal — une démonstration fictive

Cet incrément ajoute une interface au backend MVP-D accepté au commit `eb096a8`. Il utilise **le même passage inventé** `synthetic-mvp-d-001` et ses preuves synthétiques. Aucune archive réelle, lecture validée ou mémoire historique n'est raccordée. Accepter et refuser sont des décisions **simulées**.

## Lancer

Depuis le checkout `Website-archives-corrections`, Node fourni v24.19.0. Choisir soi-même un secret local de test de 32–256 caractères ASCII imprimables sans espace ; la saisie suivante est masquée et sa valeur n'est pas affichée :

```powershell
$nodeRuntime = 'C:\Users\Val\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$testSecretPrompt = Read-Host 'Secret local de test à ressaisir dans la page' -AsSecureString
$env:ARCHIVE_CORRECTIONS_OWNER_TEST_SECRET = [Net.NetworkCredential]::new('', $testSecretPrompt).Password
& $nodeRuntime scripts/archive-corrections/server.mjs w03-demo 8787
```

Ouvrir **http://127.0.0.1:8787/demo/** dans le navigateur. `localhost` est volontairement refusé. Un même nom de magasin retrouve les données au redémarrage ; choisir un nom neuf pour une démonstration vierge. Le runtime reste ignoré dans `.archive-corrections-private/`. `Ctrl+C` arrête le serveur. Aucune installation ni build du site n'est nécessaire.

## Parcours de démonstration

1. Consulter la version courante et les anciennes révisions. Le texte initial et chaque décision portent clairement leur nature fictive.
2. Déposer une proposition sans secret, avec texte et motif inventés. La base affichée appartient au brouillon ; déposer ne change pas le texte courant.
3. Dans le panneau `owner_test`, ressaisir manuellement le secret choisi, sélectionner la proposition, rédiger le motif et cliquer « Accepter » ou « Refuser ». Le serveur vérifie le secret ; aucun champ de rôle client ne donne de droit. Une acceptation crée une révision, un refus conserve le texte.
4. Dans deux onglets, préparer des propositions sur la même base. Après une acceptation dans l'un, la décision sur l'ancienne base est refusée dans l'autre. Les champs, motif, base et sélection restent visibles et inchangés.
5. « Actualiser l’historique » charge uniquement les données consultables. Il ne choisit aucune décision et ne rebase aucun brouillon. Comparer les versions puis cliquer explicitement « Utiliser la version affichée comme base » pour une **nouvelle** proposition, en conservant son texte et son motif. Une ancienne proposition ne peut pas être rebased par décision.
6. Une réponse réseau incertaine conserve la clé et le payload en mémoire. Réessayer la même action sans modification confirme le même résultat sans doublon. Modifier un champ, sélectionner une autre proposition, choisir une autre base ou changer acceptation/refus crée une nouvelle clé. Corriger uniquement le secret ne change pas le payload de décision.

Le secret est vide au chargement, de type password, jamais dans URL, réponse, export, log ou stockage navigateur. « Effacer le secret » le retire de la page ; sortie et retour de page l'effacent aussi. Les brouillons et clés sont également uniquement en mémoire : **un rechargement complet ferme cette session de saisie**. La conservation décrite ci-dessus concerne les erreurs et le bouton d'actualisation de l'historique. Aucune promesse de reprise d'un brouillon après rechargement n'est faite.

## Contrôles exécutables

```powershell
& $nodeRuntime --test tests/archive-corrections/mvp.test.mjs tests/archive-corrections/ui.test.mjs
```

Les 13 cas du backend restent requis. W03 ajoute les actifs et leur CSP, les origines exactes, un vrai en-tête Host hostile, les permissions côté serveur malgré l'origine valide, la présence littérale de `<script>`/`<img>` dans du texte visiteur sans rendu HTML, les états de brouillon/rejeu et la normalisation pure du port 80 sans y écouter. Les tests arrêtent leurs serveurs et n'utilisent que ce passage synthétique.

Le rendu emploie seulement `textContent` et des nœuds DOM avec balises fixes, sans `innerHTML`, événements inline, scripts inline ou styles inline. Les couleurs sobres et bordures carrées reprennent les tokens verts du site personnel ; polices système, sans téléchargement externe. Le serveur n'offre pas de lecture générique de fichiers : les cinq chemins `/demo/` et actifs listés sont les seuls accessibles.

## Handoff et limites

Voir [HANDOFF.md](HANDOFF.md). Le coordinateur doit encore exécuter la revue et la QA navigateur sur ce seul passage avant d'accepter W03. Les tests HTTP et de rendu isolé ne démontrent pas encore le comportement visuel, clavier ou mobile d'un navigateur réel. Ce n'est ni une route publique, ni l'authentification du propriétaire réel, ni un raccord au lecteur Monbezon/E108, au corpus, à la mémoire ou au build du site. Le TODO global reste à la charge du coordinateur.
