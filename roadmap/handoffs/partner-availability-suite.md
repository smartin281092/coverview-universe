# Reprise de travail — Partner, modes et disponibilités professionnelles

Créé : 2026-10-03
Contexte observé : non exposé ; relais après une tranche cohérente, aucun seuil de70% mesuré.

## Mission et autorisation

Continuer le **brief Partner intégral** du2octobre, dernière instruction utilisateur « Recommence ». Autonomie maximale persistante et [PROG-23](../execution-policy.md) : exécuter, choisir les meilleurs défauts documentés et poursuivre sans GO répété. Ce n'est ni un audit seul ni une demande d'arrêter après un socle. Priorité à un parcours cohérent sans fausse intégration/preuve.

**Propriétaire unique, aucun sous-agent, aucune écriture applicative concurrente.** Ce choix explicite prime le réglage de délégation proactive. Après une tranche cohérente : README/plan/journal/ledger/couverture/state, vues régénérées, checkpoint court et snapshot complet vérifié ; exactement **une** nouvelle tâche séquentielle via list_projects/create_thread, modèle `gpt-6-astra`, thinking `ultra`. Gel des écritures applicatives/state au dispatch, attendre premier état réel et fournir lien. Pas de fork, doublon, archive, push, déploiement ou commit global WIP.

Brief/S-110/S-042a et tous les tracks restent ouverts. Astra/ultra demandé ; réglage effectif/coût/contexte non exposés, aucune télémétrie inventée.

## État du dépôt

Source6469 : `C:/Users/sebm1/.codex/worktrees/6469/coverview-astra`, HEAD détaché `4fef49a095739260b9ab9d1becc1a2bf3320a928`.6469 était propre à ba49851 ; placement détaché autorisé sans reset, snapshotce17 restauré intégralement après vérification (548fichiers,36899798octets). Tout le WIP cumulatif reste non committé ; ce n'est pas un diff isolé à copier partiellement.

**Ne pas coder avant restauration complète.** Le prompt de dispatch donne chemin absolu du snapshot6469, hashes manifest/restore et nombre/octet vérifiés. Snapshot : `.planning-local/partner-relay-advice-20261003` dans6469. Vérifier ces hashes, lire entièrement restore.mjs. Inspecter le nouveau worktree : s'il est propre et au mauvais HEAD, `git switch --detach 4fef49a095739260b9ab9d1becc1a2bf3320a928` est autorisé, sans reset. Exécuter le restore validé avec chemin absolu du nouveau worktree ; il refuse les fichiers divergents. Vérifier tous les fichiers/hashes et l'absence de perte. Aucune mutation du source6469, des autres worktrees ou de D:/Projects.

Ne pas stash/reset/clean ni commiter globalement le WIP. Quatre fichiers à défauts de diff hérités restent inchangés par SHA : Admin api.ts et locales/fr/service-requests.json, Wallet api.ts et locales/fr/common.json. Aucun secret, configuration privée, node_modules, dist/build/preview à copier. Installation `pnpm install --frozen-lockfile --ignore-scripts`, paquets et lockfile inchangés par6469.

## Sources à lire

- AGENTS → CLAUDE entier, PROJECT, MEMORY actives, docs/codex et execution-policy ; satellites routés et README propriétaires.
- [Brief intégral](../../references/coverview-partner-2026-10-02.md), [couverture](../partner-coverage.md), [plan/journal Partner](../plans/partner-core.plan.md), [ledger](../evidence/partner-core.md) et [index produit](../../docs/product/README.md). La tranche suivante ne remplace pas tout le mandat.
- [API Partner](../../apps/api/src/modules/partner-workspace/README.md) et ses routes vers [préférences par besoin](../../apps/api/src/modules/partner-workspace/docs/advice-preferences.md), [langues/cantons professionnels](../../apps/api/src/modules/partner-workspace/docs/professional-practice.md), [périmètre professionnel](../../apps/api/src/modules/partner-workspace/docs/professional-scope.md), [conventions](../../apps/api/src/modules/partner-workspace/docs/conventions.md). Lire les sections rendez-vous, paramètres de continuité et référents.
- README Partner, Wallet/offers, profiles, identity, insurance-requests et contrats/API/data/permissions/security/events/evolution/frontend/design/i18n/testing/environment/program avant leurs modifications. Aucun besoin de fournisseurs/paiement/marketing dans la tranche bornée actuelle.

