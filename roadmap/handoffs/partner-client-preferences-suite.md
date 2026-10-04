# Reprise de travail — Partner, préférences de conseil du besoin

Créé : 2026-10-03
Contexte observé : non exposé ; relais à la fin d'une tranche cohérente, aucun seuil de70% mesuré.

## Mission et autorisation

Continuer le **brief Partner intégral** du2octobre, dernière instruction utilisateur « Recommence ». Autonomie maximale persistante et [PROG-23](../execution-policy.md) : exécuter, choisir les meilleurs défauts documentés et poursuivre sans GO répété. Ce n'est ni un audit seul ni une demande d'arrêter après un socle. Priorité à un parcours cohérent sans fausse intégration/preuve.

**Propriétaire unique, aucun sous-agent, aucune écriture applicative concurrente.** Ce choix explicite prime le réglage de délégation proactive. Après une tranche cohérente : README/plan/journal/ledger/couverture/state, vues régénérées, checkpoint court et snapshot complet vérifié ; exactement **une** nouvelle tâche séquentielle via list_projects/create_thread, modèle `gpt-6-astra`, thinking `ultra`. Gel des écritures applicatives/state au dispatch, attendre premier état réel et fournir lien. Pas de fork, doublon, archive, push, déploiement ou commit global WIP.

Brief/S-110/S-042a et tous les tracks restent ouverts. Astra/ultra demandé ; réglage effectif/coût/contexte non exposés, aucune télémétrie inventée.

## État du dépôt

Source ce17 : `C:/Users/sebm1/.codex/worktrees/ce17/coverview-astra`, HEAD détaché `4fef49a095739260b9ab9d1becc1a2bf3320a928`. Ce17 était propre à ba49851 ; placement détaché autorisé sans reset, snapshot5944 restauré intégralement après vérification (536fichiers,36423926octets). Tout le WIP cumulatif reste non committé, y compris interfaces et acquis antérieurs ; ce n'est pas un diff isolé à copier partiellement.

**Ne pas coder avant restauration complète.** Le prompt de dispatch donne chemin absolu du snapshot ce17, hashes manifest/restore et nombre/octet vérifiés. Snapshot : `.planning-local/partner-relay-practice-20261003` dans ce17. Vérifier ces hashes, lire entièrement restore.mjs. Inspecter le nouveau worktree : s'il est propre et au mauvais HEAD, `git switch --detach 4fef49a095739260b9ab9d1becc1a2bf3320a928` est autorisé, sans reset. Exécuter le restore validé avec chemin absolu du nouveau worktree ; son idempotence refuse tout fichier divergent. Vérifier tous les fichiers/hashes et l'absence de perte. Aucune mutation du source ce17, des autres worktrees ou de D:/Projects.

Ne pas stash/reset/clean ni commiter globalement le WIP. Quatre fichiers à défauts de diff hérités restent inchangés par SHA : Admin api.ts et locales/fr/service-requests.json, Wallet api.ts et locales/fr/common.json. Aucun secret, configuration privée, node_modules, dist/build/preview à copier. Installation `pnpm install --frozen-lockfile --ignore-scripts`, paquets et lockfile inchangés par ce17.

## Sources à lire

- AGENTS → CLAUDE entier, PROJECT, MEMORY actives, docs/codex et execution-policy ; puis satellites routés et README propriétaires.
- [Plan Partner et journal ce17](../plans/partner-core.plan.md), [ledger](../evidence/partner-core.md), **[registre complet](../partner-coverage.md)** puis [brief utilisateur intégral](../../references/coverview-partner-2026-10-02.md), sans réduire sa portée. Ancrages prochaine tranche : I.6/10.2–10.4/12/18/20, II.2/7/16.
- [README API Partner](../../apps/api/src/modules/partner-workspace/README.md), [langues/cantons](../../apps/api/src/modules/partner-workspace/docs/professional-practice.md), [périmètre professionnel](../../apps/api/src/modules/partner-workspace/docs/professional-scope.md), [conventions](../../apps/api/src/modules/partner-workspace/docs/conventions.md), ADR-0010.
- README Partner, Wallet offers, profiles, identity, insurance-requests ; contrat Partner/professional-practice, création/édition Lead, commandes Wallet, policy/referents/projections. Contrats/API/data/permissions/security/evolution, frontend/design/brand/i18n, testing/environment/program/documentation selon impact. Autres satellites uniquement si le changement les touche.

