# Prompt — S-xxx : <résultat utilisateur>

Paramètres de lancement : modèle `gpt-6-astra`, effort `ultra` (PROG-12). Ce texte ne modifie pas le réglage de la tâche ; contrôler la surface selon docs/codex.md.

Travaille dans le dépôt CoverView. Lis AGENTS.md, le référentiel qu'il désigne et PROJECT.md. Lis les entrées actives de MEMORY.md, puis le plan `<roadmap/plans/S-xxx.plan.md>` et son journal de vérification. Cette demande ne vaut exécution que si le plan bénéficie d'une autorisation effective ; ne redemande pas une autorisation déjà consignée pour le même périmètre.

Objectif : <persona> peut <action de bout en bout> et constate <résultat observable>.

Charge uniquement ce paquet :

- Exigences <IDs>, ancrages <sections/paragraphes> dans l'inventaire et l'extraction de docs/product.
- README de modules <chemins réels> et satellites <liste issue du routage> ; exclusions <liste motivée>.
- Dépendances terminées <IDs et preuves>, décisions <ADR concernés>.

Réalise le parcours <entrée → action → persistance/résultat → retour> avec les états <vide, chargement, erreur, refus, succès>. Applique les permissions <règles connues>, les frontières <données/tenants> et les règles métier <sources>. Les décisions manquantes sont <questions bloquantes du plan>, pas des règles à inventer.

Utilise <fixtures/personas identifiées> selon ENV-09. Les intégrations <liste exacte> sont simulées ; <liste exacte> sont réelles. Le comportement UI suit FRONT-14 et la charte suit DSN-01 et docs/brand.md.

Limite le travail à <périmètre> ; <suite explicite> appartient aux slices dépendantes. Les sous-tâches indépendantes de recherche/revue peuvent être déléguées avec fichiers possédés et livrable borné ; la slice reste unique en cours.

Vérifie les critères du plan avec leurs oracles : <critère et commande/parcours pour chacun>. Ne crée pas de tests qui recopient l'implémentation. Après deux échecs sur la même cible, consigne le diagnostic et change de stratégie.

À une reprise de contexte, applique docs/codex.md, enregistre le checkpoint et reprends la prochaine action utile sans réexécuter ce qui est déjà prouvé. Budget : <une session cible / borne motivée>.

Livre un résultat classé vérifié / fait non vérifié / supposé, les preuves, le mode réel/simulé, la session effectivement utilisée, le coût si observable et le reste à faire. Mets à jour la couverture, le backlog, les documents touchés et le journal Git selon PROG-08. Ne lance pas automatiquement la slice suivante.
