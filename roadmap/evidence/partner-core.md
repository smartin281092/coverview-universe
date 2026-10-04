# Partner — preuves et limites au 2 octobre 2026

Mandat : brief consolidé intégral et « Recommence », avec autonomie et poursuite séquentielle autorisées. [Plan](../plans/partner-core.plan.md), [source utilisateur](../../references/coverview-partner-2026-10-02.md), [couverture par exigence](../partner-coverage.md). Session demandée Astra/ultra ; réglage effectif et coût de cette session non exposés, aucune valeur inventée.

## Livré dans le code

**Vérifié V0–V2** : nouvelle application Partner et module commun ; validations utilisateur/organisation, droits par affectation, Leads distincts des profils, Kanban/liste, édition, tâches, rendez-vous, notes avec audience, prochaines actions/attentes, clôture, journal et offres versionnées. Vue Admin et espace Wallet Offres. Transactions révisionnées/idempotentes et contrôle de l'accès courant sur rejeu. Le retrait des droits enlève l'affectation active, annule les futurs rendez-vous non repris et permet de transférer les tâches ; preuves et offres restent conservées.

**Vérifié V1** : migrations additives 0027–0028 appliquées à la base locale existante ; migrations répétées dans PostgreSQL isolé sans reset du projet. Builds API, Partner, Wallet et Admin. Configuration non secrète `AUTH_PARTNER_ORIGIN`/CORS 4104, surface AuthKit `partners`, nouvelle entrée preview et export des contrats/clients HTTP.

**Vérifié V2** : 23 tests ciblés passent (Partner, routes identity, ciblage documentaire). Les trois tests PostgreSQL Partner ont ensuite été rejoués après les corrections finales de transfert : 3/3, 9,46 s. Ils couvrent refus avant validation et entre collègues, apporteur restreint, projection Wallet, notes privées, multiplicité des Leads, concurrence/idempotence/révisions, absence de reset de l'horloge sur acceptation, pas d'attribution hors catégorie ni d'horloge de brouillon, conflits de RDV, maintien du contrat comme résolution positive, publication/revue, version remplacée non sélectionnable, rétention/source vue dédupliquée, reprise du document par le nouveau conseiller, retrait du rôle et reprise des tâches. Identités et fichiers synthétiques uniquement dans Testcontainers ; aucune preuve fournisseur réelle revendiquée.

**Vérifié V0** : TypeScript API/Partner/Wallet/Admin, ESLint des fichiers nouveaux et intégrations ciblées, dependency-cruiser (194 modules, 750 dépendances), Knip API/Partner/Wallet/Admin. Aucun contrôle désactivé. Aucun nouveau paquet tiers spécialisé : les versions existantes de React, Vite, Router/Query, i18next, formulaires, Zod et UI ont été reprises.

## Parcours réel observé

**Vérifié V3 limité** : API locale et Partner démarrent ; connexion WorkOS/Google réelle vers Partner. Le compte connecté reste candidat : seules candidature/profil et navigation autorisée sont affichés, aucun Lead du réseau visible. Aucune candidature réelle n'a été fabriquée ni soumise pour forcer la recette.

**Vérifié V3 limité** : Wallet partage la session existante, présente l'espace Offres vide et permet d'ouvrir le formulaire de demande. Le sélecteur utilise le profil existant ; la transmission reste explicitement cochable et non préacceptée. Sur 390×844, formulaire et page sont lisibles avec défilement interne ; sur 820×1000, la navigation ne déborde pas. Les fermetures accessibles manquantes ont été ajoutées puis observées. Le changement de profil dans le formulaire reste désormais sur place. Aucun Lead/client fictif, aucune offre exemple et aucun message à un tiers n'ont été créés dans la base réelle.

**Fait non vérifié V3** : une session approuvée doit encore exécuter création → attribution → tâches/RDV → import documentaire → revue → publication → comparaison/choix Wallet. Le compte disponible n'a pas l'habilitation requise ; ne pas se l'accorder pour une capture. Les anciennes autorisations nominatives sont conservées dans les ledgers identity, elles ne s'étendent pas au compte actuellement connecté.

## Limites fonctionnelles précises

