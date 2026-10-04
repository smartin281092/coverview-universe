# Contrat actuel 2026 et écarts de primes — 2 octobre 2026

Mandat explicite, [plan](../plans/health-current-2026.plan.md). Interprétation annoncée : contrat actuel 2026 contre les offres 2027 du comparateur. Extension du comparateur, sans clôture des slices globales S-011/S-042a.

## Livré et vérifié localement

- Sources officielles téléchargées : 217 472 primes CH (217 308 pour les cantons, 164 ZE/ZR archivées hors comparaison), 156 modèles, 34 assureurs, 5 483 localités et 42 régions suisses ; 2 230 primes UE/AELE/UK pour 14 assureurs et 30 pays. [Inventaire et preuves](../../data/health-insurance/2026/source-2026-audit.md). Aucun avantage ou contrat médical 2027 reconduit à 2026.
- Import annuel atomique et idempotent : deux exécutions CH et UE réussies, snapshots 2026 actifs séparés, noms historiques et marques stockés dans le snapshot. Les noms légaux globaux existants, modèles et prestations 2027 sont inchangés. [Empreintes avant/après](../../data/health-insurance/2026/import-verification.json).
- Dans le profil WWW : choix de la compagnie par carte/logo, puis modèles 2026 par carte/prix ; recherche, retour, changement de franchise/accident et localité historique, modification/retrait. Date de naissance requise pour calculer le tarif personnel, mais plus pour parcourir et sélectionner les cartes depuis la correction du 3 octobre ci-dessous ; choix 2026 conservé séparément des paramètres 2027 pendant la session.
- Différences calculées sur le serveur à partir d’identifiants de tarifs officiels : gains/surcoûts mensuels et annuels dans les résultats et la fiche ; indication des différences de franchise, accident, région/pays ou catégorie d’âge. Aucun prix fourni par le navigateur accepté, aucun effet sur le classement.
- Requêtes annulées et réponses associées à leur entrée canonique ; un résultat ancien n’est pas affiché pour une nouvelle sélection. Absence de données, commune historique inconnue, franchise invalide ou modèle hors périmètre restent explicites.
- Migration additive 0029 : une colonne JSONB `health_datasets.insurer_identities`, défaut tableau vide ; les anciennes données restent compatibles. PostgreSQL local migré, base jetable entièrement migrée par les tests.

## Oracles

- Vitest PostgreSQL réel via Testcontainers : **8 nouveaux tests**, plus **5 tests financiers existants**, tous passés. Ils couvrent identités historiques, taxonomie, région communale de l’année, inconnues, différences positives/négatives/nulles, frontières 18/19 et 25/26 ans, invalidité de franchise, réseau incertain, modèle d’une autre année, primes étrangères et contrats d’entrée stricts. Les nouveaux tests sont écrits dans cette tâche et ne constituent pas une revue humaine indépendante (TEST-10).
- `scripts/verify-health-current-live.py` : **466 primes** contrôlées directement contre les CSV bruts 2026, quatre profils CH, France, calculs des écarts et transitions d’âge ; lecture seule et données personnelles fictives. Oracle distinct des transformations de normalisation. Passé sur l’API 4100.
- API et WWW : typechecks passés, lint des fichiers modifiés passé, builds API/WWW passés ; 45 pages statiques. Avertissement Vite préexistant sur un bundle > 500 kB, aucun seuil désactivé.
- Navigateur réel à 1280 × 720 puis 390 × 844 : cartes des compagnies, modèles Assura, chargement 540,90 CHF, MediTel 459,10 CHF → économie 81,80 CHF/mois et 981,60 CHF/an. Changement de la franchise 2027 à 300 CHF : référence conservée à 540,90 CHF avec franchise 2500 ; MediTel 587,40 CHF → surcoût 558 CHF/an et mention « franchise différente ». Présentation mobile corrigée après inspection : écart sous les colonnes pour ne pas écraser le nom du modèle. Focus sur le titre à chaque étape, retour et fermeture vérifiés.

## Règles et limites

La comparaison porte sur les primes brutes annuelles, avant redistribution et subsides, sans simulation de soins. Les franchises/accident sont ceux du contrat choisi, pas réécrits lors d’un changement des critères 2027. L’âge est évalué séparément dans chaque année. Les codes adultes/jeunes vides du CSV 2026 deviennent E1/J1 dans la forme normalisée, avec le brut intact. Les types BASE/HAM/HMO/DIV restent natifs ; ils ne prouvent pas les parcours 2027.

