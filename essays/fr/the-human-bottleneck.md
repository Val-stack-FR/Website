La première ère d'adoption de l'IA en entreprise a été consacrée à une seule question : la technologie est-elle capable d'accomplir le travail ? La réponse — provisoirement, dans des domaines restreints — est oui. La question qui définit alors l'étape suivante est différente : sommes-nous capables de *tenir le rythme* ?

Ce n'est pas *seulement* une reformulation rhétorique. C'est un déplacement structurel de l'emplacement même d'où se situe la contrainte. Quand un seul analyste peut déployer une flotte d'agents pour rechercher, synthétiser, rédiger et croiser des sources en parallèle, le facteur limitant n'est plus la capacité de traitement — la faculté humaine de diriger, relire et juger ce qui en sort le devient. Le goulot d'étranglement bouge. Nous venons tout juste de le remarqué.

## L'illusion de l'autonomie

Le récit dominant dans l'IA en entreprise est celui de l'autonomie — des systèmes qui perçoivent un objectif, planifient un chemin et s'exécutent sans intervention. L'attrait est évident : supprimer l'humain de la boucle et la boucle tourne plus vite. Mais ce serait confondre vitesse et progression.

Les agents autonomes échouent de manières relativement difficiles à détecter et coûteuses à corriger. Ils opèrent sans la connaissance *contextuelle* qui rend le jugement humain fiable — ce qui a été promis à quel interlocuteur, ce qui a été essayé le trimestre dernier, ce que le client voulait *réellement* dire par opposition à ce qu'il a dit. Quand un agent produit un livrable d'apparence robuste et bien structuré mais fondé sur une lecture erronée du brief, l'erreur se propage silencieusement. Personne ne la ressent jusqu'à ce que le client la ressente.

<div class="pull-quote"><blockquote>« Les progrès de l'IA ne devraient pas se mesurer à l'indépendance croissante des systèmes, mais à leur capacité à travailler avec les humains. L'avenir le plus prometteur pour l'IA n'est pas dans des systèmes qui prennent en charge les rôles humains, mais dans ceux qui amplifient les capacités humaines à travers un vrai partenariat. »</blockquote><cite>— Zou et al., 2025</cite></div>

L'étape suivante est celle d'un système humain-agent presque *symbiotique* et non d'une IA autonome avec un superviseur humain en bout de chaîne, bel et bien d'une IA comme collaborateur actif, intégré dans la boucle de décision. La distinction compte : un superviseur détecte les erreurs a posteriori ; un collaborateur les détecte avant qu'elles ne s'amplifient. L'autonomie peut vous donner de la *vitesse*, mais seul le partenariat vous donne un *volant*.

## La mémoire comme infrastructure

Un agent sans mémoire n'est pas un agent — c'est une fonction de recherche extrêmement coûteuse. Chaque session repart de zéro, s'appuyant sur le contexte que vous fournissez et rien de ce qui s'est accumulé les semaines précédentes. Le résultat est un système qui sait des choses mais qui n'apprend pas : aucun trace de : *comment ce client particulier pense*, aucune trace de : *ce qui a déjà été essayé*, aucun sens de *la forme évolutive* du projet.

L'utilité réelle exige une mémoire persistante sur trois registres. Premièrement, le factuel — ce qui est vrai sur ce domaine, cette organisation, ce problème. Deuxièmement, l'épisodique — ce qui s'est passé lors des interactions précédentes, ce qui a fonctionné, sur quoi le client a résisté. Troisièmement, le procédural — comment ce type de travail est correctement réalisé, les routines et les arbitrages qui se font de la même manière à chaque fois pour de bonnes raisons.

Sans cette architecture, l'agent rejoue *Un jour sans fin*. Chaque prompt est traité comme une première rencontre. L'humain finit par compenser — ré-expliquer le contexte, re-fournir le brief, ré-établir ce qui a déjà été établi — ce qui annule partiellement l'intérêt d'avoir l'agent.

