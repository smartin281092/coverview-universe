# Reprise de travail — Partner, continuité puis demandes existantes

Créé : 2 octobre 2026. Contexte observé : non disponible, aucun seuil inventé.

## Mission et autorisation

Poursuivre le brief Partner **intégral** du 2 octobre, dernier ordre utilisateur « Recommence ». Autonomie maximale, tâches successives Astra/ultra et défauts pertinents autorisés par roadmap/execution-policy.md. Une seule tâche propriétaire, sans sous-agent ni écriture applicative concurrente. Le socle reste partiel ; ne pas reconstruire l'application ni clore tout le brief après une tranche.

Tâche d'origine 01a0fcaa-00c7-7063-8b17-d3a5318df184, relais actuel 01a0fd34-ef16-7180-a535-ead6b08d46a0. Texte utilisateur intégral conservé sous references/coverview-partner-2026-10-02.md ; registre par exigence roadmap/partner-coverage.md.

## État du dépôt

Propriétaire actuel : C:/Users/sebm1/.codex/worktrees/52d5/coverview-astra, HEAD détaché **4fef49a095739260b9ab9d1becc1a2bf3320a928**. Aucun commit global, stash, reset, push ni déploiement. Les 433 fichiers WIP hérités ont été restaurés par manifeste SHA-256 puis préservés. L'application requiert ce WIP, pas seulement HEAD.

Nouvel instantané immuable de tous les changements nécessaires : C:/Users/sebm1/.codex/worktrees/52d5/coverview-astra/.planning-local/partner-relay-continuity-20261002/. L'empreinte exacte du manifest.json est donnée dans le prompt de lancement. Vérifier cette empreinte, lire restore.mjs et vérifier HEAD/propreté avant exécution sur le worktree neuf. Si le worktree neuf est propre mais au mauvais HEAD, un switch détaché vers le SHA demandé est autorisé, sans reset. Le script refuse la source et tout worktree modifié, vérifie tous les fichiers puis les empreintes copiées. Pas de secrets, .env, node_modules, builds ou dépôt bmpartners dans l'instantané. Ne pas commiter indistinctement le WIP hérité.

Le checkout D:/Projects/coverview-astra reste **lecture seule** pour cette séquence. Sa branche réelle est codex/health-map-polish ; l'ancien checkpoint disait main par erreur. Aucun de ses fichiers applicatifs/state.json n'a été modifié par ce relais. Il fournit uniquement la configuration locale autorisée à lire en mémoire.

## Sources à lire

AGENTS.md, CLAUDE.md, PROJECT.md, docs/codex.md ; roadmap/plans/partner-core.plan.md **et son journal**, roadmap/evidence/partner-core.md, roadmap/partner-coverage.md ; README propriétaire apps/api/src/modules/partner-workspace/README.md, ADR-0010, README Partner et Wallet Offres. Charger I.10–11/19, II.8/16 du brief pour la continuité, puis I.6/II.2 et README insurance-requests pour le raccordement des demandes. Lire uniquement les satellites concernés via CLAUDE.

## Décisions acquises

Client canonique identity/profiles ≠ Lead ; plusieurs Leads même catégorie légitimes. Aucun accès par email/organisation/commission. Conseiller validé et affecté, Admin/MFA existants, propriétaire Wallet actuel. Pas de grant réel de test. Sources originales privées conservées, offre structurée/versionnée ≠ PDF ≠ contrat. Choix client ≠ signature/acceptation assureur. Rémunération reste non estimable sans accord.

Nouveau : notifications **internes de service** atomiques avec les mutations ; leur persistance est la livraison dans l'application, pas un email/SMS. Lire ≠ résoudre. L'horloge démarre à cette livraison ; ouverture/acceptation/note ne la réinitialisent pas. Rappel 4 h avant les 24 h calendaires, alerte à échéance, reprise humaine CoverView 4 h après dépassement non justifié. Attente documentée : réexamen daté puis 4 h pour agir. Suivi après contact soumis à la prochaine action. Dates affichées et worker utilisent partner.follow-up.ts.

Zéro réattribution automatique à un **autre conseiller** tant que l'ensemble éligibilité/accord/disponibilité/matching n'est pas raccordé : reprise humaine une fois, aucune boucle ni interlocuteur inventé. Défauts délégués et limites dans README. Habilitation expirée/retrait => reprise et handoffWork pour tâches/RDV. Événements système avec acteur explicite partner-continuity-v1, aucun utilisateur artificiel. L'API projette un identifiant système public et systemActor ; ne pas revenir à l'ancien lecteur qui suppose un actor_id humain non nul après écriture de ces événements.

## Livraison et preuves

Notifications Partner/Wallet paginées et filtrées, lectures personnelles, accès Admin via supervision Partner, publication/décision client/RDV/transfert, file humaine de reprise. Worker BullMQ partagé toutes les 60 s, jusqu'à 10 lots de 50, SKIP LOCKED, timeouts SQL, retries bornés/échecs conservés. Pas de room ni nouveau transport immédiat ; polling 15 s.

