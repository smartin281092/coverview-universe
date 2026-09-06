# ADR-0007 — Référence visuelle xAI imposée

Statut : accepté par instruction explicite utilisateur, 6 septembre 2026.

> **Historique — partiellement remplacé (`superseded`)** : [ADR-0008](0008-shadcn-geist-montech.md) remplace la typographie, les tokens et les composants de cette décision par le preset shadcn et les fontes Geist/Montech demandés ensuite. La composition ouverte, les guides réels et le retrait des visuels rejetés restent applicables. Le texte ci-dessous conserve la décision initiale.

Après rejet de la refonte précédente, l’utilisateur demande de se baser intégralement sur son [document xAI](../references/xai-style-reference.md), conservé tel que fourni. Ce document remplace la direction visuelle d’ADR-0006 ; le partage de composants entre Astro, Wallet et équipe décidé dans ADR-0006 reste acquis.

Appliquer les tokens, typographies, espacements et composants de cette référence : titres regular, monochrome, boutons noirs en pilule, surfaces crème et faible densité. Les fontes propriétaires non fournies sont remplacées par Inter et Geist Mono, substitutions explicitement permises dans le document. Le petit texte essentiel utilise Steel, rôle de corps de texte présent dans la palette, pour rester lisible.

Supprimer du rendu la photographie/3D et les illustrations bleues rejetées. Utiliser HTML/CSS pour la composition éditoriale et les visuels de guides réels. Aucune capture de compte fictif, chiffre inventé ou interface qui prétend activer une fonctionnalité absente. Les grandes sections restent ouvertes ; les surfaces crème fermées sont limitées aux courts bentos illustrés. Aucun faux terminal ne sera ajouté à un site d’assurance au seul motif que la référence en contient.

La source exécutable du système reste `packages/ui`. La stack, le contenu métier, les permissions, le non-indexage local et les décisions WorkOS restent inchangés.
