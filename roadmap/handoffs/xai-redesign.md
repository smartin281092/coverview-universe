# Reprise visuelle xAI — 6 septembre 2026

## Mandat

L’utilisateur rejette la version `f8e1e07` et fournit une référence xAI précise, à suivre entièrement visuellement. Source intacte : `references/xai-style-reference.md` ; décision : ADR-0007. Aucun nouveau test de surface, smoke test ou fixture. Les capacités d’identité non vérifiées restent ouvertes ; ne pas confondre refonte et fonctionnement WorkOS.

## Exécution

1. Porter les tokens et fontes de substitution autorisées dans `packages/ui`, adapter boutons, états, titres et layouts des apps. Agent recovery_visual_audit possède UI/client/admin, root installe les dépendances et tient le lockfile.
2. Recomposer le site : nav compacte, hero centré fin, deux courts bentos crème avec visuels éditoriaux réels, méthode, index de lectures, FAQ puis action finale. Root possède www pages/composants/CSS ; agent public_recovery possède uniquement marketing.ts pour raccourcir et préparer les nouveaux objets.
3. Retirer la 3D et les illustrations bleues. Construire les illustrations en HTML/CSS, sans faux résultat ou produit prétendument disponible. Reprendre les pages secondaires, l’orientation, le compte et l’image sociale avec le même vocabulaire.
4. Lire les rendus réellement servis sur ordinateur/mobile et suivre les actions éditoriales ; compiler, typer et vérifier le lint. Corriger les écarts à la référence, sans créer de suite de surface.
5. Consigner le résultat réel, préserver les changements en Git et laisser la preview disponible. Aucun push, déploiement ni nouvelle slice artificiellement débloquée.

## Continuité

WorkOS : callback exact et Magic Auth déjà enregistrés, API précédemment désactivée en attente de saisie de la clé dans le lanceur masqué. Aucune connexion réelle, OTP ou MFA validé. Cette dépendance ne bloque pas la refonte et ne doit pas entraîner une nouvelle demande de confirmation des réglages déjà autorisés.

## Résultat

Refonte réalisée sur les trois frontends. La revue indépendante a conduit à ajuster l’échelle typographique mobile ; captures finales relues. Résultats, dépendances et limites dans [le ledger courant](../evidence/xai-redesign.md). L’identité reste en cours selon la continuité ci-dessus ; aucune nouvelle slice ouverte.
