# Landing 3a — direction premium et animations

Mandat explicite du 19 septembre 2026 : réaliser la landing dans le site existant à partir du texte joint, avec références Ramp, Awesomic, Skiper37, Bklit, ShaderGradient et Animmaster. Exécution autorisée par la demande et la préférence d’autonomie ; pas de nouvelle slice concurrente.

## Objectif et choix

- Remplacer uniquement l’accueil public par un parcours éditorial premium, responsive, français, servi en HTML Astro.
- Conserver Lausanne/Montech, le logo et la carte Wallet fournis. Direction propre à cette page : blanc/crème, encre, accent bleu et halos doux, grande typographie, illustrations de données en mouvement et perspective 3D CSS. Aucun changement du thème applicatif.
- Couvrir les douze intentions du brief avec compositions variées. Les volumes de benchmark, performances historiques et témoignages n’ont pas de preuves fournies : utiliser méthode vérifiable et cas explicitement illustratifs ; aucun chiffre commercial inventé.
- Simulateurs mathématiques locaux : versements de fin de mois à taux annuel effectif et actualisation par inflation. Hypothèses, risque, frais et limites visibles.
- L’audit documentaire anonyme complet n’existe pas dans le dépôt. Le CTA ouvre un choix explicite entre les documents de Wallet (connexion requise) et une simulation sans compte, sans téléversement factice ni collecte nouvelle.

## Périmètre

`apps/www` : contenu français, composants de landing, calculs et animation, styles isolés, accueil ; extension optionnelle du Layout pour navigation ciblée. Plan et ledger dédiés. Préserver tous les changements préexistants, notamment API/Wallet/Admin et roadmap de S-042a.

Règles chargées : marketing-web, frontend (interaction), brand, i18n, seo, geo, codex. G-06/13/18, MKT-03/04/06, FRONT-12/14, INTL-01/04. Aucun schéma, permission, événement, job, secret, migration ou dépendance ajouté. Les fonds et la 3D utilisent CSS, SVG et animations locales ; ne pas installer toutes les bibliothèques de référence.

## Vérifications

1. Types Astro/TypeScript, lint ciblé, build et contrôle SEO/budgets existant.
2. Tests utiles des équations : taux nul, zéro versement, valeurs de référence et bornes.
3. Recette navigateur : bureau et mobile, compteurs/graphiques, curseurs et champs numériques synchronisés, CTA et dialogue avec Échap/restauration du focus, FAQ, liens, absence de débordement et console.
4. Mouvement réduit, pause des animations, HTML initial lisible, aucun faux témoignage/rendement.

## Journal

- 22 septembre, extension demandée aux pages publiques et miroirs Markdown : retirer les mentions de rédaction assistée, validation éditoriale et documentation interne des surfaces destinées aux prospects ; réécrire les cas, le rapport et les pages annexes pour expliquer le bénéfice et la prochaine étape. Conserver la qualification des exemples fictifs, les limites utiles des simulations et la disponibilité réelle des parcours. Les sources de travail restent dans les métadonnées internes. Vérifier les 18 miroirs, les liens, le build, les types et le rendu de la page de maintien. Aucune publication ni modification des applications privées.
- Extension terminée : gabarit et miroirs nettoyés, pages annexes relues, parcours reliés aux simulateurs et à Wallet, grille de service remplacée par des questions utiles au prospect. Vérifiés : types, lint, build, quatre tests de validation éditoriale, 41 pages / 18 miroirs / 1068 liens et rendu mobile du maintien et de la grille. Détail dans le ledger, section « Pages annexes et miroirs — 22 septembre ».

- Révision éditoriale : à la demande utilisateur, voix directe de CoverView et copywriting centré sur bénéfices, réassurance et prochaine étape. Relire hero, rapport, méthode, résultats, Wallet, FAQ et dialogue d’entrée. Conserver les informations de période, risque et simulation ; distinguer accès libre aux simulateurs et connexion Wallet. Vérification du contenu rendu, responsive, lint/build/check-www ; aucune fonctionnalité nouvelle ni conversion mesurée revendiquée.
- Révision éditoriale terminée : textes orientés visiteur sur toute la landing, réassurance mobile adaptée, aperçu rechargé et contrôlé. Lint, build et `check-www` réussis ; détail du nouvel essai de build à parallélisme réduit dans le ledger. Aucun gain de conversion revendiqué sans mesure.

