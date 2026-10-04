# Admin / Wallet : données communes et passeport

Demande utilisateur du 11 septembre 2026. [Plan](../plans/S-042a-admin-wallet-sync.plan.md). Extension corrective, sans clôture globale de S-042a.

## Diagnostic et changements

- V3 : le dossier Admin où l’AVS a été saisi et la session Wallet ouverte appartiennent à deux identités distinctes, confirmées par leurs adresses de connexion affichées. Aucune fusion ni copie entre comptes réalisée.
- Les routes Admin et propriétaire utilisent les mêmes profils canoniques et sections, et les documents portent le propriétaire/profil explicitement ciblé. L’AVS n’est pas perdu dans un adaptateur.
- Formulaires et listes : retour au premier plan et rafraîchissement visible toutes les quinze secondes, cinq secondes pendant un traitement documentaire. Une nouvelle révision remplace un formulaire intact ; une saisie locale ou sauvegarde en cours reste protégée. Un conflit conserve la saisie et les contrôles de révision serveur.
- Pièce d’identité : à défaut d’un choix explicite, le passeport existant détecté avec une citation valide et déjà scanné est proposé pour son profil exact. Le type reste `passport`. Les sélections/retraits manuels prévalent ; pas de nouvelle analyse ni migration.

## Vérifications

- V2 PostgreSQL : le nouveau test de passeport échoue avant correction (`missing` au lieu de `ready`), puis passe. Les 8 tests de pièces et ciblage passent : titulaire, membre, société exclue, autre compte refusé, attribution ambiguë, citation absente, antivirus absent, quarantaine/suppression et priorité du choix/retrait explicite.
- V2 HTTP/PostgreSQL : 25 tests identité/Admin/profils passent. Sauvegarde et lecture croisée des douze champs généraux, dont AVS, puis effacement explicite ; Finances et Santé complètes pour titulaire et membre, avec lecture et effacement propriétaire ; autorisations, MFA, révisions et séparation des comptes conservées.
- V2 service/PostgreSQL : création et transfert Admin pour titulaire, membre et société ; intégrité des octets, reprise, visibilité dans la bibliothèque Wallet et téléchargement propriétaire après scan, refus avant scan et pour autre compte/profil. Stockage objet et antivirus sont explicitement des doubles dans ce test ; les tests HTTP identité utilisent leur double WorkOS préexistant. Aucun dépôt fictif dans le compte réel.
- V0/V1 : types API/Wallet/Admin, lint des sources modifiées, builds API/Wallet/Admin réussis. Les builds frontend signalent des bundles supérieurs à 500 ko ; aucune réduction de bundles entreprise dans cette correction.
- Frontières : dependency-cruiser et knip passent ; aucune dépendance ajoutée.
- V3 réel : le passeport déjà analysé du titulaire est affiché disponible dans la section Pièce d’identité de son profil Wallet et dans sa procuration. Aucun nouvel appel IA, aucune signature et aucune mutation des champs personnels effectués pour cette vérification.

## Limites

Le transfert de fichier depuis Admin est vérifié par les services/tests isolés ; aucun nouveau dépôt réel de document client n’est revendiqué. La propagation d’une nouvelle édition entre deux navigateurs est couverte par le code de rafraîchissement et les contrôles HTTP/SQL ; aucun champ réel n’a été modifié pour fabriquer cette preuve. Les originaux, consentements, permissions et archives signées restent inchangés.
