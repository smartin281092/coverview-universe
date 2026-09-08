# Admin — utilisateurs, profils liés et documents

Demande utilisateur du 8 septembre 2026 ; extension autorisée de S-042a. [Plan](../plans/S-042a-admin-users.plan.md). Session réelle : GPT-6 ; effort effectif non exposé. Aucun nouveau droit attribué à un compte.

## Livré

- Annuaire `/users` paginé et recherchable ; fiche `/users/$userId` avec profil explicite dans l'URL, données générales, finances, santé et documents. Création de personnes et sociétés sous le compte existant ; aucune connexion ou délégation juridique implicite.
- API `/admin/users/...` protégée par session distante, habilitation locale `administration.access` et MFA de moins de quinze minutes. Mutations CSRF/idempotence/révision ; session, permission et propriétaire vérifiés sous verrous. Acteur Admin distinct du propriétaire et audit persistant sans contenu personnel.
- Documents privés associés au titulaire ou à un dossier lié. Conservation, antivirus, téléchargement et lecture OpenAI réutilisent le pipeline existant. Complétion des champs généraux vides de la cible, avec provenance ; données existantes conservées. Extraction des coordonnées, raison sociale et numéro de registre ajoutée. Aucun remplissage financier/médical ni consentement du titulaire fabriqué.
- Migration additive `0010_bored_jocasta` : cible documentaire et FK composite, index de liste par profil, provenance des sections ; extension de la contrainte des champs de demandes de changement aux coordonnées. Appliquée sur `coverview_local`, port 55432 en loopback, sans reset. Le rollback applicatif conserve les colonnes et données ; ne pas redéployer un ancien worker ignorant la cible des documents liés.

## Vérifié

- Typecheck API, Admin, Wallet et client HTTP ; builds API/Admin/Wallet ; frontières dependency-cruiser et knip. Contrôle des bundles : 57 fichiers sans configuration serveur. Vues roadmap à jour.
- 15 tests HTTP identity avec PostgreSQL réel et double WorkOS explicitement historique : nouveau scénario annuaire/édition Admin, refus sans MFA/habilitation, CSRF/origine, cible étrangère, idempotence, lecture par le propriétaire et révocation.
- 4 tests PostgreSQL Admin/profils ; 8 tests client HTTP existants.
- 13 tests PostgreSQL ciblage documentaire, projection compagnies, workflows et profils : FK propriétaire/cible, séparation titulaire/personne/société, provenance, conservation des champs, rejouabilité, pièce du titulaire. Ces contrôles de persistance ne prouvent pas un appel OpenAI réel.
- Revue indépendante des frontières API et documents : pas de défaut bloquant relevé. Audit documentaire amélioré pour tracer les tentatives avant contrôle de cible et distinguer méthode HTTP/route.

## Journal des corrections

- Lint du nouveau scénario HTTP : réponses `json()` initialement non typées ; lecture par schémas Zod ajoutée, lint ciblé repassé.
- Typage/knip pendant assemblage UI : composant documentaire en cours puis ajouté ; export public devenu inutilisé retiré sans supprimer la garde stricte interne.
- Revue UI indépendante : blocage de navigation après expiration MFA corrigé (garde libérée sur refus et autorité invalidée) ; liste documentaire invalidée dès création du dépôt, même si le transfert échoue. Clé de création liée au payload, type MIME inconnu conservé, titre du dossier invalidé après changement de nom.

## Recette et limites

**Vérifié dans les services locaux** : migration0010 appliquée, code intégré par fast-forward dans les deux checkouts propres servant réellement l'API (9b02) et l'Admin (4133). Le superviseur WorkOS et sa clé de session ont été conservés. `/admin/users` anonyme refuse l'accès (401) ; la navigation Utilisateurs est rendue dans le navigateur intégré. La session connectée sans MFA valide voit « Vérifier votre identité » et aucune donnée privée.

**Fait non vérifié en navigateur authentifié** : lecture de l'annuaire, sauvegarde dans un compte réel, création de dossiers, dépôt/téléchargement et autocomplétion OpenAI. L'utilisateur a confirmé la connexion, mais l'écran et le serveur demandent toujours la preuve MFA supplémentaire. Cette étape personnelle a été demandée dans la conversation ; aucune protection contournée, aucune donnée fictive ajoutée au compte réel. Les commandes et leur isolation sont vérifiées sur PostgreSQL jetable selon les oracles ci-dessus.

Pour reprendre : ouvrir `/users` après validation `/mfa`, choisir un utilisateur, contrôler ses sections et documents, ouvrir la création personne/société et le dépôt. Les profils et consentements existants ne servent pas de données de démonstration. Aucune preuve OCR réelle revendiquée par les tests SQL.

Aucune dépendance ni variable d'environnement ajoutée. Aucun nouvel événement/worker : outbox documentaire et BullMQ existants ; aucune room, aucun message externe envoyé. Aucun changement à l'infrastructure distante. Avertissement Vite Admin corrigé par chargement différé des nouvelles routes ; avertissement Wallet préexistant conservé, aucune limite désactivée. Les modifications et références utilisateur préexistantes sont conservées.
