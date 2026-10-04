# Reprise de travail — Partner, suite du brief intégral

Créé : 2 octobre 2026. Contexte observé : non disponible ; aucun seuil de 70 % inventé.

## Mission et autorisation

Poursuivre l'implémentation **complète** du brief Partner fourni par l'utilisateur, dont le dernier message d'action est « Recommence ». Autonomie maximale et tâches successives déjà autorisées dans `roadmap/execution-policy.md` ; pas de GO supplémentaire. La tâche d'origine est `01a0fcaa-00c7-7063-8b17-d3a5318df184` (« Développer CoverView Partner »). Le brief intégral, 104 255 caractères, a été repris depuis son message utilisateur via read_thread et conservé dans `references/coverview-partner-2026-10-02.md`. Les trois parties ont même portée ; ne pas réduire la mission au socle actuel.

## État du dépôt

Source : `D:/Projects/coverview-astra`, branche main, HEAD `4fef49a095739260b9ab9d1becc1a2bf3320a928`. Checkout déjà très modifié avant cette tâche (migrations 0018–0026, profils/demandes/documents, santé, marketing, assets...). Aucun commit, stash, reset, déploiement ou suppression. Les ajouts Partner dépendent de ce WIP antérieur : ne pas croire que HEAD contient l'application courante.

La reprise utilise le worktree neuf créé par l'application, plus un **instantané local avec manifeste SHA-256** des fichiers Git modifiés et non suivis (fichiers ignorés, .env, node_modules et builds exclus) : `D:/Projects/coverview-astra/.planning-local/partner-relay-20261002/`. Lire `manifest.json`, puis utiliser `node D:/Projects/coverview-astra/.planning-local/partner-relay-20261002/restore.mjs CHEMIN_ABSOLU_DU_WORKTREE` seulement sur le worktree neuf propre au HEAD attendu. Le script refuse le checkout source, les chemins sortants, les liens et un état Git différent ; vérifier sa sortie et les empreintes. La copie conserve les travaux antérieurs mais ne les attribue pas à cette tâche et ne les autorise pas à être committés indistinctement. Ne jamais exécuter de reset pour forcer la restauration.

## Sources à lire

AGENTS/CLAUDE, PROJECT, docs/codex ; `roadmap/plans/partner-core.plan.md` et son journal ; `roadmap/evidence/partner-core.md` ; `roadmap/partner-coverage.md` pour choisir la prochaine partie, puis les sections pertinentes du brief intégral. README canonique `apps/api/src/modules/partner-workspace/README.md`, ADR-0010 et README frontend Partner/Offres. Charger les satellites strictement concernés ; ne pas relire tout le dépôt ni reconstruire le brief de mémoire.

## Décisions acquises

Client canonique identity/profiles distinct du Lead ; plusieurs Leads même client/catégorie. Pas d'accès par email, organisation seule ou commission. WorkOS et Admin/MFA existants, aucune permission fabriquée. Originals privés réutilisés, offre structurée/versionnée distincte du PDF et de la police. Le client choisit une version ; aucun contrat/signature/acceptation assureur simulé. Règles et conséquences dans ADR-0010/README. Toute estimation sans accord reste non estimable. Avis Google : respecter le parcours explicitement demandé (5 étoiles seulement), sans le présenter comme validation juridique.

## Livraison et preuves

Socle **partiel** codé dans `apps/partners`, `apps/api/src/modules/partner-workspace`, contrats/client HTTP Partner, intégrations Wallet/Admin/documents/auth. Migrations 0027/0028 générées/appliquées localement sans reset. V0 types quatre apps/lint/Knip ; V1 builds quatre apps ; frontières 194 modules/750 dépendances. V2 : 23 tests ciblés réussis, puis trois tests PostgreSQL Partner rejoués après handoffWork et réussis. Derniers types/build/lint Client après correction de récupération des profils passent aussi.

V3 : WorkOS réel vers Partner ; compte connecté non habilité => candidature seule ; Wallet Offres vide et formulaire/profil/consentement observés sur mobile 390 px et tablette 820 px. Aucune fausse donnée client/offre ni permission ajoutée dans le runtime réel. Import réel → publication → décision reste non vérifié faute de session habilitée. Les tests isolés ne remplacent pas cette recette. Les dépendances antérieures et S-042a ne sont pas artificiellement closes. S-110 conserve son statut specified avec note de cette extension ; trois notes préexistantes du backlog ont été préservées dans state avant régénération ; contrôle roadmap final passe.

