# Fiche modèle éditable et écarts animés — 3 octobre 2026

Mandat utilisateur direct, poursuite autonome. [Plan](../plans/health-model-editing.plan.md). Session : Codex GPT-6, effort non observable. Livraison dans le workspace local ; aucun déploiement ni commit global des travaux préexistants.

## Vérifié

- WWW : retrait des notices de disponibilité/réseau/socle LAMal, du lien Priminfo, du type de modèle et du total des primes annuelles dans Données. Région (ou pays), franchise et accident emploient le Select partagé avec Wallet. L’année reste 2027, affichée dans un sélecteur désactivé ; aucun rapprochement silencieux avec les modèles 2026.
- Le client relit les tarifs via le serveur existant, pour le même identifiant de modèle et d’assureur, avec pagination bornée. Aucun remplacement par un autre modèle. Annulation et compteur de génération protègent les modifications rapides et la fermeture. Prix et CTA précédents sont masqués/inertes pendant la résolution, leur espace est conservé. La référence personnelle 2026 demeure inchangée.
- Trois chevrons décoratifs à opacités alternées accompagnent l’écart serveur : baisse verte vers le bas, hausse rouge vers le haut, égalité sans chevrons. Fiche, liste simple/personnalisée et popup utilisent le même composant. Réduction des animations prévue par CSS. Le badge « Le moins cher » reste dans la fiche et disparaît des listes.
- La carte demande aussi les écarts des trois offres de chaque région. La hauteur de la popup est observée pour éviter la découpe constatée après ajout de cette information. Alignement mobile des chevrons corrigé après inspection visuelle.

## Oracles

- Astro Check : 89 fichiers, zéro erreur, avertissement ou hint. ESLint ciblé passé. Build WWW : 45 pages ; avertissement Vite préexistant sur un chunk supérieur à 500 kB, aucun seuil désactivé.
- Vitest : 3 nouveaux tests du lookup, passés. Pagination et conservation de l’identité, absence de substitution (autre modèle/autre assureur), abort avant requête et arrêt d’une pagination non progressive. Ces tests écrits dans la tâche ne constituent pas une revue indépendante.
- Navigateur réel, 1280 × 720 et 390 × 844, naissance fictive 01.01.1990 et référence Assura 2026 à 540,90 CHF/mois : MediTel VD-1 avec franchise 2500/accident inclus = 459,10 ; passage à 300 = 587,40 et +558 CHF/an rouges ; exclusion de l’accident = 546,30 ; Genève = 595,30 ; Appenzell R.-Int. = 354,20. Sur mobile, retour à VD-1, franchise 2500 sans accident = 427,00 et 1366,80 CHF économisés/an verts, puis accident inclus = 459,10 et 981,60 CHF/an. Le profil principal suit les nouveaux paramètres ; le contrat 2026 conserve franchise 2500 et accident inclus.
- Popup carte avec trois écarts rouges contrôlée visuellement, puis hauteur corrigée et contenu complet revérifié. Liste mobile sans badge, chevrons à gauche et fiche avec dropdowns contrôlées. Ouverture du parcours d’offre MediTel vérifiée ; aucun compte, panier persistant ou demande créé.

## Limites et exploitation

- Pas de fichier/nœud Figma fourni : les menus réutilisent le composant existant du design system, sans prétendre à une reproduction d’une maquette inaccessible. Année 2027 conservée selon le périmètre courant, après question facultative et annonce de ce choix. Une navigation historique exigerait un rapprochement explicite des modèles et conditions de chaque millésime.
- Cas indisponible et échec réseau implémentés avec message et sans prix actionnable ; absence de substitution couverte par tests. Ces états et les changements de pays frontaliers n’ont pas fait l’objet d’une recette navigateur exhaustive. La transmission de tous les champs au checkout a été relue ; aucune demande complète n’a été soumise.
- Aucune migration, dépendance, variable d’environnement, règle financière serveur, autorisation, événement, room ou job ajouté. Paramètres de simulation en mémoire de session ; les échanges utilisent les POST existants, sans profil dans les URL.
- Le contrôle Git global signale des espaces/fins de ligne dans des fichiers Admin/Wallet préexistants hors périmètre. Contrôle ciblé des composants modifiés effectué séparément ; ces autres fichiers restent intacts. Le socle API/contrats actuel comporte déjà des fichiers non versionnés : la validation porte sur le workspace, pas sur un checkout vierge.
- Retour arrière : retirer les contrôles et le lookup client, remettre la présentation précédente ; aucune opération de base nécessaire. Piste suivante facultative : navigation historique des fiches, après définition du rapprochement interannuel ; aucun engagement de réalisation ajouté.

## Ajustement de taille

Demande suivante : chevrons réduits de moitié, de 16 × 24 à 8 × 12 px dans le composant commun. Vérifié par lecture des dimensions et des consommateurs (fiche, listes et popup), lint ciblé passé. Animation et couleurs conservées ; pas de nouvelle recette navigateur pour cette modification de dimensions.
