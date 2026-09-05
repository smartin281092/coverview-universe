# ADR-0005 — Cible Infomaniak isolée

Date : 2026-09-05 · Statut : cible acceptée sur demande explicite ; déploiement à planifier.

## Contexte et décision

L'utilisateur impose Infomaniak Public Cloud via Horizon, protège les instances déjà présentes et indique que coverview.ch est hébergé chez Infomaniak. Les règles canoniques de cible, inventaire, protection, nouvelles ressources et DNS sont HOST-01 à HOST-03.

## Alternatives et conséquences

Le VPS générique du harness devient une cible conteneurisée dédiée sur ce cloud. Aucun remplacement par Sites, Vercel ou un autre hébergeur par défaut. Aucune réutilisation opportuniste d'une instance existante. Région, capacité, coût, stockage et endpoints seront déterminés à la slice de déploiement.

## Mise en œuvre et retour arrière

Aucune opération Horizon, DNS ou provisioning n'a eu lieu. Le futur plan devra présenter les ressources nouvelles et le retour arrière sans effet sur l'existant. L'authentification déclarée par l'utilisateur n'a pas été testée pendant le cadrage.