## Prochaine action bornée

1. Restaurer et vérifier l'instantané dans le worktree ; installer les dépendances communes si nécessaire et vérifier les entrées, sans modifier la source. Reprendre le plan existant, pas recréer Partner.
2. Terminer le parcours de continuité (brief I.10–11/19, II.8/16) : notifications durables actionnables, attente/réexamen, escalade 24 h bornée, file CoverView, co-conseil et transfert autorisé explicites, retrait des accès cohérent. Lire events/jobs/realtime avant d'intégrer ; réutiliser les services existants. Ne pas confondre journal, notification envoyée et tâche résolue ; ne pas envoyer de messages réels à des tiers pour tester.
3. Raccorder les demandes `insurance-requests` existantes aux Leads et poursuivre les offres (contrat actuel exact, écarts, validations), puis les autres tracks du registre de couverture. Une session existante réellement habilitée est nécessaire à la recette opérationnelle ; ne pas créer de grant technique pour débloquer un screenshot. La désignation administrative ancienne est au ledger S-000b-admin-grant ; elle ne s'applique pas automatiquement au compte actuellement connecté.
4. Après chaque résultat cohérent, mettre à jour preuves/couverture/état et créer le relais autorisé lorsque nécessaire. Ne jamais déclarer le brief terminé après une tranche, ne pas ouvrir plusieurs propriétaires en parallèle.

## Obstacles et tentatives

Node du PATH 24.13.1 vs engine >=24.20 : commandes passées mais cible à confirmer. Pnpm shim cassé : le module installé est `C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs` ; noms de workspace sans préfixe (`api/client/admin/partners`). Installation en ligne --ignore-scripts a fonctionné. `drizzle-kit generate` doit tourner depuis apps/api, pas la racine. Les secrets de la preview restent hors snapshot : charger la configuration locale autorisée via previewEnvironment/WORKOS_ENV_FILE, jamais l'imprimer ou la commiter.

Ne pas répéter les erreurs corrigées : schéma Fastify avec clés de réponse surnuméraires ; DTO tâche/RDV stricts rejetant lead_id ; faux reset de l'horloge par brouillon/acceptation ; auto-attribution hors catégorie ; refus d'une source déjà retenue lors du remplacement par le nouveau conseiller. HandOffWork annule les RDV futurs des intervenants sortants et réaffecte les tâches ouvertes lors de la reprise. Le délai de réexamen automatique, sources/contrats actuels, historique client, retour aux filtres et toutes les rubriques non réalisées restent au registre.

Le générateur roadmap peut échouer sous Windows en ouverture d'un fichier existant ; utiliser son rendu/diff avec apply_patch puis contrôler, sans réécrire manuellement ses règles ni perdre les notes antérieures. Avertissements build : chunks >500 Ko et ApplicationPage importé statiquement/dynamiquement. Timeout Redis ancien vu au shutdown ; pas de correctif hors périmètre.

## Coordination

Propriétaire unique jusqu'au relais : tâche d'origine, aucun sous-agent. L'instantané fige le WIP ; après création, l'ancienne tâche cesse les écritures applicatives et state.json. Statut d'envoi du relais conservé sous `.planning-local/partner-relay-20261002/dispatch.json` après création : ne pas lancer un doublon.

Runtime de l'ancienne source : API 4100 PID **57156**, session exec **77246** ; Vite Partner 4104 PID **49632**, session exec **96882**. Vérifier PID/commande/port avant toute reprise de processus. Wallet 4101 PID 42564 et Admin 4102 PID 51012 préexistaient et ne sont pas possédés : ne pas les arrêter/adopter pour libérer leurs ports. `scripts/preview.mjs start --require-auth` refuse justement ce chevauchement. Docker coverview-s000b sert Postgres/Redis/Minio/ClamAV ; préserver toutes les autres stacks. Les tests utilisent leurs propres Testcontainers nettoyés.

Le worktree n'emporte ni .env ni node_modules ni processus. Les modifications du worktree ne s'affichent pas automatiquement dans les Vite de l'ancienne source. Préparer une preview dont les ports/origines et les processus possédés sont cohérents, sans écraser les services existants. Pour le navigateur, utiliser CUA et lire sa documentation ; les APIs de capture Codex sont interdites hors chat vocal. Onglets créés : Partner4104 et Wallet/Offres, contrôlés avec Chrome2. Aucun accès privilégié à emprunter à d'autres onglets.