- 22 septembre : intégrer les sept captures fournies, le statut de courtier indépendant non lié déclaré par l’utilisateur et les sorties attendues du rapport retraite. Remplacer le cas générique par des résultats de captures et leurs périodes, avec sources en dialogue. La vue History (21,34 % p.a., 295,40 %) est explicitement rétrospective, pas un rendement client réalisé. Les vues Performance restent distinctes, sans moyenne, nombre de clients déduit, attribution causale ou traitement des frais inventé. Exemples 3’000 CHF/mois et 123 ans pédagogiques, hypothèses accessibles ; aucun moteur de retraite ni audit anonyme ajouté. Recette : fidélité aux captures, bureau/mobile, dialogues/clavier/pause, types/build/check-www. Périmètre local `www` et documentation.
- Révision du 22 septembre terminée : captures et périodes transcrites, section de résultats et deux dialogues, positionnement indépendant, suivi actif des allocations et aperçu du rapport. Vérifications des calculs, lint, types (55 fichiers), build et `check-www` réussis ; bureau/mobile 1440/390/320, focus/Échap/pause vérifiés. [Ledger](../evidence/landing-3a-premium.md#révision-du-22-septembre--captures-indépendance-et-rapport-retraite).

- Nouvelle demande : H1 sur deux lignes, roue moins large et davantage inclinée. Retirer CSS/Helsana/Assura, remplacer Baloise par la nouvelle identité Helvetia, ajouter les onze marques nommées. Sources officielles et provenance des nouveaux logos ; conserver l’opacité selon la profondeur et les contrôles de mouvement. Géométrie ajustée aux seize cartes sans chevauchement.
- Terminé : seize marques locales, H1 sur deux lignes et couronne plus compacte/inclinée, vérifiés à 1519, 1024, 390 et 320 px. Lint, Astro Check, build et `check-www` passent sans adaptation de l’oracle. [Preuves de cette révision](../evidence/landing-3a-premium.md#révision-utilisateur--roue-compacte-seize-marques-et-titre-sur-deux-lignes).

- Ajustement demandé ensuite : hypothèse B à 16 % (plafond des deux taux porté à 20 %), objectif Wallet enrichi, seconde phrase/ligne des titres en `lab(2.83994 0.367254 0.969091 / 0.6)`, hero remplacé par une couronne 3D inclinée de logos locaux avec opacité calculée selon la profondeur. Les 16 % restent une hypothèse de calcul ; aucune série historique Hyperion n’a été fournie. Le composant conserve la pause et la réduction des mouvements. Même périmètre local, pas de publication.
- Ajustement terminé et vérifié : huit logos réutilisés avec provenance, pause de la roue, champs/graphique à 16 %, couleur Lab exacte, rendu bureau/mobile. Lint, types (51 fichiers), build, trois tests et contrôle www passent. [Preuves de la révision](../evidence/landing-3a-premium.md#révision-utilisateur--16--wallet-titres-et-couronne-3d).

- Inspection : l’accueil existant et ses routes éditoriales sont statiques ; GSAP existe déjà mais les mouvements simples peuvent rester natifs. Carte PNG fournie inspectée. Audit sans compte indisponible selon acquisition.ts ; route Wallet /documents existante.
- Session : GPT-6 ; effort non observable indépendamment.
- Réalisé : les douze intentions du brief sont composées dans une landing Astro dédiée, avec carte 3D CSS, animations locales et deux simulateurs mathématiques ; contenu métier prudent et CTA relié aux parcours réels.
- Vérifié : types/lint/build, trois tests des équations, `check-www`, bureau/mobile 390 et 320 px, pause et dialogue, FAQ, saisies et curseurs. Le défaut observé du dialogue invisible en pause est corrigé et couvert par l’oracle.
- Oracle adapté explicitement : un module local autorisé sur l’accueil, FAQ natives, même seuil JS appliqué aux ressources chargées par gabarit ; détails et limites dans le [ledger de livraison](../evidence/landing-3a-premium.md).
- Livraison locale terminée ; aucune dépendance, migration ni modification de la slice S-042a. Pas de publication ni d’audit documentaire anonyme ajouté.