- Le rafraîchissement HTTP est périodique (10–15 s). Le journal est persistant, mais aucune diffusion immédiate, notification email/SMS ou escalade BullMQ Partner n'est activée. L'horloge et ses alertes ne prouvent pas une notification envoyée.
- Le contact non rattaché ne prépare pas encore l'invitation Wallet. Les demandes historiques `insurance-requests` ne créent pas encore leurs Leads. Doublons/fusion, co-conseil, référents et matching restent ouverts.
- L'extraction réutilise OpenAI/document-intelligence, mais l'import d'une offre puis son téléchargement partagé ne sont pas vérifiés ici avec une vraie source et des sessions des deux rôles. La rétention bloque la suppression ordinaire ; effacement/rétention réglementaire reste un parcours à développer.
- Comparaison entre offres actives et champs normalisés disponible dans le code. Pas encore de contrat actuel automatiquement rattaché, de calcul complet gains/pertes ni d'audit de marché. Une sélection n'est ni une signature ni une acceptation de compagnie. Signature, police finale et écarts contractuels restent absents.
- Marketplace, réservations, conditions/accords/rémunérations, objectifs, statistiques complètes, enquêtes, réclamations, appels/transcriptions et disponibilités client ne sont pas réalisés. Le [registre de couverture](../partner-coverage.md) conserve ces exigences ; aucun « done » global.

## Exécution, reprises et écarts

Checkout initial déjà largement modifié, HEAD `4fef49a095739260b9ab9d1becc1a2bf3320a928`. Modifications préexistantes conservées, en particulier migrations 0018–0026 et modules/profils/demandes/marketing. Aucun reset, stash, suppression, push, déploiement ou commit mélangeant ces travaux.

Le shim pnpm du PATH est cassé ; utiliser le paquet déjà installé à `C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs`, noms de workspaces `api`, `client`, `admin`, `partners` (sans préfixe). Installation en ligne `--ignore-scripts` effectuée. Node disponible : 24.13.1, alors que le dépôt demande >=24.20 ; écart d'environnement conservé, pas de modification de l'engine pour le masquer. Les commandes indiquées ont réellement passé sous ce runtime ; la compatibilité au runtime cible reste à confirmer.

La roadmap comportait trois notes métier préexistantes uniquement dans le backlog généré. Elles ont été conservées dans `state.json` avant régénération, avec la note de suivi Partner S-110 sans changer son statut. Une erreur Windows d'ouverture a empêché l'écriture directe du générateur sur un plan ; les différences produites par le générateur ont été appliquées avec l'outil de patch. Le contrôle final `build-roadmap.mjs --check --require-complete` passe (251 vues, 122 slices). Cette preuve porte sur les artefacts de planification, pas sur 122 fonctionnalités livrées.

Les builds signalent des chunks >500 Ko et un import ApplicationPage à la fois statique/dynamique dans Partner. Ce sont des avertissements, pas des tests ignorés. Au redémarrage d'un ancien processus, un timeout Redis préexistant a aussi été constaté ; aucun correctif hors périmètre appliqué.

`scripts/preview.mjs start --require-auth` refuse de prendre les ports Wallet/Admin déjà utilisés par des processus non possédés. Ces processus n'ont pas été arrêtés. Preview de cette tâche : API 4100 et Partner 4104 lancés séparément ; le [checkpoint](../handoffs/partner-core-suite.md) porte les PID/sessions à vérifier avant intervention. Le transfert utilise une copie locale des changements avec manifeste SHA-256, excluant fichiers ignorés/secrets/dépendances/builds, pour conserver le WIP sans commiter les travaux d'autrui. Il ne constitue ni merge ni livraison Git de l'ensemble.

## Vérifier à nouveau au besoin

Depuis la racine : `node node_modules/typescript/bin/tsc --noEmit -p apps/partners/tsconfig.json` (idem API/client/admin). Depuis `apps/api` : `node ../../node_modules/vitest/vitest.mjs run src/modules/partner-workspace/partner.repository.test.ts` ; `node build.mjs`. Depuis chaque frontend : `node node_modules/vite/bin/vite.js build`. Ne pas répéter ces vérifications sans nouveau changement ou risque.