## Décisions acquises

Client canonique ≠ Lead ≠ offre ≠ police ; plusieurs besoins même client/catégorie légitimes. Aucun Client parallèle, accès Wallet par email ou accord/habilitation implicite. Droits du responsable affecté, Admin/MFA et propriétaire Wallet courant contrôlés par audience ; notes privées et transfert protégés.

Les demandes insurance-requests rejoignent un Lead par personne après accord courant ; snapshot historique individuel, pas de reconstruction depuis catalogue/profil actuel. La localité tarifaire du comparateur n'est pas une préférence de lieu de conseil. Lead actuel : langue en texte libre, aucune zone structurée d'intervention. Référents par profil/catégorie restent un choix relationnel sans attribution implicite. Demande client de changement et clôture priment la suggestion.

**Acquis ce17,0043** : déclaration personnelle append-only distincte des textes de candidature. Catalogue183codes figés dans professional-practice.ts ; labels par Intl.DisplayNames,26cantons et noms www promus dans UI. Réemployer ces référentiels. Max20langues/26cantons entiers ; vide=non renseigné. Zones partielles/hors Suisse et modes professionnels ouverts.

Lecture personnelle/Admin MFA, écriture pour soi après candidature sauf compte fermé. Révisions de déclaration/professionnelle sous verrou, historique20 indépendant du courant, retry exact sans doublon. Résumé atomique membre/déclaration = statut/listes/date seulement ; données privées exclues. Langue/zone restent missingChecks faute de préférence confirmée du besoin ; aucun score/aptitude/disponibilité/attribution inféré.

**Acquis0042 conservé** : révision professionnelle monotone sur nom, organisation déclarée/interne et ensemble des catégories. Changement puis retour ne réactive aucun examen ; nouvelle déclaration puis examen explicites. Changer langues/zones/contact/ordre des catégories ne modifie pas cette révision ni les pièces/examens. Ne pas élargir silencieusement l'invalidation. Anciennes parties inconnues restent inconnues ; trigger couvre écrivains N-1, ancienne API de lecture ne doit pas servir les parcours incompatibles. Conserver trigger/tables/preuves en rollback, correctif en avant.

Compétence/convention privées : original canonique sans client/OCR/LLM, examen distinct de certification/droit. Conventions restent manquantes sans compagnie/solution exacte ; aucune équivalence juridique par nom/Priminfo. Aucun grant/taux/commission/signature/acceptation inventé. Choix ≠ signature. Préférence/lecture/note/acceptation ne redémarrent pas les horloges ni ne résolvent les alertes ; règles canoniques au README. S-130/S-131 ouverts.

## Livraison et preuves

V0/V1 : types/lint/builds API/Partner/Wallet/Admin et www passent ; frontières555modules/2407dépendances,0erreur/3avertissements hérités, Knip quatre apps vert.0043 locale sans reset, migrations deux fois en PG isolé, génération suivante sans delta. Node24.13.1 sous engine24.20 et warnings chunks/imports hérités. Aucun paquet/variable/room/worker/fournisseur nouveau.

V2 : **58 tests PostgreSQL/5fichiers finaux**,74,53s. Depuis apps/api : `node ../../node_modules/vitest/vitest.mjs run src/platform/partner-practice.test.ts src/platform/partner-professional-scope.test.ts src/platform/partner-competence.test.ts src/platform/partner-convention.test.ts src/modules/partner-workspace/partner.repository.test.ts`. Sept scénarios ajoutés ; droits, révisions, clé/concurrence, histoire23versions, reconfirmation après aller-retour, projection minimale et aucun changement Lead/notifications/référent/examens/source. Acteurs/fichiers synthétiques en Testcontainers uniquement.

