# Annulation d’un rendez-vous depuis Wallet

Propriétaire : partner-workspace, brief I.12, décisions déléguées WAC1–5 du 3 octobre 2026. [Plan et journal](../../../../../../roadmap/plans/partner-wallet-cancellation.plan.md), [preuves et limites](../../../../../../roadmap/evidence/partner-core.md#relais-1bc1--annulation-explicite-depuis-wallet).

## Parcours et autorité

Wallet → Offres → demande → Mes rendez-vous → Consulter → Annuler. La liste présente les 100 rendez-vous les plus récents de la demande d’origine ; limite signalée. Le détail montre date, durée, mode, lieu, fuseau de Zurich, conseiller et état. Motif de 2 à 1 000 caractères et confirmation non précochée de l’annulation de l’engagement entier, y compris les demandes associées. Après succès, l’état annulé est visible et le retour retrouve la demande actualisée.

**partner.wallet-cancellation.1** — Seul le propriétaire Wallet canonique courant de la demande d’origine peut annuler un rendez-vous programmé dont le début est encore futur, sur une demande ouverte. Profil géré et sujet personnel utilisent leur propriétaire/révision actuels. Ni conseiller ni Admin ne peuvent agir à sa place par ce use case. L’autorisation ne dépend pas d’une nouvelle éligibilité professionnelle : le client peut renoncer à un engagement existant. La consultation d’une liaison ne donne aucun droit sur l’origine et aucune action d’annulation supplémentaire.

GET et POST `/wallet/leads/:id/appointments/:appointmentId/cancellation` utilisent les frontières host/origine/CSRF/session et débit existantes. Contrats Zod stricts ; POST contient seulement empreinte, motif et confirmation vraie. DTO minimal sans identifiant du conseiller, autre Lead, profil interne, buffers, occupation ni preuve privée. L’ancienne commande professionnelle `appointment_state` n’est pas ouverte à Wallet.

## Effets et conservation

**partner.wallet-cancellation.2** — Le même rendez-vous passe à `cancelled`. Modalités, conseiller, temps de préparation/trajets et preuves restent conservés. Il disparaît des engagements programmés de l’agenda et libère son intervalle entier ; la garde SQL0046 continue à protéger les autres engagements. Les [liaisons](appointment-links.md) applicables montrent son issue annulée, sans écriture sur leurs versions ou les demandes associées.

L’origine revient de `appointment_scheduled` à `appointment_needed` seulement en l’absence d’un autre rendez-vous programmé futur. Si son action est encore exactement « Tenir le rendez-vous convenu », son échéance égale le début annulé et aucune attente n’existe, elle devient « Recontacter le client pour convenir de la suite » et son échéance est avancée à maintenant au plus tard. Action personnalisée, autre échéance, attente, tâches, première action utile, attribution et cycle restent conservés. Aucune offre, économie ou clôture implicite ; aucune propagation sur les autres demandes.

L’événement client `client.appointment_cancelled.v1`, sujet exact du rendez-vous et motif partagé avec les professionnels autorisés, produit une réponse client à traiter par le responsable courant ou CoverView si non attribuée. Le conseiller du rendez-vous reçoit une information supplémentaire seulement s’il est distinct et dispose encore d’un accès conseil courant. Les lectures de notifications revérifient leurs droits. Lire ne résout pas la réponse ; contact utile ou clôture suivent le mécanisme acquis. Aucun email/SMS n’est prétendu envoyé.

## Concurrence et preuve

**partner.wallet-cancellation.3** — Transaction unique : acteur/session, Lead, rendez-vous, planning du conseiller, profil canonique. Relecture du propriétaire et de sa révision, de la session et de l’heure après les attentes. L’empreinte lie acteur, sujet, révisions du Lead/profil et modalités exactes avec la révision monotone0055. Un report suivi d’un retour exact ou un relink ne réutilise pas un ancien récapitulatif. L’empreinte ne certifie aucune éligibilité globale.

Même clé/contenu : projection actuelle après nouvelle autorisation, sans nouvelle annulation ni notification. Clé réutilisée avec un autre contenu : refus. Une deuxième annulation avec une autre clé ou une révision devenue obsolète échoue. Une panne d’événement privé, d’événement client ou de notification annule aussi le changement d’état, le suivi et la commande.

La preuve privée `appointment.wallet_cancellation_recorded.v1` conserve l’auteur, le rendez-vous, le sujet/propriétaire/révision du profil, la révision du Lead et les modalités/révision/empreinte confirmées. Elle est enregistrée dans le journal existant sans `lead_id`, hors timeline publique ; le motif reste dans l’événement client. Pas de nouvelle table, permission, dépendance, job, room ou fournisseur. Les durées privées restent dans leurs preuves propriétaires.

## Interface, activation et limites

La liste puis le détail/formulaire remplacent la fiche Wallet dans un seul dialogue. RHF/Zod, i18n et primitives existantes ; cache privé utilisateur/session/Lead, gcTime0, relecture10s, relecture manuelle et masquage sur erreur ou refus d’accès. La première commande et sa clé restent figées après résultat incertain, même si un GET échoue ; seul le même envoi est réessayé. Refus définitif impose une nouvelle lecture. Les contrôles serveur restent autoritaires.

La requête lit explicitement `link_terms_revision` : dépendance à0055, toujours hors catalogue avec0049–0054. Aucune0056. Les126protections et69tests/specs entrants restent inchangés. Catalogue temporaire complet migré deux fois dans PostgreSQL18 Testcontainers ; aucune lecture/décompte/migration partagée.0046–0048 restent non appliquées à la base partagée. Intégration autorisée du catalogue puis migrations→API→UI avant activation ; rollback ferme ces entrées/routes, conserve les rendez-vous annulés, leurs preuves et les gardes.

V0–V2 vérifiés ; deux revues statiques du même agent, sans indépendance. V3 rempli/clavier/mobile non effectué faute de nouvel accès WorkOS ; activation non livrée. RLS/S-130/S-131 ouverts. Créneaux proposés/réservation Wallet/multi-spécialistes, adéquation/distribution, marketplace/économie, qualité et tous tracks I–III restent mandatés. Le brief, S-110 et S-042a restent ouverts.
