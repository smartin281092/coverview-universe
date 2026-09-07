# Wallet — onglets du compte

Demande utilisateur du 7 septembre 2026 : retirer Appareils du menu, regrouper Préférences et Appareils dans Mon compte avec le design system et supprimer les boutons redondants.

- **Vérifié — code** : lint ciblé, typecheck UI/Wallet, build Wallet et frontières dependency-cruiser/Knip passent. L’avertissement préexistant de bundle supérieur à 500 ko demeure ; aucune limite relevée.
- **Vérifié — provenance** : Tabs généré par `pnpm exec shadcn add tabs --yes` dans le projet isolé du preset radix-mira, puis intégré dans UI. Empreinte de sortie dans `packages/ui/preset-provenance.json` ; formatage projet et export inutilisé du helper de variantes retiré. Aucune dépendance ni modification du lockfile.
- **Vérifié — navigateur local authentifié** : menu limité à Profil/Documents/Compte ; Préférences affiche email, Authenticator et déconnexion courante ; sélection Appareils change l’URL, affiche la session réelle et les seules actions individuelles/globale. Aucun retour de navigation ni pagination sur cette page unique. Rechargement de `/account?tab=devices` conserve l’onglet ; ouverture de `/devices` redirige vers cette adresse. Retour vers Préférences contrôlé. Rôles tablist/tab/tabpanel et sélection présents dans l’arbre accessible.
- **Fait, non vérifié en navigateur** : grille mobile ramenée à trois colonnes ; gestion clavier fournie par Radix. Pas de simulation de nombreuses sessions pour la pagination, ni de révocation réelle pendant cette recette de présentation.
- **Périmètre** : les requêtes, autorisations, clés de cache privé et actions de révocation existantes sont conservées. Aucun réglage simulé ajouté. Déconnexion courante dans Préférences, déconnexion globale dans Appareils ; aucune déconnexion réelle déclenchée pour vérifier la présentation.

Session : Codex GPT-6 ; effort exact non exposé dans ce contexte. Cette correction ne clôt pas la recette documentaire S-042a.
