# Revue documentaire simplifiée et centre d’action

Mandat utilisateur du 9 septembre 2026, extension de S-042a en cours. Autonomie et meilleurs défauts autorisés par execution-policy.md ; pas de nouveau GO. Session GPT-6, effort non exposé. Travail parallèle par domaines disjoints ; aucun envoi externe réel dans la recette.

## Décisions

- Le panneau Vérifier supprime citation/page/méthode, checkbox de vérification et choix radio. La valeur lue est éditable. Enregistrer corrige le document uniquement ; Utiliser dans mon profil est une commande explicite distincte, disponible quand la valeur diffère. Les parties de l’adresse forment une entrée et se mettent à jour ensemble, sans inventer les composants absents.
- Backend propriétaire des comparaisons et du profil cible, incluant les profils gérés. Nouvelle commande additive ; anciens clients et preuves historiques restent lisibles. Les données source OCR restent conservées séparément des corrections utilisateur.
- Suivi par propriétaire, profil, compagnie canonique et groupe de coordonnées : observations documentaires distinctes des notifications et confirmations, dates explicites. Une date de dépôt ne prouve pas la date de l’information. Les données contradictoires sans chronologie fiable sont à vérifier ; jamais d’écrasement aveugle par le dernier import.
- Centre d’action Wallet pour différences et synchronisations possibles ; demande explicite crée une carte persistante dans un kanban service client Admin. Réutiliser les frontières propriétaire/Admin+MFA et les contrôles d’audit, révision, CSRF, idempotence. Les valeurs transmises sont figées dans la demande ; une modification ultérieure du profil peut nécessiter une nouvelle action.
- Aucun circuit d’envoi ni destinataire compagnie n’existe actuellement. Une demande mise en file reste en attente. La notification effectuée est enregistrée par l’administrateur avec date et référence de preuve ; la confirmation que la compagnie est à jour est distincte. Vert seulement pour une preuve valable correspondant à la valeur actuelle, pas pour une simple tâche créée. Aucune simulation SMTP présentée comme envoi réel.

## Périmètre et oracles

Contrats/API/SQL additifs, Wallet et Admin, parcours de revue groupée, suivi de compagnie et kanban. Pas d’optimisations financières inventées, de destinataires devinés, de droits professionnels élargis, de nouvel appel IA ni de relecture automatique. Les autorisations/documents originaux existants et changements utilisateur non liés sont préservés.

V0/V1 types/lint/build et migration additive. V2 tests PostgreSQL ciblés sur isolation compte/profil, correction sans mutation profil, sync explicite atomique, idempotence/concurrence, vieille observation contre preuve récente, changement de profil après notification et transitions Admin. V3 UI réelle en lecture seule pour documents existants ; aucune donnée factice dans le compte utilisateur, aucune notification externe ni correction de profil réelle fabriquée pour tester. Limites matérielles et MFA consignées.

Lire : README document-intelligence/Wallet/Admin, docs frontend/design/i18n, data/api/contracts/security/permissions/auth, tests et delivery. Exclure marketing/billing/LLM (aucun changement fournisseur). Journal : roadmap/evidence/document-action-center.md. S-042a demeure en cours ; pas de nouvelle slice active.
