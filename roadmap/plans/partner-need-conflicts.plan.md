# Examen personnel des conflits par besoin — relais e88b

## Décisions déléguées avant code

`approval` : brief intégral I–III du2octobre2026, « Recommence », PROG-23, mandat du relais a9ba. Aucun nouveau GO ; aucun sous-agent. Session demandée gpt-6-astra/ultra, réglage effectif/coût/contexte non observables. Budget : une tranche verticale cohérente, puis exactement un relais Astra/ultra neuf avec le mandat intégral. Brief/S-110/S-042a restent ouverts.

| Ref | Question | Décision et source |
| --- | --- | --- |
| CF1 | Que signifie l'examen ? | Déclaration humaine personnelle pour un Lead : conflit bloquant déclaré, aucun conflit bloquant identifié dans le périmètre examiné, ou éléments à clarifier. Absence de déclaration, retrait, expiration et portée modifiée restent inconnus ; aucune détection exhaustive, certification juridique, décision d'habilitation ou disponibilité déduite. I.10.3/18/20. Aucune règle juridique nouvelle formulée ; un examen juridique ultérieur demandera ses sources officielles. |
| CF2 | Quelles informations ? | Périmètre examiné explicite10–500caractères, motif/suite minimale10–1000, échéance future choisie et confirmation vide. Aucune identité de tiers, détail confidentiel ni pièce exigés. La position négative décrit un obstacle personnel ; elle ne réattribue ni n'arrête automatiquement le Lead. Le texte rappelle de traiter séparément toute mesure nécessaire. |
| CF3 | Audience ? | Garde personnelle existante du bilan : responsable/contributeur de conseil actuellement autorisé ; Admin lui-même affecté avec permission/MFA. Aucun advisorId reçu, aucun accès manager/voisin/Wallet ni supervision des motifs d'autrui. Perte de mandat interdit aussi historique/retrait/rejeu. I.20/II.9. |
| CF4 | Portée et fraîcheur ? | Empreinte serveur du sujet canonique/propriétaire, besoin/révision, profil/révision, membre/organisation/révision professionnelle et d'habilitation, mandat courant, préférences/référent/demande client. Révisions monotones contre aller-retour. Pas de capacité ni de chevauchement d'agenda utilisés pour conclure à un conflit. Le périmètre humain précise ce qui a réellement été examiné ; les faits externes non connus du système restent à réexaminer par le conseiller. |
| CF5 | Priorité client et révision ? | Demande de changement ouverte bloque la déclaration d'absence, sans empêcher conflit/clarification/retrait. Versions immuables, retrait motivé sans position/périmètre/échéance, reconfirmation entièrement vide et historique20 limité au sujet canonique courant. Expiration sans écriture ; aucun retour à une ancienne déclaration. I.10.2/20. |
| CF6 | Cohérence et compatibilité ? | GET/POST séparés `conflict-review`, transaction/rejeu actuel et verrou personnel/Lead/profil réutilisés ; instant après verrou pour mutation/rejeu. Audit/version/commande atomiques. Les bilans v1/v2 et leurs six remainingChecks restent inchangés ; aucune dépendance de leurs lectures à la nouvelle table. Les sources communes de portée seront extraites sans changer l'empreinte de capacité. |
| CF7 | Migration ? | Nouvelle0050 hors catalogue ; copie temporaire des100fichiers Drizzle plus SQL/snapshot/entry0049 avant génération. Aucun ajout silencieux au journal protégé, aucun delta de0049 recréé. Test isolé deux applications et génération suivante sans delta. Activation non livrée : intégration future autorisée du catalogue, migrations puis API/UI et V3 réelles nécessaires. |

## Objectif et parcours

Fiche Lead → Mon adéquation → Examiner mes conflits → lecture privée, formulaire explicite, retrait et historique dans des vues remplaçantes du même dialogue. Trois positions au même niveau, aucun positif présélectionné, informations minimales et limites lisibles. Distinguer fraîcheur du contexte et validité de la déclaration, aucune compétence/convention/capacité/qualité levée.

## Audit et périmètre

Restauration intégrale vérifiée avant code :617fichiers/40190873octets, arbre1656fichiers, porcelain-v1-z et HEAD4fef49a095739260b9ab9d1becc1a2bf3320a928 ; source a9ba inchangée.108protections : quatre fichiers frontaux, lockfile,100Drizzle et3pending0049. Aucun ancien worktree/service touché.

Sources lues : AGENTS/CLAUDE/PROJECT/MEMORY actives/codex/execution-policy ; brief I–III intégral, coverage, plan/journaux pertinents/ledger, index produit ; README API/Partner/Wallet Offres/Admin/UI et propriétaires capacité/bilans/référent/préférences/pratique/modes/disponibilité/portée/compétence/conventions. Satellites program/architecture/conventions/backend/API/contracts/data/auth/permissions/security/events/evolution/frontend/design/brand/i18n/testing/environment/documentation/memory/delivery. Exclusions : marketing, nouveaux fournisseurs, règles juridiques.

