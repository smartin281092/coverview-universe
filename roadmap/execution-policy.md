# Exécution séquentielle autorisée

## Mandat utilisateur

Le 2026-09-05, dans la tâche `01a072f8-6263-7ed0-8b49-0b384c54bf9d`, message utilisateur `01a0734f-fd18-76a0-a2e5-d0cf7ddd7c78` :

> Tu peux lancer le premier slice et enchainer les slices les uns après les autres en ouvrant une nouvelle session ainsi avec un nouveau context tout frais. Pour les questions bloquantes, pars sur la réponse par défaut la plus correct qui répond le mieux au projet.

Ce mandat autorise l'implémentation de la roadmap, à commencer par S-000a, le choix des réponses par défaut pertinentes et la création de nouvelles tâches pour poursuivre. Il remplace les anciens arrêts « attendre GO » et « ne pas lancer la suivante » pour cette séquence. Ne pas demander à nouveau l'autorisation déjà donnée. La politique est active tant que l'utilisateur ne l'interrompt pas ou ne la modifie pas ; son état machine est `execution` dans state.json.

Réaffirmation du 2026-09-06 dans la reprise callback : « Ne me demande pas d’autorisation, continue jusqu’à ce que les tâches soient terminées ». Continuer les travaux et relais déjà autorisés ; une information externe manquante ou une action personnelle indispensable n’est pas une nouvelle demande de GO.

## Décider et exécuter

**Correction explicite du 2026-09-06, tâche S-000b** : l’utilisateur rappelle l’interdiction des fixtures, smoke tests et autres tests de surface comme travail de livraison. Cette instruction prime les recommandations antérieures de socle qui ont conduit à multiplier ces artefacts. Ne plus en ajouter ni remplacer le parcours demandé par une démonstration ou une batterie de contrôles superficiels. Terminer et observer le parcours réel, avec le service externe et les données persistées concernés ; garder seulement les vérifications proportionnées aux risques concrets. Les tests simulés historiques ne prouvent aucune intégration ni fonctionnalité utilisable. Si une intervention utilisateur est indispensable, préparer complètement cette étape et expliquer le blocage précis, sans arrêt silencieux.

À l'entrée de chaque slice, relire le plan et les preuves des dépendances. Consigner `approval` avec la référence de ce mandat. Pour chaque question, réutiliser les réponses déjà acquises ; sinon choisir l'option recommandée la mieux adaptée au projet, expliquer brièvement son adéquation et enregistrer `{ref, question, answer, evidence}`. Si le défaut proposé n'est plus adapté à l'état constaté, documenter le choix plus pertinent dans le plan et sa source avant de coder. Ne pas déclarer les 120 slices prêtes d'un coup.

Une décision déléguée est une décision de produit ou d'implémentation. Elle ne fabrique pas un fait externe : client ID, accès réellement disponible, contrat signé, méthode calibrée, conformité juridique ou avis d'expert. Un défaut « faire valider avant activation » choisit cette procédure ; il ne fournit pas la validation. Préparer et vérifier tout le périmètre autorisé réalisable, conserver les preuves manquantes et traiter une indisponibilité réelle sans faux succès. Les valeurs fictives restent identifiables selon ENV-09.

Une seule slice est `running`. Réaliser ses critères et contrôles, enregistrer le ledger et les décisions durables, puis la revue de livraison. Une revue du travail déléguée à l'agent peut clore la slice lorsque les preuves suffisent ; un oracle nécessitant réellement un avis humain spécialisé reste non vérifié tant que cet avis manque. Une slice incomplète ne passe jamais `done` pour libérer artificiellement une dépendance. Si un obstacle externe empêche seul sa clôture, documenter précisément le reste et poursuivre seulement une slice indépendante dont les dépendances sont réellement done, sans travail concurrent.

Les exigences de portée restent celles de PROJECT : la bible entière, le preset et la charte, WorkOS coverview, les données fictives initiales et la protection de toutes les instances Infomaniak existantes avec leurs dépendances. Aucun réglage de modèle alternatif, élargissement de droits ou changement de ces choix n'est déduit de l'autonomie. Préparer les actions externes concrètement avant leur exécution ; les actes qui exigent une autorisation spécifique non comprise dans le mandat restent limités à leur préparation.