## Le problème d'interface

C'est là que le goulot d'étranglement devient physique. Gérer un agent via une fenêtre de chat est faisable. En gérer cinq est laborieux. En gérer vingt est, pratiquement parlant, impossible — non pas parce que les agents ne peuvent pas gérer le travail, mais parce que l'humain ne peut pas gérer l'interface.

Un proof-of-concept appelé AgentCraft pose le problème sans détour.<span class="fn">[1]</span> Son argument n'est pas subtil : la boucle de feedback textuelle — prompt entrant, réponse sortante, recommencer — n'est pas adaptée à l'orchestration d'une *flotte*. C'est une interface un-à-un vissée sur un problème un-à-plusieurs. L'outil est délibérément rudimentaire (ressemblant trait pour trait à Warcraft III), une provocation. Ce vers quoi il pointe, c'est une alternative spatiale, empruntant la grammaire visuelle des jeux de stratégie en temps réel : l'espace de travail devient une carte, les agents des unités, le rôle de l'orchestrateur glisse de la saisie d'instructions à la direction de mouvements. On ne mènerait pas une campagne militaire par chat en direct. Le diagnostic est réel même si la prescription est inachevée.

Nous essayons de piloter une économie de commandement à travers un trou de serrure.

Le rôle que cela exige n'est pas celui de l'analyste-exécutant mais bien celui du stratège-éditeur. Le consultant qui rédigeait autrefois le rapport dirige désormais quatre agents qui rédigent en parallèle et consacre son temps à décider quels fils suivre, quelles sorties combiner, lesquelles écarter. C'est une tâche cognitive fondamentalement différente — et la plupart des organisations professionnelles, des systèmes, et mêmes des personnes n'y sont pas adaptées.

## Le piège du volume

Il existe un mode d'échec spécifique au travail des cols-blancs augmenté par l'IA, et ce n'est pas celui qu'on craint. La préoccupation habituelle porte sur la précision — l'agent va-t-il halluciner une statistique, mal lire une source, fabriquer une référence ? Ces risques sont réels. Mais ce sont des risques lisibles : la sortie est fausse, et avec une relecture raisonnable, les sorties fausses se repèrent.

Le piège plus subtil est celui du volume. Parce que les agents peuvent produire en quelques secondes ce qui prendrait des heures, la tentation est de traiter la production comme de la progression. Une synthèse de quarante pages. Une analyse à douze scénarios. Une revue de littérature à cent items. Chacune plausible, bien structurée, cohérente en interne — et collectivement écrasante. L'humain qui les a commandées n'a plus le temps de les juger. Alors il survole, approuve et passe à la suite.

C'est la dynamique du *slop* : non pas le mensonge mais la médiocrité, validée trop vite pour être détectée. L'agent n'a aucun enjeu à ce que le travail aboutisse — il est rétribué pour produire, pas pour le faire *bien*. La friction repose sur les décisions: est-ce le bon cadrage ? la bonne structure ? le bon angle ? — cette friction est le travail de l'humain. La supprimer ne revient pas à accélérer le travail ; c'est accélérer l'accumulation de travail qui n'aurait pas dû exister.

<div class="pull-quote"><blockquote>« La friction est ce qui est nécessaire physiquement pour diriger ; sans friction, pas de direction. »</blockquote><cite>— Ronacher & Poncela Cubeiro, 2024</cite></div>

## Concevoir le travail pour les agents

Si les agents sont désormais des participants actifs du travail du savoir — non pas des outils mais des collaborateurs — alors la façon dont ce travail est structuré doit changer. Non seulement pour la lisibilité humaine, mais pour la lisibilité agentique : l'agent peut-il trouver ce dont il a besoin, comprendre les limites de la tâche, naviguer dans le projet sans demandes de clarification constantes ?

