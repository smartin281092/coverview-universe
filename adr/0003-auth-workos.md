# ADR-0003 — Authentification WorkOS

Date : 2026-09-05 · Statut : fournisseur accepté sur demande explicite ; intégration à réaliser.

## Contexte et décision

L'utilisateur impose WorkOS et le projet `coverview`, en remplacement de Better Auth dans le harness d'origine. Appliquer AUTH-11. La bible §9/30/63 exige continuité du compte, rattachement de la session anonyme, email/OTP et déconnexion globale. Vérifier ces parcours dans la configuration réelle ; SMS/passkeys et modalités MFA restent à préciser selon les usages et capacités.

## Alternatives et conséquences

Ne pas maintenir deux systèmes d'authentification en parallèle ni provisionner un schéma Better Auth devenu inutile. Adapter l'API Fastify à WorkOS, garder les secrets côté serveur et l'autorisation métier dans les policies de l'application. Une fixture locale de persona ne prouve pas le parcours AuthKit.

## Migration et validation

Aucun utilisateur ni schéma antérieur à migrer. Connexion au projet, client ID, callbacks, sessions/révocation et droits seront vérifiés dans la slice d'intégration. Aucun compte WorkOS n'a été créé ou modifié pendant l'initialisation.
