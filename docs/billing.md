# Facturation et abonnements (Stripe)

> **Résumé** : Stripe pilote paiements et cycle de vie ; la base locale n'en tient qu'une projection, synchronisée exclusivement par webhooks signés et idempotents — jamais par la redirection de retour. Aucun montant ni privilège décidé côté client ; les entitlements dérivent de l'état d'abonnement et se vérifient côté serveur.

## BILL-01 — Répartition des vérités

Stripe est l'autorité du cycle de paiement (statuts d'abonnement, factures, échecs). La base locale (G-09) en tient une **projection** : `billing_customers` (tenant ↔ `stripe_customer_id`) et `subscriptions` (`stripe_subscription_id`, statut, plan, période, `cancel_at_period_end`). La logique applicative lit la projection locale — jamais l'API Stripe dans un chemin critique.

## BILL-02 — Synchronisation par webhooks uniquement

La projection se met à jour **exclusivement** via les webhooks (`checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`…). Chaque webhook : signature et tolérance d'horodatage vérifiées (SEC-05), idempotence par `event.id` (API-04), réponse rapide, traitement en queue (JOB-01). Les événements pouvant arriver dans le désordre : ne jamais écraser un état plus récent depuis un payload plus ancien — recharger l'objet courant depuis l'API Stripe ou comparer les horodatages avant d'appliquer.

## BILL-03 — La redirection ne prouve rien

La page de retour (`success_url`) n'est PAS une confirmation de paiement. Afficher « en attente de confirmation » tant que le webhook n'a pas mis la projection à jour ; l'UI se rafraîchit via l'API ou le temps réel.

## BILL-04 — Aucun montant côté client

Le client n'envoie que des identifiants de prix (price IDs / lookup keys) validés côté serveur contre le catalogue autorisé — défini par `packages/catalog` (`catalog.md`), jamais par une liste écrite dans le module. Prix, remises, essais, taxes : définis dans Stripe. Toute somme stockée localement suit DATA-11 (entiers en unité mineure + devise).

## BILL-05 — Entitlements dérivés (PERM-09)

Statut d'abonnement → entitlements du tenant, recalculés au webhook, vérifiés côté serveur à chaque usage. `past_due` : période de grâce définie et documentée ; annulation : fin d'accès en fin de période sauf règle contraire. Les entitlements accordés par chaque plan viennent du catalogue (CAT-04), qui en est la source unique. Grâce, blocage et relances (dunning) sont documentés dans le module billing (DOC-11).

## BILL-06 — Cycle de vie et changements de plan

Essai, upgrade/downgrade : déléguer la proration à Stripe (`proration_behavior`) — jamais de recalcul maison. Tarification par siège : la quantité suit les membres actifs de l'organisation, mise à jour par le backend, jamais par le client.

## BILL-07 — Hébergé d'abord (vitesse solo)

Défaut : Stripe Checkout (paiement) + Customer Portal (moyens de paiement, factures, annulation). Une UI de facturation maison ne se construit que sur besoin réel (ARCH-04). Aucune donnée de carte ne transite ni n'est stockée chez nous — Checkout/Elements uniquement (périmètre PCI minimal).

## BILL-08 — Taxes et factures

Stripe Tax activé par défaut ; adresse de facturation collectée par Checkout ; factures émises et numérotées par Stripe. L'app expose les factures via la projection et le Customer Portal.

## BILL-09 — Actions sensibles auditées

Remboursements, extensions d'essai, comptes offerts : actions admin explicites et auditées (SEC-07) — jamais automatiques sans règle documentée.

## BILL-10 — Environnements et tests

Clés test/live strictement séparées par environnement (SEC-03). En local : Stripe CLI (`stripe listen`) pour relayer les webhooks ; test clocks pour simuler les cycles ; cartes de test uniquement. Le module billing relève de TEST-01 : transitions d'état, idempotence des webhooks, calculs d'accès.
