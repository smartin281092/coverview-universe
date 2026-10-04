# Reprise de travail — Partner, confirmation personnelle des rendez-vous

Créé : 2026-10-03
Contexte observé : non exposé ; relais après tranche cohérente, aucun seuil de70% mesuré.

## Mission et autorisation

Continuer le **brief Partner intégral** du2octobre, dernière instruction « Recommence ». Autonomie maximale persistante, [PROG-23](../execution-policy.md), meilleurs défauts documentés et implémentation séquentielle ; pas d'arrêt à un plan/socle.

**Propriétaire unique, aucun sous-agent ni écriture applicative concurrente**, malgré délégation proactive. Après tranche : preuves/docs/state/vues, checkpoint<12000 et snapshot COMPLET vérifié ; exactement **une** tâche via list_projects/create_thread `gpt-6-astra`/`ultra`, worktree. Gel au dispatch, premier état réel puis lien. Aucun fork/doublon/archive/push/déploiement/stash/reset/clean/commit global WIP. Brief/S-110/S-042a et tous tracks ouverts.

PROG-12 : Astra/ultra enregistrés pour9ff1 selon métadonnées lues par le prédécesseur. read_thread confirme tâche/worktree. Télémétrie d'inférence/contexte/coût non exposée.

## État du dépôt

Source9ff1 : `C:/Users/sebm1/.codex/worktrees/9ff1/coverview-astra`, HEAD détaché `4fef49a095739260b9ab9d1becc1a2bf3320a928`. Initialement propre àba49851 ; placement détaché autorisé sans reset puis restaurationf189 intégrale572fichiers/37911029octets vérifiée. WIP cumulatif non committé, ne pas le réduire à cette tranche.

**NE PAS CODER avant restauration intégrale.** Snapshot9ff1 `.planning-local/partner-relay-protected-time-20261003` ; le prompt de dispatch contient son chemin absolu, les hashes manifest/restore, compte et octets vérifiés. Vérifier hashes, lire restore.mjs ENTIER et inspecter nouveau worktree. S'il est propre au mauvais HEAD, `git switch --detach 4fef49a095739260b9ab9d1becc1a2bf3320a928` autorisé dans CE nouveau worktree uniquement, sans reset. Exécuter restore validé avec chemin ABSOLU de la cible, puis vérifier tout le WIP/hashes. Aucun fichier entrant perdu. Ne muter ni9ff1/f189/anciens worktrees ni D:/Projects.

Quatre fichiers protégés gardent leur hash entrant du manifest : apps/admin/src/api.ts, apps/admin/src/locales/fr/service-requests.json, apps/client/src/api.ts, apps/client/src/locales/fr/common.json. Défauts hérités conservés. Ni secrets/configurations privées/node_modules/dist/preview, ni copie partielle. Installation frozen-lockfile/ignore-scripts, aucun paquet/lockfile changé.

## Sources à lire

- AGENTS → CLAUDE entier, PROJECT, MEMORY actives, docs/codex, execution-policy et satellites routés.
- [Brief intégral](../../references/coverview-partner-2026-10-02.md), [couverture](../partner-coverage.md), [plan/journal](../plans/partner-core.plan.md), [ledger](../evidence/partner-core.md), [index produit](../../docs/product/README.md). Tout le mandat est conservé, y compris les tracks hors tranche.
- [README API](../../apps/api/src/modules/partner-workspace/README.md), [temps protégé9ff1](../../apps/api/src/modules/partner-workspace/docs/appointment-time.md), [contrôle privéf189](../../apps/api/src/modules/partner-workspace/docs/appointment-assessment.md) et les documents de disponibilités, préférences, portée professionnelle, langues/zones et conventions routés depuis le README.
- README Partner et satellites avant code ; inspecter commands/participants/policy/repository, appointment-assessment/time, routes/contrats et interfaces. Aucun fournisseur/paiement/marketing sans besoin réel.

## Décisions acquises

Client canonique ≠ Lead ; plusieurs besoins même personne/catégorie légitimes. Candidature ≠ habilitation. Membre/organisation approuvés, activité/catégorie et mandat explicites ; exception Admin personnelle existante conservée. Une visibilité manager seule ne fournit pas de mandat. Profil géré suit son propriétaire actuel, même au rejeu. Référent/souhait du besoin ne donnent aucun droit.

