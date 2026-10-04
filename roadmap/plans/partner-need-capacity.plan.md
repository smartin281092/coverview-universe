# Décision personnelle de capacité pour un besoin — relais a9ba

## Questions et décisions déléguées avant code

`approval` : mandat intégral Partner I–III, « Recommence », PROG-23 et relais980f du 3 octobre 2026. Aucun nouveau GO. Une tranche verticale puis exactement un relais gpt-6-astra/ultra ; aucun sous-agent. Session requise gpt-6-astra/ultra ; réglage effectif, coût et remplissage du contexte non observables.

| Ref | Question | Réponse retenue et preuve |
| --- | --- | --- |
| NC1 | Quel acte humain ? | Apprécier personnellement sa capacité **pour ce Lead** : capacité confirmée personnellement, capacité insuffisante, ou éléments à clarifier. Choix et confirmation toujours vides, motif privé et échéance future choisis. Ce n'est ni acceptation/attribution du Lead, ni disponibilité réelle, ni validation de l'adéquation complète. I.10.3/12/18/20 ; propriétaire capacité. |
| NC2 | Audience ? | Même conseiller personnellement affecté que le bilan existant, aucune cible conseiller reçue. Admin doit être lui-même affecté, avec permission/MFA ; manager seul, Wallet et voisin refusés. Aucune audience nouvelle ni confirmation pour autrui. I.20/II.9. |
| NC3 | Portée/fraîcheur ? | Figer Lead, sujet canonique courant, révisions besoin/profil/professionnelle, mandat courant, préférences/référent/demande de changement, versions des sources capacité/disponibilités. Une empreinte serveur vérifiée sous verrou protège le formulaire. Changement ou aller-retour de ces sources → réexamen, jamais réactivation automatique ; validité demi-ouverte jusqu'à l'échéance choisie. Les compteurs restent des observations datées, sans seuil ni invalidation automatique à chaque nouveau dossier. |
| NC4 | Priorité client ? | Signaler le choix client et toute demande de changement ; une demande ouverte empêche une confirmation positive, sans empêcher une appréciation négative/à clarifier ou un retrait. Toute décision reste sans effet sur le choix client et tous les autres contrôles. Aucun accord/mandat/réservation implicite. |
| NC5 | Retrait/reconfirmation ? | Versions immuables par conseiller/Lead, retrait explicite sans position/échéance, historique paginé20 limité au sujet courant. Nouvelle décision pour reconfirmer. Droits actuels exigés à la lecture, l'écriture et au rejeu ; perte de mandat ne donne aucun accès résiduel à ce dossier. |
| NC6 | Migration et protection du journal ? | Les100fichiers entrants Drizzle, **journal compris**, restent byte-for-byte. Préparer une migration additive0049 hors catalogue dans `apps/api/drizzle-pending/0049_partner_need_capacity/`, générée offline depuis une copie locale du catalogue. La tester avec un catalogue temporaire complet, deux applications Drizzle en PostgreSQL isolé. Inscription future dans le catalogue explicitement nécessaire avant activation ; ne pas prétendre que `db:migrate` l'applique aujourd'hui. Aucune migration sur base partagée. Cette contrainte explicite du relais prime l'append usuel du journal. |

## Objectif et parcours

Fiche Lead → Mon adéquation → Examiner ma capacité → Décider pour ce besoin, dans une vue remplaçante du dialogue. Besoin, parties courantes, sources globales et liens de travail datés précèdent une appréciation humaine distincte. Consultation, décision, retrait, historique et réessai cohérents. Aucun choix positif prérempli, même lors d'une reconfirmation.

Nouveau GET/POST personnel `/partner/leads/:id/capacity-decision`, contrats Zod/client partagés et persistance dédiée. Le bilan v1/v2 reste inchangé et ne lit pas0049 ; les six contrôles restent ouverts dans ces contrats, sans prétendre à une éligibilité. Le nouveau dossier indique expressément la portée de la décision privée. Bilans référent, Wallet, détails partagés et supervision générale ne reçoivent ni décision ni motif.

## Audit et mise en œuvre

Lecture de AGENTS/CLAUDE/PROJECT/MEMORY actives/codex/execution-policy, brief intégral I–III, coverage, plan/journaux pertinents et ledger, index produit ; propriétaires API/Partner/Wallet Offres/Admin/UI, bilans/capacité/préférences/pratique/disponibilité/modes partagés/portée/compétence/conventions/référents. Satellites program/architecture/conventions/backend/API/contracts/data/auth/permissions/security/events/evolution/frontend/design/brand/i18n/testing/environment/documentation/memory/delivery. Marketing, fournisseurs et droit hors de cette tranche.

Le repository possède déjà l'autorisation personnelle, les gardes acteur/session/membre/organisation/Lead/profil et la transaction idempotente. Réutiliser cette frontière, sans doublon de règles d'accès. Les lecteurs de sources sont propriétaires. GET repeatable read pour un bilan daté ; mutation read committed avec verrous et comparaison de l'empreinte, date serveur après acquisition des verrous. Sérialisation du conseiller/Lead ; auteur, preuve et audit privé atomiques. Rejeu retourne le dossier autorisé courant, aucune ancienne décision réactivée.

