# Reprise de travail — Partner, report personnel explicite

Créé : 2026-10-03
Contexte observé : non exposé ; relais après tranche cohérente, aucun seuil de70% mesuré.

## Mission et autorisation

Continuer le **brief Partner intégral** du2octobre, dernière instruction « Recommence ». Autonomie maximale persistante, [PROG-23](../execution-policy.md), meilleurs défauts documentés et implémentation séquentielle, pas d'arrêt au plan/socle.

**Propriétaire unique, aucun sous-agent ni écriture applicative concurrente**, malgré délégation proactive. Après tranche : preuves/docs/state/vues, checkpoint<12000, snapshot COMPLET vérifié puis exactement **une** tâche via list_projects/create_thread `gpt-6-astra`/`ultra`, worktree. Gel au dispatch, premier état réel puis lien. Aucun fork/doublon/archive/push/déploiement/stash/reset/clean/commit global WIP. Brief/S-110/S-042a et tous tracks restent ouverts.

PROG-12 : paire demandée ; read_thread confirme tâche `01a0ffba-3ab5-7093-ade5-da4ad0110d99` et worktree7db2. Paramètres effectifs/télémétrie d'inférence/contexte/coût non exposés ; aucune déduction depuis le prompt.

## État du dépôt

Source7db2 : `C:/Users/sebm1/.codex/worktrees/7db2/coverview-astra`, HEAD détaché `4fef49a095739260b9ab9d1becc1a2bf3320a928`. Restauration9ff1 intégrale577fichiers/38350738octets vérifiée. WIP cumulatif non committé, ne pas le réduire à cette tranche.

**NE PAS CODER avant restauration intégrale.** Snapshot7db2 `.planning-local/partner-relay-personal-creation-20261003` ; prompt de dispatch = chemin absolu, hashes manifest/restore, compte/octet vérifiés. Vérifier hashes, lire restore.mjs ENTIER, inspecter nouveau worktree. S'il est propre au mauvais HEAD : `git switch --detach 4fef49a095739260b9ab9d1becc1a2bf3320a928` autorisé dans CE nouveau worktree uniquement, sans reset. Exécuter restore validé avec chemin ABSOLU de la cible puis vérifier tout le WIP/hashes. Aucun entrant perdu ; aucune copie partielle. Ne muter ni7db2/9ff1/f189/anciens worktrees ni D:/Projects.

Quatre fichiers protégés gardent leur hash entrant : apps/admin/src/api.ts, apps/admin/src/locales/fr/service-requests.json, apps/client/src/api.ts, apps/client/src/locales/fr/common.json. Défauts hérités conservés. Ni secrets/configurations privées/node_modules/dist/preview copiés. Installation frozen-lockfile/ignore-scripts ; aucun paquet/lockfile changé.0044/0045/0046 INCHANGÉES.

## Sources à lire

- AGENTS → CLAUDE entier, PROJECT, MEMORY actives, docs/codex, execution-policy et satellites routés.
- [Brief intégral](../../references/coverview-partner-2026-10-02.md), [couverture](../partner-coverage.md), [plan/journal](../plans/partner-core.plan.md), [ledger](../evidence/partner-core.md), [index produit](../../docs/product/README.md). Tous tracks, y compris hors tranche, sont conservés.
- README [API](../../apps/api/src/modules/partner-workspace/README.md) et [Partner](../../apps/partners/README.md), [création7db2](../../apps/api/src/modules/partner-workspace/docs/appointment-creation.md), [temps protégé9ff1](../../apps/api/src/modules/partner-workspace/docs/appointment-time.md), [contrôlef189](../../apps/api/src/modules/partner-workspace/docs/appointment-assessment.md), puis sources de disponibilité/préférences/portée professionnelle routées.
- Inspecter commandes/participants/policy/repository, appointment-creation/assessment/time, routes/contrats et PersonalAppointmentDialog. Aucun fournisseur/paiement/marketing sans besoin réel.

## Décisions acquises

Client canonique ≠ Lead ; plusieurs besoins même personne/catégorie légitimes. Candidature ≠ habilitation. Membre/organisation approuvés, activité/catégorie et mandat explicites ; exception Admin personnelle existante conservée. Visibilité manager insuffisante. Profil géré suit propriétaire actuel, aussi au rejeu. Référent/souhait du besoin n'accordent aucun droit.

