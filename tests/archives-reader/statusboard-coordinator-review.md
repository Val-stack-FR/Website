# Revue du raccord statusboard — 3 octobre 2026

Le renderer du commit `0c648b1` a été lu par le coordinateur. La route privée `/archives/avancement/` et son unique feuille de style dédiée sont raccordées au serveur de consultation. Les pages lecteur et recherche proposent un accès à cette vue. Aucun index ou export brut n’est exposé.

## Contrôles exécutés

- Suite portable archives après raccord : 15 tests réussis, deux intégrations privées ignorées explicitement, aucun échec.
- Intégration statusboard avec les exports privés existants : cinq tests réussis ; exactement deux dossiers et cinq fiches.
- Huit contrôles HTTP : pages lecteur/recherche/statusboard et CSS accessibles ; chemins privés, exports bruts et requêtes paramétrées refusés.
- HTML réel : sept cartes, Monbezon et Jean de Bouillé présents ; absence de script, style inline et chemin local absolu.
- Build complet répété après ajout du CSS : 107 fichiers ; CSS présent, aucune page archives ni donnée corpus, SQLite, bibliothèque ou interne du dépôt inclus dans `dist`.

Les sorties de preuve sont ignorées dans `.private/archives-mvp/integrated-v2/`. Les sources d’import précédentes sont utilisées sans modification. Le serveur démarre uniquement après vérification du manifeste source lié au préflight et des bytes des deux JPEG sélectionnés.

## Conclusion et limite

Le raccord HTTP et le rendu borné sont acceptés. La QA navigateur du statusboard reste à exécuter. Les rapports de navigation précédents n’en constituent pas une preuve, et les captures raster de cet hôte ne permettent toujours pas de revendiquer une inspection visuelle. Aucun export n’est devenu publiable et aucune lecture historique n’est confirmée par ces tests.