Table dédiée avec FK canoniques, unicité conseiller/Lead/révision, contraintes sur action/position/échéance et version/empreinte. Pas de journal détourné en stockage métier. Aucune modification du Lead, horloge, rendez-vous, tâche, préférence, attribution ou notification. Audit privé minimal sans motif dans le texte, aucun job/room/fournisseur/paquet/variable nouveau. RLS et rétention/export/effacement S-130/S-131 restent ouverts.

UI RHF/Zod et primitives existantes ; révisions/empreinte d'ouverture et première commande/clé figées, relecture10s/manuelle, cache user/session/Lead gcTime0, erreur masque les anciennes données ; formulaire bloqué après conflit, réessai identique après réponse incertaine. Dates UTC, saisie Europe/Zurich refusant heures inexistantes/ambiguës. Motif court sans données sensibles inutiles.

## Oracles et limites

- V0 : types API/Partner/Wallet/Admin et lint ciblé ; V1 builds quatre apps, frontières/Knip, génération sans delta dans le catalogue temporaire.
- V2 PostgreSQL Testcontainers : trois positions, retrait, expiration/reconfirmation, absence de prévalidation implicite, droits actuels/rejeu/session/MFA, suspension/révocation/propriétaire, aller-retour des portées, demande client, multi-Leads et isolation des motifs, concurrence révision/clé et attente réelle de verrou, rollback preuve/audit/commande, contraintes SQL, pagination, compatibilité v1/v2 sans0049 et absence d'effets métier.
- Deux revues statiques du même agent, aucune indépendance revendiquée. V3 rempli/clavier/mobile non disponible sans nouvel accès WorkOS ; aucun callback4133/4136 ou montage invalidé retenté, aucune session/grant/client réel fabriqué.

Budget : une tranche avant relais ; si obstacle, conserver l'état exact et le prochain travail borné. Restauration608fichiers/39682608octets vérifiée avant code, HEAD4fef49a095739260b9ab9d1becc1a2bf3320a928. Quatre fichiers protégés/lockfile/100Drizzle inchangés. Anciens worktrees et services4100–4139 intacts. Aucun commit global WIP/push/deploy/fork/archive/stash/reset/clean.

## Suite et journal

Après preuves : propriétaires/coverage/mémoire, S-110.notes seulement et vues générées ; checkpoint8sections<12000caractères, snapshot cumulatif complet audité indépendamment, list_projects puis un seul create_thread Astra/ultra dans worktree neuf ; gel source dès dispatch, premier état réel, lien et arrêt des écritures. Tous les tracks du brief demeurent mandatés : conflits/matching/créneaux/réservation/multi-Leads, marketplace/accords/économie, statistiques/objectifs/qualité/enquête branche EXACTE5étoiles/réclamations, canaux/transcriptions, signature réelle/acceptation compagnie. Brief/S-110/S-042a non clos.

## Journal de vérification a9ba

Plan persisté avant code. V0 types/lint ciblé et V1 builds quatre apps verts. Frontières585modules/2648dépendances0erreur ; Knip quatre workspaces vert, global en échec sur5fichiers inutilisés et alias exports hérités. V2 :93tests distincts/4fichiers en campagnes séparées, dont15nouveaux finaux en22,59s ;37bilans+9capacité et32repository passent. Catalogue complet temporaire avec0049 appliqué deux fois ; génération suivante sans delta. Commandes et tentatives exactes au [ledger](../evidence/partner-core.md#relais-a9ba--décision-personnelle-de-capacité-par-besoin).

Revue1 du même agent : sécurité/persistance/portée/compatibilité, date serveur de rejeu déplacée après verrou profil ; attente réelle avec expiration testée. Revue2 : UI/cache/erreurs/i18n/focus, date future sur nouvelle commande seulement afin de conserver le réessai exact ; motif courant visible. Aucune indépendance revendiquée. V3 rempli/clavier/mobile non effectué, aucun nouvel accès WorkOS ; aucun runtime ni service antérieur touché. Activation0049 reste bloquée par protection intégrale du catalogue, documentée dans le propriétaire ; le `db:migrate` normal ne l'applique pas. Aucun bug corrigé hors périmètre.

## Brouillon de tranche suivante, non exécutée

Session recommandée gpt-6-astra/ultra. Objectif : examen personnel explicite des conflits bloquants pour un besoin (I.10.3), sans confondre chevauchement d'agenda et conflit d'intérêts ou prétendre certifier la conformité. Après lecture complète des sources, persister un plan décidant positions/sens, audience privée actuelle, information minimale, portée/fraîcheur, retrait/historique, réessai et garde au changement client. Aucun droit ou classement automatique, aucune exposition des motifs au client/manager, aucune règle juridique inventée. Consulter sources officielles si la tranche propose une règle juridique plutôt qu'une déclaration de fait humaine. Auditer d'abord les lecteurs/contrats et réutiliser les frontières existantes, sans modifier les bilans historiques ni les100fichiers Drizzle protégés. Une nouvelle persistance éventuelle reste préparée hors catalogue tant que cette protection n'est pas explicitement levée ; reprendre la chaîne de snapshots pending pour éviter de régénérer0049 en doublon. Oracles : V0/V1, PostgreSQL réel pour portée/droits/concurrence/rejeu/rollback/absence d'effets, V3 seulement avec accès réel fourni. Puis même relais unique et mandat intégral conservé ; aucune clôture du programme.
