# S-042a — Gestion des utilisateurs dans Admin

Statut : autorisé par la demande utilisateur du 8 septembre 2026 et le mandat PROG-23. Extension du parcours profils/documents en cours ; aucune nouvelle slice concurrente.

Session requise : GPT-6 Astra / ultra (PROG-12). Session réelle : GPT-6 ; effort effectif non exposé. Budget : une session avec sous-tâches indépendantes.

## Objectif et décisions

L'administrateur habilité retrouve tous les utilisateurs applicatifs, ouvre leur dossier, renseigne leurs données, crée des dossiers de personnes ou sociétés sous leur compte et dépose des documents sur le profil explicitement choisi. L'extraction complète uniquement les champs vides de ce profil.

- Autorité : permission existante `administration.access` et MFA de session valide, contrôlées côté serveur pour chaque accès. L'extension donne à cette habilitation les opérations de gestion demandées ; aucune attribution nouvelle ni usurpation de session du titulaire.
- L'acteur administratif et le propriétaire des données restent distincts et audités. Les lectures sont paginées et les commandes contrôlent CSRF, révision et idempotence.
- Les sous-profils existants `person`/`legal_entity` représentent famille/sociétés rattachées au compte. Aucun compte WorkOS supplémentaire, partage, signature ou lien juridique n'est créé implicitement.
- Les documents portent une cible explicite, propriétaire canonique par défaut pour les anciens documents. Aucun rapprochement par nom ni migration d'anciens documents vers une autre personne.
- L'autocomplétion réutilise l'antivirus, le stockage privé et la lecture OpenAI existants ; valeurs existantes conservées et provenance maintenue. Une saisie Admin ne confirme pas à la place du titulaire ses consentements.

## Périmètre et sources

Apps Admin, API ; contrats/client HTTP communs ; modules identity, profiles, document-intelligence. Sources : demande utilisateur, README propriétaires, ADR-0002, S-042a et son extension library-authorizations. Satellites lus : architecture, conventions, backend, frontend/design/brand/i18n (audit UI), contracts, data, api, permissions, storage, security, testing, environment, evolution, delivery, program, codex. Marketing et billing exclus.

Migration additive pour la cible documentaire ; rollback applicatif conserve les données. Réutilisation des événements/jobs documentaires, aucune room ni envoi de message externe. Aucune dépendance prévue.

## Critères de fin et oracles

- Liste paginée/recherchable et dossier éditable dans Admin ; profils personne/société et documents correctement ciblés — V3 navigateur et persistance réelle si session disponible.
- Refus utilisateur ordinaire, MFA expirée, mauvais propriétaire/profil/document, session révoquée ; absence de contamination entre titulaire/sous-profils ; concurrence et idempotence — V2 PostgreSQL réel ciblé.
- Types/lint, build des consommateurs, frontières, migration sur PostgreSQL jetable — V0/V1/V2.
- Revue UI et revue sécurité indépendante ; preuves et limites factuelles dans le ledger. Aucun OCR réel revendiqué sans original effectivement traité.

## Risques et limites

Accès transversal sensible : politique centrale et revalidation transactionnelle, audit sans valeurs. Extraction d'un autre membre : FK composite et cible conservée tout le long du traitement. Modification concurrente : révisions. Changements utilisateur existants dans README et références préservés.

## Journal de vérification

| Cible | Oracle | Observé | Décision |
|---|---|---|---|
| Inspection | Lecture | Admin ne gère que compte/MFA ; profils liés et pipeline documentaire déjà persistants dans Wallet | Réutiliser ces modules avec frontières administratives explicites |
| API et persistance | V0/V1/V2 | Types, lint, builds, frontières et tests PostgreSQL/HTTP ciblés passent ; migration0010 locale appliquée | Code intégré dans les checkouts de preview sans reset ni remplacement du superviseur |
| Revue UI | Lecture | Deux défauts de reprise détectés : MFA et dépôt pending invisible | Corrections appliquées ; types/lint/build repassés |
| Navigateur connecté | V3 partiel | Navigation Utilisateurs visible ; écran MFA bloque la session connectée sans preuve valide | Vérification personnelle demandée, aucun accès contourné ; annuaire et mutations réelles restent à observer |