## Revue produit avant validation de chaque slice

Mandat réaffirmé le 2026-09-06 dans la tâche S-000b : autonomie complète pour poursuivre la roadmap, une nouvelle tâche Astra Ultra par slice, avec une revue critique de chaque page ou fonctionnalité avant validation et passage à la suivante.

Sur le parcours réel implémenté, challenger le rendu, les animations, le contenu et l’expérience : attractivité et agrément visuels, modernité, efficacité, priorité des actions, sens de lecture et cohérence avec le système de design acquis. Choisir intelligemment les pages, modals/popups, panneaux et onglets selon l’intention, au lieu d’empiler tous les contenus. Pour les formulaires longs, examiner la progression et les étapes, y compris une approche ludique lorsqu’elle facilite réellement la tâche. Ne pas imposer artificiellement ces motifs à une action simple ou sensible.

Effectuer les améliorations justifiées, puis une dernière revue du résultat avant de valider la slice. Observer aussi le clavier, le mobile, les états d’erreur/attente/succès et le mouvement réduit lorsque le parcours est concerné. Consigner les défauts trouvés, les corrections et les limites de cette seconde revue dans le ledger existant ; une déclaration de qualité esthétique ne remplace pas l’observation. Cette boucle s’ajoute aux oracles fonctionnels, sans nouvelle batterie de tests de surface ni validation humaine simulée.

## Nouvelle tâche, nouveau contexte

À chaque fin de slice, créer **une nouvelle tâche `gpt-6-astra` / `ultra`**, sans fork de l'historique. Ce passage systématique n'attend pas une mesure de 70 %. En cours de slice, CDX-03 conserve le relais préventif et sa limite de télémétrie.

1. Mettre à jour state.json, preuves, README propriétaires et checkpoint selon `templates/session-handoff.md`. Générer les vues, vérifier la roadmap, puis commiter code et état. Arrêter seulement les processus de preview appartenant à la slice lorsque leurs ports ou ressources gêneraient le relais ; ne pas arrêter de services étrangers.
2. Préserver les commits pour la prochaine tâche. Les tâches Git utilisent par défaut un worktree. Avant le relais, si le checkout enregistré est propre et sa branche observée peut avancer sans divergence, y intégrer localement le commit testé par **fast-forward seulement**. Vérifier chemin, branche, état propre et ascendance avant l'opération. Ne pas écraser, reset, nettoyer ou stasher des modifications d'autrui. Si l'intégration n'est pas immédiate, réconcilier sans perte et transmettre le SHA exact ; aucune dépendance ne peut être supposée présente. Un push n'est pas nécessaire au relais local.
3. Utiliser `list_projects` puis `create_thread` avec le projet CoverView réellement constaté, `model: gpt-6-astra`, `thinking: ultra`, environnement worktree pour Git selon le schéma de l'outil. Le prompt contient l'ID de la prochaine slice, le SHA requis, le checkpoint, les chemins du plan/prompt et ce mandat. Aucun nom de branche ni état de départ non demandé n'est inventé.
4. La nouvelle tâche vérifie `git merge-base --is-ancestor SHA_REQUIS HEAD`, la propreté et les preuves avant toute mutation. Un worktree ne transporte ni .env, ni node_modules, ni processus : rétablir seulement la configuration locale nécessaire sans secrets versionnés. Si le commit requis manque, récupérer les commits locaux de la tâche précédente sans écrasement et vérifier à nouveau l'ascendance.
5. Après création, l'ancienne tâche cesse ses écritures applicatives et sur state.json, attend le premier état de la nouvelle tâche et donne son lien. La nouvelle tâche est le propriétaire unique de la slice et doit à son tour créer la suivante. Ne jamais lancer deux relais, ni terminer avec la simple promesse de créer une tâche plus tard. En cas d'échec de création, conserver le checkpoint et l'erreur, diagnostiquer avant un nouvel essai.

Le programme ne s'arrête pas après une simple livraison intermédiaire quand la prochaine slice peut démarrer. Il se termine après acceptation et ouverture effectives de la v1, arrêt demandé par l'utilisateur ou obstacle réel empêchant toute progression autorisée.
