# Diffusion immédiate Partner ↔ Wallet

C6a du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief III.16 et I.12 (« une modification doit être répercutée dans Wallet et Partner »).

Une modification enregistrée dans un dossier apparaît sans attendre le rafraîchissement périodique, chez chaque personne qui peut la lire. Le flux ne transporte jamais le contenu du dossier : il dit seulement qu'il faut relire, et chaque client relit par l'API avec ses propres droits (RT-16, G-09).

## Transport et chemin d'un événement

- **SSE** (RT-01) : le flux est unidirectionnel et sert à invalider des caches. Routes `GET /partner/live` et `GET /wallet/live`.
- Une commande valide sa transaction. Deux déclencheurs de la migration `0072_partner_live_notify` émettent alors un `pg_notify` sur le canal `partner_live` :
  - un événement de dossier (`partner_events`) avec un Lead : `{ lead, audience }` ;
  - une notification créée ou modifiée (`partner_notifications`) : `{ notification, recipient, audience }`.
- PostgreSQL ne délivre ces avis qu'après validation, et fusionne les avis identiques d'une même transaction. Une transaction annulée n'émet rien.
- Chaque instance d'API garde une connexion `LISTEN` et un hub en mémoire (`partner.live.ts`). Plusieurs instances reçoivent chacune tous les avis et servent leurs propres flux. Aucun broker n'est ajouté (ARCH-04).

## Politique d'exposition par type d'événement (RT-08)

Le producteur ne choisit pas l'audience (RT-10). Le hub la décide connexion par connexion, au moment de l'envoi.

| Événement public | Contenu | Reçu par |
|---|---|---|
| `lead.changed.v1` | `{ leadId, at }` | Toute connexion qui voit le Lead **maintenant** (`visible(actor)` recalculé à chaque envoi, RT-07), selon l'audience de l'événement source : `client` pour tous ces lecteurs, Wallet compris ; `assigned` pour les professionnels seulement ; `coverview` pour les administrateurs seulement ; `private` pour personne. C'est la règle de lecture de l'activité du dossier. |
| `notifications.changed.v1` | `{ at }` | Le destinataire de la notification, sur la surface correspondante (Partner pour `partner`, Wallet pour `wallet`), ou les administrateurs pour l'audience `coverview`. |

- Les avis d'un même Lead sont regroupés sur 250 ms.
- Les contrats sont dans `@coverview/contracts/partner-live` : minimaux et versionnés (RT-09).
- Chaque flux numérote ses événements (`id:`).
- Un lecteur qui ouvre plusieurs onglets ne déclenche qu'une vérification de visibilité par changement.

## Connexion, limites et révocation

- **Ouverture.**
  - Seule l'application de la surface peut ouvrir un flux : origine Wallet pour `/wallet/live`, origine Partner pour `/partner/live`, sinon 403.
  - Contrôle d'hôte et session comme toutes les routes Partner (RT-05). Un administrateur passe par la MFA, et l'ouverture est auditée.
- **Limites (RT-18).**
  - 4 flux par personne et par surface, 256 par surface et par instance. Au-delà : `PARTNER_RATE_LIMITED` (429).
  - Les propriétaires Wallet n'occupent jamais la capacité des professionnels.
  - Le Wallet n'ouvre son flux que sur les pages qui montrent ses demandes (Offres, notifications de demandes).
- **Révocation (RT-11).**
  - La visibilité est recalculée à chaque envoi : un accès retiré cesse immédiatement de recevoir les avis du Lead.
  - La session est revérifiée chaque minute, sans nouvelle entrée d'audit d'administration. Une session révoquée, expirée ou remplacée ferme le flux dans la minute.
  - Entre-temps, un tel flux ne peut apprendre que l'identifiant d'un Lead qu'il voit encore.
- **Délais.**
  - Battement toutes les 25 secondes, et le délai d'inactivité de 10 secondes du serveur est désactivé pour le flux seul.
  - À l'arrêt de l'API, les flux se ferment avant l'attente des requêtes en cours (`preClose`).

## Reconnexion et resynchronisation (RT-14, RT-15)

- Le navigateur se reconnecte seul (`retry: 5000`). Aucun événement n'est rejoué : à chaque reconnexion, Partner et Wallet invalident toutes leurs requêtes de session et relisent l'état par l'API.
- Si l'API perd sa connexion `LISTEN`, elle se réabonne toutes les 5 secondes. Elle ferme alors tous ses flux, pour que chaque navigateur se reconnecte et relise ce qui a pu être manqué.
- Le rafraîchissement périodique existant reste le filet de sécurité.

## Clients

- **Partner** (`features/use-live-updates.ts`, ouvert dans la session Partner).
  - Un Lead changé invalide les requêtes de session qui portent son identifiant, ainsi que les listes, l'agenda (`work`) et le tableau de bord.
  - Un changement de notifications invalide le centre de notifications.
- **Wallet** (`features/offers/use-live-updates.ts`) : les demandes (`wallet-leads`) et les notifications de demandes (`lead-notifications`).

## Déploiement

Le proxy ne doit pas mettre en tampon `text/event-stream`. Caddy le transmet sans tampon. L'API envoie aussi `x-accel-buffering: no` et `cache-control: no-cache, no-transform`.

## Preuves et limites

- Test PostgreSQL `platform/partner-live.test.ts` :
  - rien avant validation ;
  - audience et visibilité ;
  - fusion d'une transaction ;
  - notifications par destinataire ;
  - plafonds par personne et par surface ;
  - fermeture à la fin de session ;
  - réabonnement après perte de la connexion, avec resynchronisation ;
  - flux HTTP réel : origine, hôte, session, en-têtes SSE et CORS, et maintien au-delà de 10 secondes de silence.
- Limites :
  - pas de reprise par `Last-Event-ID`, la resynchronisation complète la remplace ;
  - les événements privés sans Lead (protection du temps, liens de rendez-vous) n'émettent rien ;
  - le parcours navigateur avec de vrais comptes WorkOS relève de la recette (phase B).