**Vérifié V0/V1** : types et builds API/Partner/Wallet/Admin, ESLint ciblé, Knip quatre apps ; frontières 495 modules/2 040 dépendances, zéro erreur et 3 avertissements www préexistants. Migration 0029 puis 0030 générées et appliquées localement sans reset. 0030 ferme le cas SQL CHECK/NULL d'auteur d'audit absent. Scheduler réel Redis démarré ; passage réussi sur zéro Lead local (ce n'est pas un parcours utilisateur de traitement).

**Vérifié V2** : campagne Partner/identity.routes/server 31 tests ; après dernières modifications, six tests PostgreSQL Partner passent (10,12 s), types/lint API repassent. Migration exécutée deux fois en Testcontainers. Scénarios : invariants antérieurs + livraison atomique, lu non résolu, droits au rejeu après transfert, rappel, attente/réexamen, concurrence, escalade unique, suivi après tentative, habilitation expirée et acteur obligatoire. Tests ajoutés par le même agent, pas une revue indépendante. Pas de tests de surface ni données dans le runtime réel.

**V3 limité** : Wallet du worktree 4111 /offers/notifications, session réelle, état vide et filtres, screenshot 390 px sans débordement ; Partner 4104 /notifications reste sur la candidature non habilitée. Aucun grant, candidature, Lead/offre fictif ni message externe. La recette avec un conseiller réellement autorisé reste à faire. Aucun « done » global ni clôture artificielle de S-110/S-042a. Roadmap régénérée et check --require-complete passé.

## Prochaine action bornée

1. Restaurer l'instantané dans le worktree neuf, vérifier les empreintes, installer via pnpm en conservant le lockfile ; reprendre le plan existant.
2. Compléter la continuité qui reste ouverte : paramétrage Admin explicite du délai d'acceptation/calendrier et collaboration/co-conseil/transfert autorisé. Réutiliser les notifications et l'audit ; ne pas activer un faux matching ou un accord économique inexistant. Ajouter seulement les contrôles d'intégrité nécessaires et rendre le parcours utilisable.
3. Raccorder les demandes insurance-requests existantes aux Leads, sans double client ni rupture des profils/consentements/suivi invité. Poursuivre ensuite les tracks du registre, notamment contrat actuel exact, offres et comparaison sourcée, distribution/économie/qualité. Les intégrations externes attendent leurs preuves réelles.
4. Au prochain résultat cohérent, actualiser preuves/couverture/état, préparer le relais et créer une seule nouvelle tâche autorisée. Ne pas s'arrêter à une promesse de continuation ; conserver tout le périmètre.

## Obstacles et tentatives

Session opérationnelle habilitée manquante : ne pas créer de permission pour un screenshot. UI remplie et flux attribution→notification→contact→résolution non vérifiés en navigateur. Préférences de canaux, autres notifications (tâches/pièces/qualité/rémunérations), supervision avancée/rétention et envoi externe restent incomplets.

Node 24.13.1 dans PATH face à engine >=24.20 (écart hérité, aucun engine affaibli). Pnpm utilisable : C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs ; install --frozen-lockfile --ignore-scripts. Noms workspace api/client/admin/partners. Drizzle generate depuis apps/api. Contrôles depuis racine via node node_modules/typescript/bin/tsc ; Vitest depuis apps/api.

Ne pas répéter : Omit non distributif sur union LeadCommand ; nouveau conseiller ne peut pas rattacher seul un client sans dossier autorisé ; root search Wallet ajoute profile et ne doit pas être envoyé brut au contrat strict des notifications ; propriétés optionnelles exactes interdisent cursor:undefined explicite selon le type de route. Corrigés. Assertions de sécurité antérieures conservées. Tests d'identité/recommandation désactivent le worker Partner externe comme leurs workers documentaires, sans désactiver leurs assertions.

Avertissements de build hérités : chunks Wallet >500 Ko, ApplicationPage statique/dynamique Partner. Les premiers états AX lors du rechargement peuvent être vides pendant la revalidation ; screenshot puis état courant confirme le refus/candidature. Ne pas en déduire une session habilitée. Aucun accès à emprunter à un autre onglet.

## Coordination

Une seule tâche propriétaire. Après dispatch, le relais 52d5 cesse toute écriture applicative/state.json ; seul dispatch.json ignoré peut enregistrer le suivi. Le nouvel instantané reste inchangé.

Runtime du worktree 52d5 : **API 4100 PID 29928, session exec 19912**, Partner **4104 PID 47352, session 77371**, Wallet de recette **4111 PID 53152, session 80852**. Vérifier PID/commande/port avant tout arrêt ; les modifications d'un nouveau worktree ne s'y reflètent pas. Les anciens processus source API57156/Partner49632 ont été arrêtés, remplacés ; l'API intermédiaire57784 est aussi arrêtée.

Ne pas arrêter/adopter les Vite préexistants **Wallet4101 PID42564 / Admin4102 PID51012**, ni les autres stacks Docker. Config locale : previewEnvironment('D:/Projects/coverview-astra','api'), chargée en mémoire sans affichage ni copie de secrets ; CORS ajoute http://127.0.0.1:4111, AUTH_PARTNER_ORIGIN=4104, PARTNER_JOBS_ENABLED=true. Lanceur actuel ignoré : .planning-local/run-partner-api.mjs dans 52d5. Le magasin DPAPI documentaire reste celui du produit. Un worker secondaire partageant la base doit être désactivé ; remplacer proprement le propriétaire de runtime lors du relais.

CUA Chrome id2 : onglet Partner2058645000 et Wallet recette2058645014. Viewport temporaire réinitialisé. Contrôler par CUA et sa documentation ; pas de capture Codex hors vocal. La tâche suivante poursuit le travail indépendant de la recette privilégiée.