`personalAdvisorLead` centralise les droits. `transaction` verrouille acteur/session, déduplique les commandes et reprojette l'état courant. `readAdvicePreferences` garde le sujet canonique ; réutiliser ce verrou avant clock_timestamp. Le bilan de capacité possède déjà un calcul de portée : extraire les sources communes pour deux consommateurs réels, sans partager leurs états métier ni ajouter d'audience. Routes dans index.ts, contrats/client partagés, nouveau fichier métier et table dédiée ; aucune dépendance ajoutée.

## Oracles

- V0 types/lint ciblé ; V1 builds API/Partner/Wallet/Admin, frontières/Knip ciblé, SQL généré et seconde génération sans delta.
- V2 PostgreSQL18 Testcontainers exclusivement : transitions/expiration/reconfirmation/retrait, portée aller-retour/propriétaire/sujet, client prioritaire, multi-Leads/audiences, droits et rejeu actuels, concurrence de révisions/clés et attente réelle de verrou, contraintes SQL/rollback atomique, aucune fuite ni effet sur Lead/horloges/RDV/tâches/notifications/capacité, anciens bilans sans0050. Régression capacité après extraction du contexte.
- Deux revues statiques du même agent, aucune indépendance revendiquée. V3 rempli/clavier/mobile reste non effectué sans nouvel accès WorkOS ; aucun callback4133/4136 ni montage invalidé retenté, aucune session/grant/client réel fabriqué.

## Risques, exploitation et suite

Confusion entre déclaration et conformité → libellés bornés au périmètre humain et autres contrôles conservés. Détails de tiers → aide à la minimisation, audience privée, aucun texte dans audit partagé. RLS héritée et rétention/export/effacement S-130/S-131 restent ouverts, aucune durée juridique inventée. Aucun job/room/notification/fournisseur/variable nouveau. Aucun commit global WIP/push/deploy/fork/archive/stash/reset/clean.

Après vérification : propriétaire/plan/ledger/coverage/mémoire, S-110.notes seulement puis vues générées, checkpoint8sections<12000, snapshot cumulatif complet audité séparément ; list_projects et exactement un create_thread Astra/ultra neuf, gel de la source au dispatch, résolution sans doublon et premier état réel. Tous tracks I–III demeurent mandatés : matching/créneaux/réservation/multi-Leads, marketplace/accords/économie, statistiques/objectifs/qualité/enquête branche EXACTE5étoiles, réclamations, canaux/transcriptions, signature réelle/acceptation compagnie.

## Journal de vérification

Plan persisté avant code. Oracles et résultats à consigner au ledger ; aucune activation revendiquée.

V0/V1 types/lint/builds quatre apps, frontières589modules/2680dépendances0erreur, Knip ciblé verts.99tests distincts en deux campagnes :30conflits/capacité en52,73s puis69bilans/repository en56,66s ; PostgreSQL18 isolé, migrations complètes temporaires deux fois.0050seule générée puis aucun delta. [Commandes et tentatives](../evidence/partner-core.md#relais-e88b--examen-personnel-des-conflits-par-besoin).

Revue1 : droits/SQL/portée/rejeu/date/compatibilité et extraction du contexte comparée à a9ba. Revue2 : UI/cache/i18n/focus/reprise ; commande et refus4xx déplacés au niveau du panneau pour survivre à une erreur GET masquante, Partner types/lint/build repassés. Même agent, aucune indépendance. V3 rempli/clavier/mobile non effectué, reprise UI sans preuve navigateur. Activation0050 hors catalogue non livrée ; protections intégrales conservées. Aucun autre parcours réécrit.

Contrôles documentaires :251vues/122slices/694critères/2115unités, génération/check/verify et lint-référentiel948fichiers/423règles verts. Checkpoint11561caractères validé check/prompt après réduction. Audit indépendant :617entrants conservés,627statuts/arbre1666,108protections entrantes et111à transmettre ; source a9ba inchangée, seul S-110.notes ajouté, statuts inchangés. Snapshot complet et second contrôle obligatoires avant dispatch ; hashes/comptes au prompt suivant.

## Brouillon de tranche suivante, non exécutée

Session recommandée gpt-6-astra/ultra. Objectif : examiner personnellement l’expertise précise nécessaire pour un besoin (I.10.3/18/20), avec appui sur les preuves professionnelles et les inconnues existantes. Auditer d’abord compétence, catégorie, formation/preuves/sources, portefeuille/conventions, bilans et audiences. Persister un plan décidant le sens des positions humaines, la provenance et la fraîcheur des sources, le périmètre précis déclaré, les droits actuels, la minimisation, le retrait/historique et les effets réellement attendus. Ne pas confondre compétence documentée générale, auto-évaluation précise, habilitation réglementaire et solution distribuable. Aucune certification juridique ou adéquation totale, aucun positif prérempli, classement/attribution automatique ou autre contrôle levé. Réutiliser les frontières existantes ; éviter un simple duplicata de formulaires sans utilité démontrée. Oracles V0/V1 et PostgreSQL pour état/droits/portée/concurrence/rejeu/rollback/compatibilité/absence d’effets ; V3 uniquement avec accès réel. Si nouvelle persistance nécessaire, catalogue temporaire avec0049 ET0050 avant génération, nouveaux artefacts hors catalogue protégé. Puis même relais unique et TOUS tracks I–III, sans clôture du programme.