Déclarations privées versionnées, révision professionnelle monotone0042, changement/aller-retour exige reconfirmation. Modes/plages datées UTC, fuseau suisse ; absence prioritaire, hors plage inconnu. Préférence client valable pour besoin/profil/propriétaire actuels ; demande de changement prioritaire. Aucun calendrier24h ou statut approuvé ne fournit de disponibilité.0044/0045 déjà appliquées localement, inchangées.

f189 : GET assessment privé d'un RDV programmé par son conseiller seulement, y compris face à Admin. Plages adjacentes/trous/absences/bornes demi-ouvertes, source périmée inutilisée ; chevauchement booléen sans détail d'autre Lead. Lecture sous verrous, aucune réservation. Le contrôle partage désormais ses constats avec la proposition7db2.

9ff1 : « Organiser mon temps » confirme préparation puis aller avant RDV, retour après, entiers0–240 explicites, trajets nuls téléphone/visio. Version privée immuable20dernières consultables, réduction historisée, aucun effet public/Lead/horloges. Absence ultérieure ne libère pas l'occupation ; annulation/issue la libère en gardant preuve. Anciens transferts/clôtures peuvent annuler avec événement. Conditions communes détaillées dans les sources obligatoires.

0046 : colonnes d'occupation + versions privées, garde SQL opposable aux writers N-1 et concurrents, versions immuables. Anciennes lignes sans version = non renseigné, pas zéro préparation prouvé. Anciens conflits sans protection conservés. **0046 testée isolément, NON appliquée à la base locale partagée par9ff1/7db2.** Activation migration→API/UI ; rollback conserve garde/historique/lecteur compatible, correctif en avant.

7db2 : Lead → Rendez-vous → **Programmer mon rendez-vous**. Conseiller=acteur courant, aucun advisorId reçu ; mandat/activité/catégorie/Lead actif recontrôlés, manager sans mandat refusé. Durée15–240, préparation/aller/retour0–240 explicites. POST `/partner/leads/:id/personal-appointments/preview` lit proposition/constats/intervalle ; POST `/confirm` lie proposition exacte+empreinte+attestations. Empreinte acteur/proposition/Lead/sources, jamais réservation. Revalidation session/membre/Lead/planning/profil sous verrous ; rendez-vous+occupation+version+effets historiques atomiques, panne de preuve rollback total.

Attestations non précochées : accord client sur date/durée/mode/lieu ou connexion ; engagements externes vérifiés ; capacité à assurer RDV/suivi ; préparation/trajets adaptés/réalisables. **Déclarations personnelles**, jamais preuve indépendante, agenda externe consulté, capacité globale calculée ou signature client. Éligibilité complète encore inconnue, aucun missingCheck retiré. Preuve0046 conserve modalités initiales exactes, révision Lead, références sujet/profil, attestations versionnées et auteur/date ; les attestations détaillées ne sont pas projetées dans cette tranche. Le contrôle privé permet de consulter durées/historique.

La création réutilise effets historiques : étape RDV planifié, première action utile si absente, prochaine action/échéance du RDV, attente levée, révision et notifications internes. Aucune acceptation/attribution implicite. `appointment.scheduled` ne reçoit que date/mode ; durée privée et attestations ne rejoignent ni DTO partagé ni notification. Même clé/contenu sans doublon, projection actuelle après droits ; perte de mandat/session bloque le rejeu. Les anciennes créations restent possibles hors déclaration, sans attestation rétroactive.

UI RHF/Zod : saisie→récap serveur→quatre cases→confirmation, heures suisses ambiguës refusées. Retour aux champs ; issue incertaine=retry exact figé, erreur masque constats. État modal par session/Lead sans stockage navigateur, lectures invalidées après succès. Aucune nouvelle audience privée. Choix d'offre ≠ signature ; convention ≠ solution distribuable/commission.

## Livraison et preuves

V0/V1 : types/lint API/Partner/Wallet/Admin et quatre builds verts ; frontières570modules/2533dépendances,0erreur/3orphelins www hérités ; Knip ciblé vert. Node24.13.1 sous engine24.20 ; warnings Wallet chunks/ApplicationPage hérités. Aucun paquet/variable/fournisseur/job/room/nouvel événement/migration.