K1 représente l’enfant individuel standard. Les sous-groupes familiaux K3/K4/K5 restent archivés sans être appliqués automatiquement. L’audit indépendant a rapproché 225 lignes du PDF pour les 34 assureurs et confirmé 42 434 tarifs spéciaux inférieurs à K1. Les libellés ALT K1 du CSV sont erronés pour 22 assureurs : ne pas utiliser la synthèse héritée `quality.json.ageSubgroups` comme description contractuelle. [Preuves détaillées](../../data/health-insurance/2026/child-subgroups-audit.json).

CMVEO (1113) et AMB (1507), présents en 2026 mais absents des tarifs 2027, conservent leur identité historique. Logo CMVEO officiel ajouté ; aucun logo AMB distinct vérifié, nom et initiales affichés. [Sources des logos](../../data/health-insurance/2026/logos-audit.json).

Aucune persistance du choix personnel, aucun compte ou demande d’offre créé par cette fonction. Données uniquement dans les POST de calcul, pas de profil en URL ni transmission tierce. Aucun déploiement public effectué.

## Exploitation et reprise

Normaliser avec `python scripts/health-normalize.py --year 2026` puis `python scripts/health-foreign-normalize.py --year 2026` ; les octets officiels téléchargés et leurs empreintes sont dans `data/health-insurance/2026`. Le mode `--download` des endpoints courants est refusé pour 2026 : ils servent 2027. Les modèles et localités portent l’identifiant du snapshot ; ne pas régénérer/importer 2027 pour ajouter 2026.

Après migration, `pnpm --filter api exec tsx src/modules/health-insurance/health.import.ts --year 2026`, puis `health.foreign.import.ts --year 2026`. En maintenance locale seulement, `AUTH_ENABLED=false` dans le processus CLI évite d’exiger les credentials WorkOS ; l’API de prévisualisation reste avec authentification active. Le timestamp de la nouvelle migration, non encore appliquée, a été remis après les migrations locales existantes avant application ; aucun journal SQL existant modifié.

L’API locale 4100 exécutait un ancien runner sans les nouvelles routes : prévalidation sur 4110, puis rechargement depuis le workspace avec authentification active (`/health` ready, `/identity/config` enabled). Le serveur temporaire 4110 a été arrêté. Le lancement 4100 courant est enregistré dans `.preview/health-current-api-4100-pid.json`. Les autres apps n’ont pas été arrêtées.

Retour arrière : remettre les composants/routes précédents, conserver la colonne additive et les archives. Le classement 2027 reste utilisable sans sélection 2026. Pour invalider un snapshot historique, passer uniquement son année 2026 inactive ; ne pas supprimer de tables ou remettre la base à zéro. Les anciens snapshots peuvent être réactivés par leur import original.

État de travail : modifications dans le workspace partagé, avec de nombreux importeurs, schémas, migrations et clients déjà non versionnés avant cette demande. Aucun commit global des travaux préexistants effectué, aucune autre modification utilisateur retirée. La reproduction depuis un checkout Git vierge dépend de la consolidation de ce socle préexistant ; les validations ci-dessus portent sur le workspace local.

## Ajustement du profil — 3 octobre 2026

**Vérifié** : suppression des aides sous naissance/sexe et du pied « Primes officielles 2027 / Réinitialiser », contrat actuel placé avant « Plus de paramètres », bouton de sélection avec padding de 12 px et cible de 44 px minimum. Sans naissance, le dialogue ouvre directement les cartes des compagnies puis des modèles. La consultation réutilise le profil adulte par défaut du comparateur ; aucun prix personnel ni écart n’est affiché tant que la naissance manque. Le nom/logo du modèle choisi reste visible et la saisie ultérieure de la naissance déclenche le calcul serveur existant. Les contrôles de franchise/commune continuent de s’appliquer.

Parcours réel vérifié à 1280 × 720 puis 390 × 844 : profil vierge → 21 compagnies dans VD-1 → 7 modèles Assura → sélection « Assurance de base » sans date → saisie fictive 01.01.1990 → prix 540,90 CHF/mois. Retrait, nouvelle ouverture mobile sans date, ordre des blocs et espacement du bouton contrôlés. Astro Check : 87 fichiers, zéro erreur/avertissement ; lint ciblé et build 45 pages passés. L’avertissement préexistant du bundle Vite > 500 kB subsiste. Aucun changement API, base, import, dépendance ou persistance personnelle dans cet ajustement ; onglet et viewport de recette temporaires.
