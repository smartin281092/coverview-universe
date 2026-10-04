# Comparateur : carte et demandes familiales

Mandat explicite du 30 septembre 2026 ; exécution autonome (PROG-23). Extension de `health-2027.plan.md`, sans changement de données Priminfo.

## Résultat attendu

Carte avec survol au-dessus de la région, fermeture à la sortie, zoom/déplacement souris et tactile ; composants Select du design system ; réponses du guide validées au clic. Demande d'offre familiale en plusieurs étapes, email et vérification WorkOS, configuration préremplie, panier, résumé légal, création persistante et suivi www/Wallet/Admin.

## Invariants

- WorkOS reste autorité d'identité ; saisir un email ne prouve jamais sa propriété. Aucun rattachement à un compte existant avant preuve vérifiée (AUTH-11).
- Prix et éligibilité recalculés côté API sur le catalogue actif ; pas de montant client autoritaire (G-11).
- Suivi invité limité au navigateur autorisé ; un identifiant de demande seul n'ouvre aucune donnée personnelle. Propriété Wallet et permission administrative + MFA relues côté serveur (G-02/G-03).
- Soumission et transitions idempotentes, audit persisté, profils familiaux réutilisés via leur module propriétaire. Aucune souscription automatique à une assurance.
- Aucune question médicale du guide enregistrée dans le panier ; seules les coordonnées et caractéristiques nécessaires à l'offre.

## Étapes et oracles

- [x] Carte, Select, guide : clavier, souris et largeur mobile vérifiés ; téléphone physique dans la recette externe.
- [x] Contrats, stockage et migrations additives ; API avec protections, idempotence et éligibilité.
- [x] Compte email/OTP WorkOS et parcours panier/coordonnées/résumé.
- [x] Suivi invité et Wallet, profils de famille, animations vectorielles Lottie.
- [x] Admin : liste paginée, détail et avancement audité.
- [x] Tests sur PostgreSQL : isolation, rejeu, prix, profils, transitions ; typechecks, builds et parcours navigateur.

## Périmètre et lecture

www, API, contracts, api-client, UI partagé, Wallet, Admin. Réutiliser identity, profiles et leurs protections. Satellites : auth, permissions, data, api, contracts, backend, architecture, frontend, design, marketing-web, i18n, security, testing, dependencies. Lecture indépendante déléguée selon CDX-05, mutations sous un seul propriétaire.

## Limites explicites

L'envoi d'une offre par un assureur reste une action de traitement réelle de l'équipe, jamais un statut simulé. La publication et le déploiement ne font pas partie de cette demande. Les vérifications WorkOS réelles dépendent de la configuration fournisseur disponible ; état indisponible explicite si absent.

## Journal

- Plan enregistré avant mutations ; audits terminés et vérifications consignées dans `roadmap/evidence/health-offers.md`.

## Ajustement du choix d’accès — 30 septembre 2026

Mandat explicite : proposer dès « Demander une offre » le parcours invité ou la connexion/création Wallet. Invité : email de contact uniquement, aucune création WorkOS ni émission OTP. Wallet : connexion/création par OTP existante, réutilisation d’une session vérifiée correspondante et conservation de l’offre. Le passage d’invité à Wallet exige la même preuve d’identité que précédemment.

- [x] Contrat additif, distinction serveur invité/Wallet et tests PostgreSQL de non-création de challenge invité, puis de rattachement vérifié.
- [x] Écran de choix initial, email adapté et poursuite Wallet après vérification seulement.
- [x] Vérifications types/lint/tests/build et navigateur, documentation mise à jour.
