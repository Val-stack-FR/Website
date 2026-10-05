# Acceptation du coordinateur — 3 octobre 2026

GO backend local synthétique pour MVP-D. Les trois défauts de la revue indépendante sont corrigés ; la revue initiale est conservée comme trace de leur reproduction.

Le coordinateur a lu le contrat et les corrections : UUID générés v4 et variante valides, timestamps UTC validés par round-trip exact, contrôle C0/C1 hors TAB/LF/CR. Il a relancé la suite finale : **13 tests réussis, aucun échec ni ignoré**. Onze snapshots adversariaux avec hash et relations cohérents sont refusés avant création cible ; l'API refuse les textes de contrôle sans mutation.

Les preuves de permissions serveur, rejeu, concurrence sur une base commune, rollback après insertion de révision, arrêt brutal/redémarrage et export/restauration identiques continuent à passer. La nouvelle exécution conserve ses sorties synthétiques dans les magasins ignorés test-a783b73d-e6b3-4c53-baa1-395b42abe66e et restored-a783b73d-e6b3-4c53-baa1-395b42abe66e ; tous les processus de test sont arrêtés.

Cette porte permet un adaptateur d'interface sur le même passage inventé. Elle ne valide ni authentification du propriétaire réel, ni hébergement, ni corrections du corpus, ni raccord à la mémoire. Deux clients HTTP utilisent un serveur unique ; la reprise ne simule pas une panne physique du disque. Le périmètre doit rester explicite dans l'interface suivante.

## UI minimale MVP-D2

GO fonctionnel synthétique après lecture des modules de saisie/rendu/rejeu et du serveur, relance par le coordinateur des **19 tests** backend/UI, puis QA navigateur indépendante à deux onglets (ui-browser-review.md). Host et Origin exacts, permission Bearer et sortie fictive restent requis.

Le navigateur a démontré proposition, mauvais secret refusé, acceptation r1 → r2, conflit gardant la saisie/base, actualisation sans rebase, nouvelle base explicite, rejeu sans doublon et refus sans changement du texte. Les balises restent du texte inerte. Mesures bureau et 390 × 844, clavier et absence d'erreurs de page ; capture raster inexploitable sur cet hôte, limite conservée.

Le coordinateur a ensuite arrêté puis relancé le vrai service de cette démonstration avec le même magasin. Le corps HTTP d'historique est identique avant/après (SHA-256 9b6a846085167f5863ef252bb0fda75760e280765f9aa85617a15f5b0d80c21f) : deux propositions, deux décisions, r1 et r2. Les preuves before/after restent dans le magasin privé ignoré. La démo est accessible localement sur /demo/ ; aucune source historique ni identité réelle n'est raccordée.
