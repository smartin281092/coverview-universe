# Wallet — onglets du compte

Demande utilisateur du 7 septembre 2026 : retirer Appareils du menu, regrouper Préférences et Appareils dans Mon compte avec le design system et supprimer les boutons redondants.

- **Vérifié — code** : lint ciblé, typecheck UI/Wallet, build Wallet et frontières dependency-cruiser/Knip passent. L’avertissement préexistant de bundle supérieur à 500 ko demeure ; aucune limite relevée.
- **Vérifié — provenance** : Tabs généré par `pnpm exec shadcn add tabs --yes` dans le projet isolé du preset radix-mira, puis intégré dans UI. Empreinte de sortie dans `packages/ui/preset-provenance.json` ; formatage projet et export inutilisé du helper de variantes retiré. Aucune dépendance ni modification du lockfile.
- **Vérifié — navigateur local authentifié** : menu limité à Profil/Documents/Compte ; Préférences affiche email, Authenticator et déconnexion courante ; sélection Appareils change l’URL, affiche la session réelle et les seules actions individuelles/globale. Aucun retour de navigation ni pagination sur cette page unique. Rechargement de `/account?tab=devices` conserve l’onglet ; ouverture de `/devices` redirige vers cette adresse. Retour vers Préférences contrôlé. Rôles tablist/tab/tabpanel et sélection présents dans l’arbre accessible.
- **Fait, non vérifié en navigateur** : grille mobile ramenée à trois colonnes ; gestion clavier fournie par Radix. Pas de simulation de nombreuses sessions pour la pagination, ni de révocation réelle pendant cette recette de présentation.
- **Périmètre** : les requêtes, autorisations, clés de cache privé et actions de révocation existantes sont conservées. Aucun réglage simulé ajouté. Déconnexion courante dans Préférences, déconnexion globale dans Appareils ; aucune déconnexion réelle déclenchée pour vérifier la présentation.

Session : Codex GPT-6 ; effort exact non exposé dans ce contexte. Cette correction ne clôt pas la recette documentaire S-042a.

## Espacements communs et actions adaptatives

Demande suivante : rapprocher les onglets de la description, conserver cette règle pour les futures pages et placer les actions Préférences côte à côte si possible.

- **Vérifié — implementation** : composition partagée `cv-tabbed-page`, utilisée par `AccountLayout layout="tabs"` et documentée dans UI ; lint ciblé, typage UI/Wallet et build réussis.
- **Vérifié — navigateur authentifié à 375 et 1280 px** : distance description/onglets mesurée à 24 px dans les deux cas. Boutons sur deux lignes à 375 px et côte à côte à 1280 px, avec 12 px d’écart mesuré dans les deux dispositions. Aucun débordement horizontal. Dimensions de contrôle réinitialisées ensuite.
- **Vérifié — actualisation locale** : Vite avait conservé le CSS importé du package UI ; une notification de modification du fichier CSS d’entrée Wallet a déclenché sa recompilation, sans changer le contenu du fichier ni relancer l’API. Le CSS chargé et les dimensions finales ont été contrôlés après rechargement.
