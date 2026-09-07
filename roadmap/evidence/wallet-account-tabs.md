# Wallet — onglets du compte

Demande utilisateur du 7 septembre 2026 : retirer Appareils du menu, regrouper Préférences et Appareils dans Mon compte avec le design system et supprimer les boutons redondants.

- **Vérifié — code** : lint ciblé, typecheck UI/Wallet et build Wallet passent. L’avertissement préexistant de bundle supérieur à 500 ko demeure ; aucune limite relevée.
- **Vérifié — provenance** : Tabs généré par `pnpm exec shadcn add tabs --yes` dans le projet isolé du preset radix-mira, puis intégré dans UI. Empreinte dans `packages/ui/preset-provenance.json`. Aucune dépendance ni modification du lockfile.
- **Fait, recette navigateur à compléter** : navigation Profil/Documents/Compte, deux onglets liés à l’URL, redirection de `/devices`, suppression des raccourcis redondants et pagination masquée si une seule page.
- **Périmètre** : les requêtes, autorisations, clés de cache privé et actions de révocation existantes sont conservées. Aucun réglage simulé ajouté. Déconnexion courante dans Préférences, déconnexion globale dans Appareils ; aucune déconnexion réelle déclenchée pour vérifier la présentation.

Session : Codex GPT-6 ; effort exact non exposé dans ce contexte. Cette correction ne clôt pas la recette documentaire S-042a.