La façon dont s'organise un projet compte plus qu'avant. Un périmètre ambigu, des hypothèses non documentées, des connaissances institutionnelles dans la tête d'une seule personne — étaient des inefficacités gérables quand les humains travaillaient seuls. Pour les agents, ce sont des blocages, ou pire *du bruit*, de la *confusion*. Un agent opérant dans un environnement opaque va soit se figer, soit — c'est pire — avancer avec confiance dans la mauvaise direction.

La discipline ici n'est pas technique — elle est éditoriale. Des mandats clairs, des contraintes explicites, des décisions antérieures documentées : ce sont les conditions dans lesquelles les agents peuvent travailler sans correction constante. Organisez votre travail, écriez des .readme, de sorte qu'un agent qui le découvre à froid puisse comprendre ce qui est dans le périmètre, ce qui a déjà été arrêté, et ce qui reste ouvert. Moins une question de conventions de format ; plus une question d'habitudes de pensée qui produisent un brief lisible.

## La compétence premium

L'industrie de l'IA passera les prochaines années à chercher à réduire la charge humaine dans les systèmes agentiques — de meilleures interfaces, une orchestration plus intelligente, des modèles plus capables. Ces progrès sont réels et ils comptent. Mais le déplacement structurel sous-jacent ne sera pas résolu par de meilleurs outils seuls.

Ce que la prochaine ère de l'adoption de l'IA exige, ce n'est pas plus de délégation — c'est un meilleur jugement. Non pas le jugement de décider de s'il faut utiliser l'IA, mais le jugement d'évaluer ce qu'elle produit : reconnaître quand une sortie est techniquement correcte mais argumentativement vide, quand une synthèse est exhaustive mais rate la vraie question, quand une recommandation confiante est fondée sur des hypothèses qui ne tiennent pas.

Ce jugement n'est pas automatisable. Il ne peut pas l'être. C'est le résidu de l'expérience métier, de la connaissance institutionnelle, et de cette pensée lente, riche en friction, critique, qui produit des positions qu'on défendrait réellement dans une salle. Si l'IA a résolu la production du travail du savoir, le problème de demain est exponentiellement plus difficile — décider lequel de ce travail vaut la peine d'être gardé — et il incombe entièrement à l'humain.

Ce n'est pas un goulot d'étranglement à supprimer. C'est le travail *concret* qui nous attend, et il est beaucoup *intense* sur le plan cognitif .

<div class="references">
  <div class="reference-item">
    <span class="ref-num">[1]</span>
    <div class="ref-text">Salomon, I. (2024). <em>AgentCraft: Putting the orc in orchestration</em> [Video]. YouTube. AI Engineer World's Fair. https://www.youtube.com/watch?v=kR64LOqBBCU</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[2]</span>
    <div class="ref-text">Zou, H. P., Huang, W. C., Wu, Y., Miao, C., Li, D., Liu, A., Zhou, Y., Chen, Y., Zhang, W., Li, Y., Fang, L., Jiang, R., & Yu, P. S. (2025). <em>A call for collaborative intelligence: Why human-agent systems should precede AI autonomy</em>. arXiv. https://arxiv.org/abs/2506.09420v1</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[3]</span>
    <div class="ref-text">Ronacher, A., & Poncela Cubeiro, C. (2024). <em>The friction is your judgment</em> [Video]. YouTube. AI Engineer World's Fair.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[4]</span>
    <div class="ref-text">Huang, W. C., Zhang, W., Liang, Y., Bei, Y., Chen, Y., Feng, T., Pan, X., Tan, Z., Wang, Y., Wei, T., Wu, S., Xu, R., Yang, L., Yang, R., Yang, W., Yeh, C. Y., Zhang, H., Zhang, H., Zhu, S., Zou, H. P., ... & Shu, K. (2026). <em>Rethinking memory mechanisms of foundation agents in the second half: A survey</em>. arXiv. https://arxiv.org/abs/2602.06052v3</div>
  </div>
</div>