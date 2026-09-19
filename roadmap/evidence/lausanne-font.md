# Lausanne — vérification du 19 septembre 2026

Voie rapide PROG-19, demande utilisateur : remplacer Geist par Lausanne dans toutes les apps et le site marketing. Décision : [ADR-0009](../../adr/0009-lausanne.md).

## Vérifié

- Le thème commun `packages/ui` définit Lausanne pour les titres, le corps, les contrôles et les utilitaires sans-serif des trois interfaces existantes (`client`, `admin`, `www`). Montech est conservée dans ses rôles dédiés.
- Huit WOFF2 locaux : les SHA-256 correspondent aux originaux téléchargés et aux fichiers émis dans chacun des trois builds. Chaque CSS compilé contient le token Lausanne et aucune référence à Geist.
- Builds Vite Client et Admin, build Astro de 42 pages : succès. Vite signale des chunks JavaScript supérieurs à 500 kB ; ce changement de fontes ne modifie pas leur découpage.
- Typecheck de UI, Client, Admin et WWW : succès ; Astro rapporte zéro erreur, avertissement ou suggestion.
- ESLint ciblé sur `download-authorization.ts` : succès. Formatage des sources modifiées : effectué.
- Navigateur sur les previews locales 4101, 4102 et 4103 : le corps et le H1 utilisent `Lausanne, system-ui, sans-serif`. Les inventaires de ressources Client et Admin montrent `TWKLausanne_400.woff2`. Après invalidation du style Wallet et rechargement, aucun fichier Geist n’est chargé par cette page. Captures Wallet et accueil marketing inspectées, pas de débordement horizontal sur ces deux pages à la largeur courante.
- Retrait de `@fontsource-variable/geist` par pnpm ; aucune dépendance ajoutée. Corepack utilise la version de pnpm du projet car le lanceur global était défectueux. Le delta du lockfile se limite aux trois entrées Geist ; les modifications préexistantes restent conservées.

## Fait non vérifié en parcours complet

L’export PDF d’autorisation utilise le token CSS commun et attend les poids 400 et 600 avant la mesure du texte. TypeScript, lint et build passent ; aucun export signé réel n’a été effectué dans cette session. Les pages privées nécessitant une connexion n’ont pas été parcourues ; elles consomment le même thème partagé.

## Portée

Aucune modification des données métier, permissions, événements, jobs, migrations ou variables d’environnement. Aucun nouveau test permanent pour ce changement de présentation. Pas de publication distante. Les informations de provenance et de droits restent celles du téléchargement, sans nouvelle vérification de licence.

Session Codex ; identifiant exact du modèle et effort effectif non exposés par les outils de cette tâche. Voie rapide : pas de nouvelle slice, de modification de backlog ou de candidat mémoire.