Deux revues du même agent, sans indépendance ni preuve visuelle : catalogue figé, parties d'origine affichées, cache au succès, visibilité et recherche améliorées. Deux assertions Admin/membre alignées sur le même rôle, lint corrigé sans bypass. Première génération0043 corrigée **avant** application ; ne jamais réécrire cette migration désormais appliquée. Détails au ledger.

**V3 ce17 non effectué** : fichier WorkOS configuré dans D:/Projects absent, trois valeurs WorkOS nécessaires absentes de cette configuration (présence booléenne uniquement). Aucun secret de processus récupéré/configuration changée/callback refusé retenté. Maintenance DB seule en mémoire avec garde loopback/base coverview_local :0membre/Lead/offre/compétence/convention/practice, trigger0042 présent et référentiel26/26cantons identique. Aucun runtime ce17 lancé, aucune donnée/grant/accord/justificatif réel créé. Formulaires peuplés/clavier/mobile restent non vérifiés.

## Prochaine action bornée

1. Restaurer intégralement le snapshot et relire sources/journal avant mutation. Vérifier les réglages réellement exposés sans inventer de télémétrie.
2. **Préférences de conseil structurées et confirmées pour chaque besoin/Lead** : langue, mode et lieu d'intervention, selon la plus petite tranche cohérente après audit. Inspecter création/édition Partner et Wallet, propriétaire/révision des profils, reprise insurance-requests, rendez-vous, référents et projections avant schéma. Réemployer catalogues/langues/cantons/identités existants. Ne pas convertir les textes historiques, domicile ou choix d'un conseiller en consentement du client. Plan et défauts délégués persistés avant code.
3. Parcours de déclaration/édition/confirmation par propriétaire courant, lecture selon audience sans Client dupliqué. Protéger révisions, changement de propriétaire, rejeu/concurrence et ancien besoin. Les critères non prouvés restent manquants, aucune attribution automatique.
4. V0/V1/V2 proportionnés aux risques (droits, révisions, historique, consentement, horloges), migrations si nécessaires, deux revues et V3 selon accès réels. WorkOS absent limite V3, pas le travail indépendant ; aucun dossier/grant ou justificatif réel de recette ni callback secondaire déjà refusé.
5. Conserver les tracks : modes professionnels/disponibilités/absences/capacité/conflits/matching, marketplace/accords/économie, statistiques/objectifs/qualité/enquête avec **branchement exact demandé**/réclamations, canaux/transcription et vraie signature/acceptation compagnie. Résultat cohérent, preuves/docs/state puis snapshot/checkpoint et **un seul** relais Astra/ultra.

## Obstacles et tentatives

Pnpm exécutable via `node C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs`. API build/drizzle-kit depuis apps/api ; Vite depuis chaque app. Installer sans scripts, ne pas copier node_modules/configuration privée.

Ne pas relancer les callbacks WorkOS4133/4136 déjà refusés sans changement réel. UI ne dépend pas des contrats : labels de présentation seulement. SQL Drizzle des enums doit produire des constantes, pas des paramètres. Diff --no-index code1 sans diagnostic signifie différence ; tout diagnostic --check reste bloquant. Incidents au ledger.

## Coordination

Propriétaire unique et aucun sous-agent. Docker, API4100 et toutes previews4101–4139 protégés. Anciens runtimes b920 API4133/Wallet4134/Partner4135 et8a00 API4136/Partner4137/Wallet4138 protégés ; Admin4139 non lancé au dernier constat. cc1c/5944/ce17 n'ont lancé aucun runtime.4140–4143 libres seulement au constat cc1c : revalider ports/PID/commandes avant démarrage, ne jamais arrêter un ancien processus.

Après create_thread, gel applicatif/state du prédécesseur. Si clientThreadId renvoyé, retrouver le vrai threadId avec list_threads avant wait_threads, sans deuxième création. Attendre premier état réel, lien et aucune archive. Une compaction ne remplace pas la mission initiale.
