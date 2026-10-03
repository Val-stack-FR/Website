# Acceptation du coordinateur — 3 octobre 2026

GO backend local synthétique pour MVP-D. Les trois défauts de la revue indépendante sont corrigés ; la revue initiale est conservée comme trace de leur reproduction.

Le coordinateur a lu le contrat et les corrections : UUID générés v4 et variante valides, timestamps UTC validés par round-trip exact, contrôle C0/C1 hors TAB/LF/CR. Il a relancé la suite finale : **13 tests réussis, aucun échec ni ignoré**. Onze snapshots adversariaux avec hash et relations cohérents sont refusés avant création cible ; l'API refuse les textes de contrôle sans mutation.

Les preuves de permissions serveur, rejeu, concurrence sur une base commune, rollback après insertion de révision, arrêt brutal/redémarrage et export/restauration identiques continuent à passer. La nouvelle exécution conserve ses sorties synthétiques dans les magasins ignorés test-a783b73d-e6b3-4c53-baa1-395b42abe66e et restored-a783b73d-e6b3-4c53-baa1-395b42abe66e ; tous les processus de test sont arrêtés.

Cette porte permet un adaptateur d'interface sur le même passage inventé. Elle ne valide ni authentification du propriétaire réel, ni hébergement, ni corrections du corpus, ni raccord à la mémoire. Deux clients HTTP utilisent un serveur unique ; la reprise ne simule pas une panne physique du disque. Le périmètre doit rester explicite dans l'interface suivante.