V2 :66tests PostgreSQL/4fichiers en70,97s sur code final ;23contrôle/protection/création,43hérités disponibilité/préférences/repository.7nouveaux scénarios détaillés au ledger : droits/sources/rejeu/confidentialité/conditions/concurrence/rollback SQL de preuve. Les16tests9ff1, dont deux attentes de verrou réelles, restent verts. Tests même agent/acteurs isolés, aucune indépendance/V3 prétendue.

Deux revues statiques même agent :1droits/sources/atomicité, preuve privée complétée ;2UI/cache/retry/audiences, clé session/Lead et contexte client/besoin. V3 rempli/clavier/mobile non observés. Aucun changement base partagée/runtime. S-130/S-131 et RLS héritée ouverts.

## Prochaine action bornée

1. Restaurer snapshot COMPLET, contrôler HEAD/hashes/WIP/protections/session puis relire plan/journal avant mutation.
2. **REPORT PERSONNEL EXPLICITE D'UN RDV**, conserver histoire, responsabilité et accord. Auditer modification atomique de l'engagement/temps protégé, verrous/concurrence/anciennes commandes et notification minimale du changement convenu. Persister défauts/DoD avant code, livrer plus petit parcours complet. Réutiliser7db2/9ff1, contrats, identités, catalogues, RDV, horloges et permissions ; ne refaire ni création ni protection. Jamais annulation silencieuse suivie d'une création sans lien.
3. Toute nouvelle audience exige contrat/projection minimale explicites. Ne promettre disponibilité externe/capacité/éligibilité depuis approbation,24h ou hors plages. Aucune preuve WorkOS/externe inventée. V0/V1/V2 proportionnés, deux revues, V3 selon accès réel.
4. Conserver TOUS tracks : disponibilité/capacité/conflits/matching/réservation et multi-Leads ; marketplace/accords/économie ; statistiques/objectifs/qualité/enquête avec **branchement5étoiles exact demandé**/réclamations ; canaux/transcription et vraie signature/acceptation compagnie. Après tranche : docs/preuves/state/vues, checkpoint court, snapshot COMPLET et exactement un relais Astra/ultra.

## Obstacles et tentatives

WorkOS : fichier configuré dans D:/Projects et WORKOS_API_KEY/WORKOS_CLIENT_ID/AUTH_SESSION_SECRET toujours absents au contrôle booléen7db2. Aucun callback4133/4136 refusé à retenter sans changement réel. Aucun runtime/session/grant/client réel fabriqué, aucun secret récupéré depuis processus. Dernier comptage métier connu908d :0membre/Lead/offre/déclaration/plage, trigger0044 présent ;9ff1/7db2 n'ont pas recompté.

Tests7db2 première passe21/23 : Wallet refuse403, Admin non propriétaire404 ; assertion initiale attendait404 pour les deux, corrigée précisément. `apply` sur candidature déjà approuvée est refusé ; test de round-trip changé vers SQL isolé et trigger monotone, sans assouplir la règle. Lint test/RHF corrigé, tous finaux verts. Hérités invalidés : DTO id/state interdits dans entrée de RDV ; verrou planning avant insertion même Lead causait40P01, montage corrigé vers deux Leads affectés. Ne pas rejouer ces montages.

Pnpm via node `C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs`. API build depuis apps/api ; Vite via node node_modules/vite/bin/vite.js build depuis chaque app. Vitest config racine. Helper7db2 `.planning-local/export-personal-creation.mjs` en lecture seule ; diff --no-index --check code1 sans sortie = différence normale.

## Coordination

Aucun sous-agent. Docker/API4100/previews4101–4139 protégés ; inventaire historique au checkpoint9ff1. Aucun runtime7db2 lancé. Revalider ports avant usage, ne pas arrêter/adopter d'anciens processus. Testcontainers7db2 terminés par leur lifecycle.

Au create_thread : gel applicatif/state7db2, attendre premier état réel puis lien. Si clientThreadId, retrouver threadId avant wait_threads, aucune deuxième création. list_threads peut omettre les worktrees ; ne pas fabriquer d'ID. Aucun archivage. Ce checkpoint ne remplace ni le brief intégral ni le mandat.