## Décisions acquises

Client canonique ≠ Lead ; plusieurs besoins même personne/catégorie sont légitimes. Pas de profil nouveau ni consentement inféré de textes/domicile/email. Candidature n'ouvre pas le droit de conseil ; affectation, rôle et organisation approuvés restent nécessaires. Référent de catégorie et préférences du besoin ne donnent aucun droit sur un Lead. Profil géré suit le propriétaire courant, y compris au rejeu après transfert.

6469 livre langue facultative, mode phone/video/office/home facultatif et canton souhaité facultatif pour bureau/domicile ; distant ou mode absent interdit canton. Confirmation propriétaire Wallet courante par Lead, lecture Partner/Admin, historique20 et événements filtrés par sujet canonique. Vide = non renseigné, pas indifférence. Aucune conversion du legacy. Portée du besoin monotone via trigger0044 sur sujet/titre/catégorie/objet/contexte, profil géré via révision canonique ; aller-retour ne réactive pas un ancien accord. Préférences ont leur révision propre, aucun effet sur Lead/horloge/notifications/RDV/référent/examens. Les règles détaillées et contrat S-130/S-131 sont dans le document propriétaire.

ce17 livre183codes de langues canoniques figés et26cantons entiers, déclaration professionnelle personnelle versionnée ; résumé minimal dans la continuité, sans aptitude ou matching déduit. Les codes et noms existants doivent être réemployés.0042 protège les parties et catégories professionnelles même après aller-retour ;0043 leurs déclarations linguistiques/géographiques. Les preuves historiques gardent leurs parties d'origine sans inventer ce qui manque.

Compétence/convention privées : original canonique sans client/OCR/LLM, examen distinct de certification/droit. Conventions restent à examiner sans compagnie/solution exacte. Aucun grant/taux/commission/signature/acceptation inventé. Choix ≠ signature. Préférence/lecture/note/acceptation ne redémarrent pas les horloges ni ne résolvent les alertes. Demande client de changement et clôture prioritaires. S-130/S-131 ouverts.

## Livraison et preuves

V0/V1 : types/lint/builds API/Partner/Wallet/Admin passent ; frontières557modules/2437dépendances,0erreur/3avertissements www hérités, Knip quatre apps vert.0044 appliquée localement sans reset, migrations deux fois dans le nouveau PG isolé, génération suivante sans delta. Node24.13.1 sous engine24.20 et warnings chunks/imports hérités. Aucun paquet/variable/room/job/fournisseur nouveau.

V2 : **87 tests PostgreSQL/8fichiers finaux**,94,31s. Depuis racine : `node node_modules/vitest/vitest.mjs run apps/api/src/platform/partner-advice.test.ts apps/api/src/modules/partner-workspace/partner.repository.test.ts apps/api/src/platform/partner-practice.test.ts apps/api/src/platform/partner-professional-scope.test.ts apps/api/src/platform/partner-competence.test.ts apps/api/src/platform/partner-convention.test.ts apps/api/src/platform/insurance-requests.test.ts apps/api/src/platform/insurance-projection.test.ts`. Six scénarios ajoutés ; droits, révisions, concurrence/rejeu, histoire23versions, transferts réels via repository, aller-retour besoin/propriétaire, sujet différent et invariance des autres objets. Acteurs/données synthétiques en Testcontainers seulement.

