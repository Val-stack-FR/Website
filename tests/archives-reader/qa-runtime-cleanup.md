# Nettoyage du navigateur de QA — 3 octobre 2026

La revue automatique a refusé une tentative de nettoyage fondée sur l’heure de création des processus Chrome : ce critère pouvait viser une session étrangère aux essais. Cette action n’a pas été exécutée.

Le coordinateur a ensuite identifié le processus principal Chrome headless par son argument exact de profil `Website-archives-reader/.private/qa-chrome-cdp`, vérifié le nom de l’exécutable et l’absence de type de processus enfant. Une terminaison ciblée de ce seul processus a réussi ; une seconde vérification n’a retrouvé aucun processus portant ce profil. Aucun autre profil ou processus Chrome n’a été fermé.

Le chemin physique du profil temporaire a été vérifié sous le checkout, avec refus des points de réanalyse sur ses ancêtres. Sa suppression locale a réussi. Ce nettoyage concerne uniquement le runtime de QA et n’ajoute aucune preuve visuelle aux rapports fonctionnels : les captures raster de cet hôte restent inexploitées.
