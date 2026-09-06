# Preset shadcn et typographie — 6 septembre 2026

Mandat explicite : Geist pour titres et corps, fonte de l’archive Montech à la place de Geist Mono, preset `b38oXC5rf` et réutilisation de ses composants. Fond blanc, sections ouvertes, cards rares en aplat clair sans bordure ni ombre. Cette correction prime sur la direction xAI d’ADR-0007 ; elle ne modifie pas le contenu métier ni l’identité.

1. Inspecter les fontes jointes et leur provenance sans exécuter le contenu de l’archive. Conserver les seuls assets utiles dans UI.
2. Appliquer la commande fournie dans un répertoire de génération isolé ; intégrer sa sortie réelle dans la bibliothèque commune, en conservant les contraintes blanches et sans cadres de l’utilisateur.
3. Réutiliser les primitives générées pour les contrôles et les bentos existants ; raccorder Geist et Montech dans les trois frontends. Retirer les anciennes surcharges xAI des contrôles.
4. Compiler, typer, lint et lire les écrans réellement servis sur ordinateur/mobile. Aucun fixture, smoke test ou suite de surface. Consigner les résultats puis préserver en Git.

WorkOS reste dans l’état du ledger S-000b ; aucune preuve d’authentification réelle ne sera déduite du rendu. Pas de déploiement ou de nouvelle slice.

Résultat exécuté et relu : [ledger courant](../evidence/shadcn-typography.md). Aucune nouvelle slice ; prochaine action fonctionnelle reste l’activation réelle d’identité décrite au ledger S-000b.