Déclarations privées versionnées, après candidature, lecture Admin/MFA mais aucun droit collègue/manager/Wallet sur les plages, aucune écriture Admin pour autrui. Closed ferme écriture/rejeu et garde consultation valide. Révision professionnelle monotone0042 ; changement/aller-retour exige reconfirmation. Plages UTC/fuseau suisse, absences prioritaires, hors plage inconnu. Aucun effet implicite sur engagements/horloges.0044/0045 déjà appliquées localement et INCHANGÉES ; ne pas réécrire.

f189 : GET /partner/leads/:id/appointments/:appointmentId/assessment, contrôle privé d'un RDV programmé par son conseiller seulement, même face à Admin. Plages adjacentes/trous/absences/bornes demi-ouvertes ; déclaration périmée inutilisée. Souhait client actuel, reconfirmation après transfert/aller-retour/profil/besoin changé. Demande de changement prioritaire. Chevauchement = booléen sans détail d'autre Lead. Lecture sous verrous, aucune réservation/écriture.

9ff1 : depuis ce contrôle, **Organiser mon temps** confirme préparation puis aller avant le RDV, retour après. Chaque durée entière0–240 est explicite, y compris zéro ; téléphone/visio exigent trajets nuls. Tous les instants proposés doivent être futurs et entièrement couverts, sans absence/conflit, avec mode proposé et souhait client confirmé compatibles. Aucune demande de changement non résolue. Les dates/mode/responsabilité convenus ne sont pas modifiés.

POST /partner/leads/:id/appointments/:appointmentId/time-protection, confirmation non cochée et empreinte des sources d'ouverture ; revalidation atomique session/membre/Lead/RDV/planning/profil/révisions. L'empreinte n'est pas un jeton de réservation. Version privée immuable,20dernières consultables, mêmes droits personnels. Réduction des durées explicite/historisée. Déclaration d'absence ultérieure ne libère pas les périodes ; le contrôle signale l'écart. Rejeu même clé/contenu sans duplication et projection actuelle après contrôle d'accès ; deux nouvelles confirmations sur même lecture ne gagnent pas ensemble.

0046 ajoute durées d'occupation et table de versions privées ; garde SQL des conflits impliquant un temps protégé, même N-1/concurrent, et immutabilité des versions. Anciennes lignes zéro supplémentaire = non renseigné, pas zéro préparation prouvé. Anciennes collisions sans temps protégé non réécrites. Audit privé sans Lead/fanout appointment.time_protected.v1 ; aucun Lead/horloge/notification/préférence/référent/examen/missingCheck changé. DTO publics RDV inchangés. Annulation/fin d'un RDV libère son occupation sans effacer ses preuves ; anciens transferts/clôtures peuvent annuler avec événement, code inchangé.

Contrôle sur intervalle étendu ; formulaire RHF/Zod, récapitulatif proposé, historique distinct, retry exact/relecture sur conflit. Cache privé/session/RDV supprimé à fermeture, erreur masque contenu antérieur. Aucune nouvelle audience.

Ces constats ne sont PAS une disponibilité réelle ou un créneau libre. Préparation effectuée, trajet réaliste, engagements externes, capacité globale, accord client détaillé et éligibilité complète restent non vérifiés. Créations anciennes encore possibles hors déclaration ; aucun matching/réservation déduit. Choix d'offre ≠ signature ; conventions ≠ solution distribuable/commission. S-130/S-131 et dérogation RLS héritée ouverts.

## Livraison et preuves

V0/V1 : types/lint API/Partner/Wallet/Admin et quatre builds verts ; frontières568modules/2517dépendances,0erreur/3orphelins www hérités ; Knip ciblé vert. Node24.13.1 sous engine24.20 ; warnings Wallet chunks/ApplicationPage hérités. Pas de paquet/variable/fournisseur/job/room nouveau.

V2 :59tests PostgreSQL/4fichiers sur code final :43hérités dans campagne63,94s puis16contrôle/protection finaux17,05s. Droits/sources/invariance/bornes/trajets/historique/rejeu/concurrence ; deux attentes réelles de verrou (API après engagement autre Lead ; SQL N-1 après protection commitée). Tests même agent/Testcontainers, détails au ledger.

