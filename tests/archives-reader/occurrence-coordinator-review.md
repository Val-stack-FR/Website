# Point de contrôle H2 — 3 octobre 2026

GO local pour consulter une lacune réelle avec son contexte littéral et la même photo complète. Le coordinateur a relu le renderer et le profil H05 ; les chemins et champs internes ne franchissent pas l’adaptateur. Les détails techniques ont été placés dans le volet repliable, afin de conserver un accès simple au texte et aux images.

Le serveur privé expose `/archives/formes/` et sa seule feuille de style supplémentaire. Le lecteur possède le lien vers cette page. Neuf tests de renderer avec le dérivé réel explicitement désigné et sept tests de serveur passent ; neuf contrôles HTTP confirment pages/assets, routes privées refusées et SHA/taille de la photo inchangés. La page ne produit aucune nouvelle lecture et ne modifie pas l’occurrence source.

La [revue navigateur indépendante](occurrence-browser-review.md) a vérifié bureau 1280 × 720, mobile 390 × 844, texte littéral, une lacune surlignée, SVG sans rectangle de mot, trois usages de la même URL image, détails, navigation, ressources et absence de débordement/erreur console. Dans cette passe, les captures CUA ont montré le rendu réel, contrairement aux limites raster de passes précédentes. Un défaut du lien d’évitement a été corrigé avec `tabindex="-1"` sur la cible ; son transfert de focus et la tabulation suivante ont été revérifiés aux deux dimensions.

Le contexte déclaré est x=648, y=756, largeur=3127, hauteur=564 dans la vue native 3968 × 2976. Le mot exact reste non aligné et non lu. Le tag Orientation IFD0 présent vaut 0, invalide ; les dimensions de décodage navigateur ne suffisent pas à concilier le repère photographique. L’avertissement visible et les états non relu/non résolu sont conservés.

Le build complet a réussi après ajout de la feuille de style : 108 fichiers, avec cet asset public inerte, mais sans page archives, source corpus, données privées, journal, base SQLite ou internals de dépôt. Les avertissements de dépendances préexistants restent consignés dans le log privé. La dernière réparation de focus concerne uniquement le HTML privé, exclu du build ; sa preuve est la reprise navigateur ciblée.

Les générations privées v3 puis v4 conservent leurs preuves séparées. La préparation de diffusion, l’identité réelle du propriétaire, l’alignement exact, les références humaines, la mesure de progression et la clôture canonique sont des étapes distinctes. Aucun push, PR ou déploiement de l’atelier n’est annoncé par ce GO.
