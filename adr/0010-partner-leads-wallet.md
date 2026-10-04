# ADR-0010 — Leads Partner et dossier Wallet commun

Statut : adopté pour l'implémentation du brief utilisateur consolidé du 2 octobre 2026 ; autorisation d'exécution suivant PROG-23. Validation de production distincte.

## Contexte

Le brief distingue le client, le Lead, l'offre et le contrat. Le dépôt possède déjà l'identité WorkOS, les profils personnels/gérés, des originaux privés et des demandes d'assurance. La création d'un CRM séparé ferait diverger les personnes, leurs accès et leurs documents.

## Décision

`partner-workspace` est propriétaire des candidatures professionnelles, habilitations Partner, Leads, tâches, rendez-vous, offres versionnées et de leur journal. `profiles` et `identity` conservent les clients canoniques ; `document-intelligence` conserve les originaux. Partner, Admin et Wallet consomment des projections HTTP du même Lead, avec contrats Zod partagés. Une offre n'est pas une police en vigueur.

L'administrateur existant conserve son contrôle nominatif et son MFA. Le nouveau rôle de conseiller exige une validation distincte de l'utilisateur et de son organisation, puis une affectation explicite. Le responsable d'organisation est un rôle explicitement accordé. L'apporteur possède une projection de progression ; sa contribution ne lui donne pas accès aux pièces du conseil. L'accès Wallet suit le propriétaire actuel du profil géré. Aucune recherche publique d'email, fusion par ménage ou attribution collective implicite.

Les mutations sensibles verrouillent la session, l'habilitation et le Lead, vérifient sa révision et utilisent une clé idempotente. Un rejeu reconstruit sa réponse avec les droits actuels. Les documents publiés sont téléchargés par une route qui recontrôle l'accès avant et après leur lecture privée. Leur rétention empêche une suppression ordinaire de casser la preuve ; une procédure d'effacement réglementaire reste à construire.

## Alternatives et conséquences

Une table Client autonome et une copie des PDF dans Partner ont été écartées : elles dupliqueraient les identités et le contrôle des accès. Un rôle organisationnel implicite serait contraire au brief. Les ajouts sont des tables additives et des sous-chemins de contrats ; les clients existants continuent à fonctionner.

Les prises de décision Wallet sont persistées. Elles ne simulent pas une signature ou une acceptation d'assureur. Le premier parcours rafraîchit les lectures toutes les 10–15 secondes ; des notifications de service internes atomiques et un scheduler de continuité sont désormais raccordés. Aucun outbox externe, email/SMS ni diffusion immédiate revendiqués. La réattribution automatique à un conseiller attend le matching complet ; la reprise humaine est bornée. Règles et exploitation : README propriétaire.

## Migration et reprise

Migrations 0027 et 0028 après les migrations existantes ; aucun reset. Le rollback applicatif conserve les tables et les fichiers retenus. La source initiale, les offres remplacées et les décisions restent conservées. État de couverture et oracles : [ledger](../roadmap/evidence/partner-core.md), [plan](../roadmap/plans/partner-core.plan.md).