**0046 générée/testée en PostgreSQL isolé, NON appliquée à la base locale partagée.** Génération suivante sans delta ;0044/0045 inchangées. Ne pas supposer la migration active sur les anciens runtimes. Activation migration→API/UI ; rollback conserve gardes/historique et lecteur comprenant occupations, correctif en avant. Aucune donnée réelle modifiée par9ff1.

Deux revues statiques même agent :1droits/rejeu/sources/SQL et ajout du test N-1 concurrent ;2UI/cache/retry/historique/erreurs. Libellé préconfirmation corrigé de « protégé » vers « proposé, à vérifier ». Aucune indépendance ou V3 rempli/clavier/mobile revendiquée.

## Prochaine action bornée

1. Restaurer tout le snapshot, contrôler HEAD/hashes/WIP/protections/session puis relire plan/journal avant mutation.
2. **Création personnelle avec préparation/trajets dès confirmation atomique** : auditer droits/durée/plages/absence/mode/souhait client/occupation, conditions externes/accord/capacité et compatibilité. Persister défauts/DoD puis implémenter le plus petit parcours cohérent, réutilisant contrôles/garde9ff1.
3. Ne pas promettre une disponibilité externe, calendrier libre ou éligibilité depuis l'approbation/24h/hors plages. Toute nouvelle audience exige projection minimale/contrat explicite. Un report exige parcours explicite conservant histoire/responsabilité/accord, jamais annulation silencieuse. Création personnelle puis report sont des frontières possibles, pas un retrait des autres exigences.
4. V0/V1/V2 proportionnés, migrations additives, deux revues et V3 selon accès réel. Préserver services/processus et données réelles. WorkOS absent limite V3, pas le travail indépendant.
5. Tous tracks conservés : disponibilités/modes/absences/capacité/conflits/matching/réservation, marketplace/accords/économie, statistiques/objectifs/qualité/enquête avec **branchement5étoiles exact demandé**/réclamations, canaux/transcription, vraie signature/acceptation compagnie. Après tranche : docs/preuves/state/vues, checkpoint court, snapshot COMPLET vérifié, exactement un relais Astra/ultra.

## Obstacles et tentatives

WorkOS : fichier configuré dans D:/Projects et trois valeurs requises toujours absents au contrôle booléen9ff1. Aucun callback4133/4136 refusé à retenter sans changement réel. Aucun runtime9ff1, session/grant/client réel fabriqué ni secret récupéré depuis un processus. Dernier comptage métier local connu908d :0membre/Lead/offre/déclaration/plage, trigger0044 présent ;9ff1 n'a pas recompté.

Tests9ff1 : DTO id/state refusés par entrée Zod stricte, montage corrigé. Verrou planning avant insertion sur même Lead causait40P01 ; montage corrigé vers deux Leads affectés, sans assouplir verrous/SQL. Test N-1 inverse vérifie fraîcheur après attente. Typage RHF/lint corrigés. Ne pas rejouer ces montages ; ordre applicatif inchangé.

Pnpm : node C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs, frozen-lockfile/ignore-scripts. API build depuis apps/api ; Vite via node node_modules/vite/bin/vite.js build depuis chaque app. Vitest config racine vitest.config.mjs. Helper9ff1 .planning-local/export-protected-time.mjs : lecture seulement dans le source. diff --no-index --check code1 sans sortie = différence normale.

## Coordination

Aucun sous-agent. Docker/API4100 et previews4101–4139 protégés ; b920 API4133/Wallet4134/Partner4135,8a00 API4136/Partner4137/Wallet4138 protégés, Admin4139 non lancé au dernier constat. cc1c/5944/ce17/6469/908d/f189/9ff1 n'ont lancé aucun runtime. Revalider ports avant tout usage ; ne pas arrêter/adopter anciens processus. Testcontainers9ff1 terminés par leur lifecycle.

Au create_thread : gel des écritures applicatives/state9ff1, attendre premier état réel puis lien. Si clientThreadId, retrouver threadId avant wait_threads sans deuxième création ; list_threads peut omettre les worktrees (constat source), ne pas fabriquer un ID. Aucun archivage. Ce checkpoint ne remplace pas le brief intégral ni le mandat.