Deux revues statiques du même agent : état historique UI rebasé sur réponse autorisée, événements filtrés par sujet, portée exacte affichée et confirmation/retry figés. Deux attentes de test corrigées (langue contact masquée dans Wallet ; clôture avec résultat/motif) et types SQL précisés pour lint, aucun guard assoupli.0044 désormais appliquée : ne pas réécrire la migration ; conserver trigger/tables/preuves au rollback et corriger en avant.

**V3 non effectué** : fichier WorkOS configuré et trois valeurs nécessaires absents de la configuration D:/Projects, vérification de présence booléenne seule. Aucun secret de processus récupéré/configuration changée/callback refusé retenté. Maintenance DB en mémoire avec garde loopback/base coverview_local :0membre/Lead/offre/practice/préférence, trigger0044 présent. Aucun runtime6469 lancé ni donnée client/grant/accord de recette réel créé. Formulaires peuplés/clavier/mobile restent non vérifiés.

## Prochaine action bornée

1. Restaurer intégralement le snapshot, relire sources/journal et inspecter l'existant avant mutation. Vérifier les réglages réellement exposés sans télémétrie inventée.
2. **Modes d'intervention professionnels et disponibilités/absences** : auditer déclarations professionnelles, profil/organisation, rendez-vous/chevauchement et calendrier de continuité, puis définir la plus petite tranche utilisateur cohérente. Distinguer souhait client, mode proposé, disponibilité déclarée et créneau effectivement libre. Réemployer mode/langue/canton/identité canoniques, sans déduire disponibilité de l'approbation ou du calendrier de délai24h.
3. Documenter défauts/DoD avant code. Parcours personnel explicite, lecture par audience, révisions/historique selon risques, aucune disponibilité fabriquée ni promesse de rendez-vous/matching automatique. Préserver transferts, demande client de changement, contexte professionnel, responsabilités et horloges. Capacité/conflits restent non prouvés tant que leurs parcours ne sont pas raccordés.
4. V0/V1/V2 proportionnés, migrations additives si nécessaires, deux revues et V3 selon accès réels. WorkOS absent limite V3, pas le travail indépendant ; aucune donnée/grant ou justificatif réel de recette, aucun callback secondaire déjà refusé.
5. Conserver tous les tracks : capacité/conflits/matching, marketplace/accords/économie, statistiques/objectifs/qualité/enquête avec **branchement exact demandé**/réclamations, canaux/transcription et vraie signature/acceptation compagnie. Résultat cohérent, preuves/docs/state/vues puis snapshot/checkpoint et **un seul** relais Astra/ultra.

## Obstacles et tentatives

Pnpm exécutable via `node C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs`. API build/drizzle-kit depuis apps/api ; Vite depuis chaque app. Installer sans scripts, ne pas copier node_modules/configuration privée.

Ne pas relancer callbacks WorkOS4133/4136 sans changement réel. SQL Drizzle des enums doit produire des constantes, pas des paramètres. Diff --no-index code1 sans diagnostic signifie différence ; tout diagnostic --check reste bloquant. Helpers de6469 lisibles pour inspection ciblée : `.planning-local/advice-maintenance.mjs`, `advice-changes.mjs`, `export-advice.mjs` ; ne jamais exécuter leur mutation sur le source. Incidents et commandes au ledger.

## Coordination

Propriétaire unique, aucun sous-agent. Docker/API4100 et previews4101–4139 protégés. Runtimes b920 API4133/Wallet4134/Partner4135 et8a00 API4136/Partner4137/Wallet4138 protégés ; Admin4139 non lancé au dernier constat. cc1c/5944/ce17/6469 n'ont lancé aucun runtime.4140–4143 libres seulement au constat cc1c : revalider avant démarrage, ne jamais arrêter/adopter un ancien processus.

Après create_thread, gel applicatif/state du prédécesseur. Si clientThreadId renvoyé, retrouver le vrai threadId via list_threads avant wait_threads, sans deuxième création. Attendre premier état réel, lien et aucune archive. Une compaction ne remplace pas la mission initiale.
