# Emails transactionnels

> **Résumé** : tout envoi passe par la queue derrière un adapter (Mailpit en local), avec templates versionnés et i18n, délivrabilité configurée (SPF/DKIM/DMARC, sous-domaine dédié), anti-énumération alignée sur l'auth, gestion des bounces, et séparation stricte transactionnel / marketing.

## MAIL-01 — Toujours asynchrone

Jamais d'envoi dans le chemin d'une requête : job en queue (JOB-01) à identité déterministe (`email:verification:{userId}`…) et idempotent (JOB-02) — un retry ne renvoie pas deux fois un email critique.

## MAIL-02 — Adapter fournisseur (PAT-12)

Une interface `Mailer` unique ; Mailpit en local via SMTP, fournisseur réel en production (défaut : Resend) — même code partout, jamais de branche `if dev`.

## MAIL-03 — Templates

Versionnés dans le repo, i18n dès le jour 1, versions HTML **et** texte, variables validées (CTR-02), route de prévisualisation en dev. Pas de HTML construit par concaténation à la volée.

## MAIL-04 — Transactionnel ≠ marketing

Le harness couvre le transactionnel (compte, sécurité, facturation, notifications produit). Newsletters et campagnes : outil dédié et domaine ou sous-domaine distinct — jamais mélangés, la réputation d'envoi est un actif.

## MAIL-05 — Délivrabilité

Sous-domaine d'envoi dédié (ex. `mail.exemple.com`), SPF, DKIM et DMARC configurés à la mise en production — checklist dans le plan de la slice de déploiement. En-tête `List-Unsubscribe` sur le non-critique.

## MAIL-06 — Contenu et liens

Le minimum de PII (DATA-14) ; liens vers URLs canoniques ; tokens dans les liens = usage unique, expirants (AUTH-07) ; jamais de secret ni de donnée sensible en clair.

## MAIL-07 — Anti-abus

Réponses et délais identiques que l'adresse existe ou non (AUTH-06). Rate limiting par destinataire et par type d'email — nos formulaires ne doivent pas permettre de bombarder un tiers.

## MAIL-08 — Préférences

Désinscription par catégorie pour les notifications non critiques. Les emails de sécurité et de facturation partent toujours.

## MAIL-09 — Retours fournisseur

Webhook bounces/plaintes traité comme tout webhook (SEC-05) ; hard bounce ⇒ adresse marquée, envois stoppés ; envois, échecs et plaintes mesurés (OBS-03).
