# S-042a — Cohérence Admin/Wallet et passeport du profil

Autorisé par la demande utilisateur du 11 septembre 2026 et le mandat d’autonomie existant. Extension corrective de S-042a ; aucune nouvelle permission ni fusion de comptes.

## Résultat attendu

- Comparer l’identité et le profil exacts avant de conclure à une désynchronisation de l’AVS. Admin et Wallet lisent et écrivent les mêmes données canoniques, y compris les sections des personnes et sociétés.
- Actualiser les données et documents des pages ouvertes après une mutation externe. Une saisie locale non enregistrée reste protégée contre l’écrasement ; une révision concurrente exige une résolution explicite.
- Vérifier création, transfert, lecture et téléchargement des documents déposés par Admin pour le propriétaire/profil explicitement ciblé, avec les protections existantes.
- Un passeport détecté avec citation fiable sur un original du profil exact est disponible comme pièce d’identité dans le profil et les procurations, sans nouvelle analyse payante, sans changer son type en carte d’identité et sans remplacer une sélection explicite.

## Vérification

Inspection des routes et contrats ; tests PostgreSQL ciblés de sauvegarde et lecture croisée, transfert documentaire et isolation. Vérification du cache et des formulaires, types/lint/build des consommateurs modifiés. Parcours des données existantes dans le navigateur ; aucune donnée fictive ajoutée au compte réel pour créer une preuve. Les doubles des tests restent explicitement distincts d’un transfert réel.

## Journal

- Départ : les formulaires désactivent le rafraîchissement au retour dans l’onglet et conservent leur première copie locale. L’association de pièce d’identité ne cherche que les documents déjà sélectionnés. Comparaison des identités du dossier Admin et de la session Wallet en cours.
- Fin : comptes distincts confirmés dans les interfaces ; rafraîchissement et protection des saisies ajoutés. Test du passeport rouge avant correction puis vert ; 33 tests ciblés passent, types/lint/build et frontières/knip valides. Passeport réel disponible dans le profil et la procuration. Détails et limites : [journal](../evidence/admin-wallet-sync.md).
