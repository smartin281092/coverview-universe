# Revue documentaire simplifiée et centre d’action

Mandat utilisateur du 9 septembre 2026, extension de S-042a en cours. Autonomie et meilleurs défauts autorisés par execution-policy.md ; pas de nouveau GO. Session GPT-6, effort non exposé. Travail parallèle par domaines disjoints ; aucun envoi externe réel dans la recette.

## Décisions

- Le panneau Vérifier supprime citation/page/méthode, checkbox de vérification et choix radio. La valeur lue est éditable. Enregistrer corrige le document uniquement ; Utiliser dans mon profil est une commande explicite distincte, disponible quand la valeur diffère. Les parties de l’adresse forment une entrée et se mettent à jour ensemble, sans inventer les composants absents.
- Backend propriétaire des comparaisons et du profil cible, incluant les profils gérés. Nouvelle commande additive ; anciens clients et preuves historiques restent lisibles. Les données source OCR restent conservées séparément des corrections utilisateur.
- Suivi par propriétaire, profil, compagnie canonique et groupe de coordonnées : observations documentaires distinctes des notifications et confirmations, dates explicites. Une date de dépôt ne prouve pas la date de l’information. Les données contradictoires sans chronologie fiable sont à vérifier ; jamais d’écrasement aveugle par le dernier import.
- Centre d’action Wallet pour différences et synchronisations possibles, y compris les scans sans compagnie identifiée ; demande explicite à une compagnie connue crée une carte persistante dans un kanban service client Admin. Réutiliser les frontières propriétaire/Admin+MFA et les contrôles d’audit, révision, CSRF, idempotence. Les valeurs transmises sont figées dans la demande ; une modification ultérieure du profil peut nécessiter une nouvelle action.
- Aucun circuit d’envoi ni destinataire compagnie n’existe actuellement. Une demande mise en file reste en attente. La notification effectuée est enregistrée par l’administrateur avec date et référence de preuve ; la confirmation que la compagnie est à jour est distincte. Vert seulement pour une preuve valable correspondant à la valeur actuelle, pas pour une simple tâche créée. Aucune simulation SMTP présentée comme envoi réel.

## Périmètre et oracles

Contrats/API/SQL additifs, Wallet et Admin, parcours de revue groupée, suivi de compagnie et kanban. Pas d’optimisations financières inventées, de destinataires devinés, de droits professionnels élargis, de nouvel appel IA ni de relecture automatique. Les autorisations/documents originaux existants et changements utilisateur non liés sont préservés.

V0/V1 types/lint/build et migration additive. V2 tests PostgreSQL ciblés sur isolation compte/profil, correction sans mutation profil, sync explicite atomique, idempotence/concurrence, vieille observation contre preuve récente, changement de profil après notification et transitions Admin. V3 UI réelle en lecture seule pour documents existants ; aucune donnée factice dans le compte utilisateur, aucune notification externe ni correction de profil réelle fabriquée pour tester. Limites matérielles et MFA consignées.

Lire : README document-intelligence/Wallet/Admin, docs frontend/design/i18n, data/api/contracts/security/permissions/auth, tests et delivery. Exclure marketing/billing/LLM (aucun changement fournisseur). Journal : roadmap/evidence/document-action-center.md. S-042a demeure en cours ; pas de nouvelle slice active.

## Évolution demandée — centre dédupliqué et résolutions

Mandat suivant du 9 septembre : une action par donnée et profil, même si plusieurs documents/compagnies portent cette donnée ; adresse atomique. Routes partageables `/actions/:id`, navigation entre actions, choix de résolution et réponse libre, sources en boutons secondaires, badge menu, progression et anneau indigo. L’onglet Activité conserve les résolutions horodatées après disparition d’une action.

- API additive dédiée au centre, sans casser `/actions` historique. Identité d’action opaque stable par propriétaire/profil/groupe. Variantes normalisées et références source regroupées ; un import identique ne réouvre pas une décision. Une donnée réellement nouvelle réouvre la revue. Toute commande verrouille compte/session, vérifie empreinte/révisions et utilise l’idempotence.
- Conserver le profil peut faire apparaître la suite « notifier les compagnies ». Une commande groupée prépare toutes les cartes concernées dans une transaction ; mandat signé pour le profil concerné requis côté serveur. Aucune mise en file assimilée à un envoi. Les textes libres non structurés sont enregistrés comme réponse à traiter, jamais interprétés comme un ordre de changement ou d’envoi arbitraire.
- Progression serveur sur les contrôles uniques applicables réalisés et en attente ; aucune action = 100 %. Ce pourcentage décrit les actions prises en compte dans l’application, pas une évaluation financière de contrats encore non intégrés. Sources incomplètes signalées.
- Les choix de résolution des cas actuels correspondent aux opérations réellement disponibles ; pas de fausse recommandation IA ni d’optimisation financière inventée. L’extension future aux contrats pourra ajouter des propositions fondées sur leur analyse.
- Réponse utilisateur : tous les champs de Générales requis, y compris AVS/profession/nationalité ; Finances/Santé facultatifs. Une politique partagée pilote affichage et actions, avec exceptions personnes/entités.
- Réponse utilisateur : signature tracée dans l’application, acceptation explicite et document horodaté conservé. Le parcours doit produire une preuve persistante du texte exact, profil, tracé, date serveur et session ; sans prétendre fournir une signature qualifiée ou une contresignature non réalisée. Retour à l’action via identifiant validé, jamais redirection libre. La lecture LSA45 conserve son sens actuel : ouverture enregistrée.
- Corriger les proportions communes des boutons : la hauteur tactile de 44 px n’est actuellement pas accompagnée d’un espacement horizontal proportionnel. Garder les cibles tactiles et les boutons icône carrés.

Vérifications : PostgreSQL réel pour déduplication multi-source/profil, résolutions/réouverture, historique, révisions/rejeux, signatures/mandat et isolation ; types/lint/build/frontières ; recette des pages et navigation réelles sans signer ni modifier le profil utilisateur pour tester. Root : intégration, signature/retours et boutons ; agents : moteur/contrats/tests, UI centre, prérequis et gardes. Aucune nouvelle slice ni livraison globale anticipée.

## Onglet En cours — complément demandé

Ajouter « En cours » entre « À faire » et « Activité ». À faire affiche les actions `pending`, En cours les demandes `in_progress` déjà confiées au service client ; leurs détails restent accessibles. Filtrage serveur avant pagination, curseurs et cache distincts par état, lien partageable `?tab=in_progress`. Aucun changement de score, de badge, de données ou de preuve d’envoi. Oracle : test PostgreSQL de séparation/pagination, types/build et navigation réelle sans créer de demande dans le compte utilisateur.

## Résolution compacte — ajustements demandés

Aligner les cercles du crayon et des options ; une seule zone de réponse remplace les champs supplémentaires. Masquer la sélection numérotée lorsqu’une seule proposition existe ; conserver les commandes explicites de transmission dans le bouton d’action. La correction utilise le texte saisi comme valeur, validée côté serveur pour le groupe du profil ; une adresse est saisie ensemble avec un format explicite, sans deviner des composants. Les réponses libres des démarches restent des demandes de traitement. Retirer le texte d’aide de transmission demandé, déplacer la navigation au-dessus du titre, afficher uniquement une barre « Compte optimisé à X % » et le nombre d’actions restantes. Contrat correct étendu de façon additive aux réponses textuelles, anciennes commandes structurées conservées. Tests PostgreSQL de correction/validation/rejeu et recette visuelle sans modifier les données réelles.
