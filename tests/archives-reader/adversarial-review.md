# Revue adversariale bornée — lecteur d’archives, sprint 1

Date : 3 octobre 2026

Périmètre relu : nouvelle route statique `/archives/`, contrat de fixture de démonstration, navigation horizontale entre actes, panneaux internes et galerie. Cette revue précède l’implémentation. Elle ne couvre ni l’import du corpus réel, ni le build partagé, ni la CSP, ni le sitemap, réservés à l’intégration.

## Risques relevés et décisions

1. **Confondre l’axe de lecture et l’axe de navigation.** Un carrousel des trois panneaux masquerait une partie de l’acte et contredirait l’ordre éditorial. Décision : un acte occupe une page horizontale ; ses panneaux transcription, traduction, images restent tous visibles dans le flux vertical.
2. **Rendre le mobile vertical entre les actes.** Une media query qui empilerait les actes casserait l’intention centrale. Décision : la piste des actes reste horizontale à toutes les largeurs ; seuls les panneaux à l’intérieur d’un acte s’empilent.
3. **Piéger le défilement et le clavier.** Convertir toute molette verticale en déplacement horizontal empêcherait de lire les panneaux longs. Décision : conserver le défilement vertical natif dans chaque acte, le toucher horizontal natif sur la piste, des liens précédent/suivant visibles et les flèches gauche/droite seulement hors champs et contrôles interactifs.
4. **Dépendre de JavaScript pour le contenu ou les liens directs.** Une fixture rendue uniquement côté client ne serait ni robuste, ni découvrable. Décision : rendre les trois actes et leurs métadonnées dans le HTML ; JavaScript améliore le focus, l’URL, les annonces et le zoom. Les ancres `#slug` restent utilisables sans JavaScript.
5. **Présenter une fixture comme un corpus.** Des noms, dates ou extraits plausibles seraient facilement pris pour des données historiques. Décision : utiliser des identifiants `demo-*`, des cotes `DEMO-*`, des titres explicitement techniques, aucune personne et aucune date ; chaque écran porte un avertissement de fixture. Les champs vides affichent leur état au lieu d’être comblés.
6. **Faire croire qu’un statut global valide tout.** Décision : afficher séparément le statut de l’acte, de la transcription et de la traduction. La fixture couvre `transcription_draft`, `translation_draft` et `untranscribed` sans jamais utiliser `validated`.
7. **Mélanger les types de vues photographiques.** Un simple compteur ou une image générique effacerait recto, verso, copie, répertoire et détail. Décision : chaque image porte un type visible, une légende, un rattachement et une certitude ; la galerie de démonstration exerce les cinq types.
8. **Simuler une correction persistante.** Un formulaire local ou `localStorage` donnerait une fausse garantie. Décision : afficher uniquement l’état « canal non raccordé » et le futur principe de proposition ; aucun enregistrement local ni faux accusé de réception.
9. **Animations incompatibles avec le mouvement réduit.** Décision : désactiver transitions et défilement fluide sous `prefers-reduced-motion`, tout en conservant l’axe horizontal et les contrôles.
10. **Créer une deuxième identité graphique.** Décision : reprendre les tokens, polices, angles droits, bordures et focus du site. Le lecteur ajoute seulement des composants de lecture et une teinte de statut.
11. **Faire fuiter des chemins ou sources privées.** Décision : la fixture ne contient que des références relatives vers de petits SVG neutres. Aucun chemin `Z:`, URL B2, note de travail ou champ du classeur privé n’entre dans le HTML ou le JSON.
12. **Surpromettre les routes finales.** Le renderer et le build partagé ne sont pas dans ce périmètre. Décision : fournir des liens directs `/archives/#<slug>` dès maintenant et documenter au coordinateur la future génération `/archives/acts/<slug>/` sans modifier les scripts réservés.

## Résultat attendu du pass

L’implémentation est acceptable pour la tranche locale si elle reste lisible sans JavaScript, garde les actes sur un axe horizontal sur mobile, ne contient aucun fait historique de remplissage, ne persiste aucune correction et peut remplacer sa fixture par un adaptateur sans modifier la structure accessible des actes.
