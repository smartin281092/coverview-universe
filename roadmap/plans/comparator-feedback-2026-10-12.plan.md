# Retours du 12 octobre 2026 — comparateur d’assurance maladie

Entrée : demande de l’utilisateur du 12 octobre 2026 (sept points). Mandat PROG-23 : meilleurs défauts consignés, sans GO répété. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| C-1 | Ordre du profil ? | Assurance actuelle, puis franchise annuelle, puis date de naissance, sexe, couverture accident. | « Déplace la sélection de l’assurance actuelle au-dessus de la date de naissance », « la franchise juste en dessous » |
| C-2 | Réglages du contrat actuel ? | Franchise, couverture accident et localité toujours visibles dans la fenêtre de choix, hors repli ; les mentions « Configuration de votre contrat 2026 » et « Elle reste indépendante des paramètres des offres 2027 » disparaissent. | Demande explicite |
| C-3 | Référence des écarts ? | Le même modèle au tarif 2027 : même compagnie et même code de tarif (les identifiants de modèle changent chaque année ; 133 modèles 2026 sur 156 ont un tarif 2027), pour la tranche d’âge de la personne en 2027, dans la région du contrat (la commune choisie est résolue dans les régions 2027), avec sa couverture accident et sa franchise. Une franchise d’enfant devenue invalide en 2027 passe à la franchise ordinaire de 300 CHF. | « Différence de prix par rapport au modèle actuel mais avec sa tarification 2027 », « par rapport à sa tarification selon son âge en 2027 » |
| C-4 | Modèle sans tarif 2027 ? | Sa prime 2026 reste la référence, dite comme telle (« votre prime 2026, ce modèle n’ayant pas de tarif 2027 »). | Défaut réversible : 23 modèles 2026 sur 156 sans équivalent 2027 |
| C-5 | Prix affichés pour le contrat actuel ? | La fenêtre de choix garde les primes 2026 (la personne y reconnaît son contrat) ; la carte « Mon assurance actuelle » montre la prime 2026 et la prime 2027 du modèle, et signale un changement de tranche d’âge. | Interprétation de « afficher les modèles et résultat par rapport à sa tarification selon son âge en 2027 » |
| C-6 | Contrat d’API ? | Évolution additive : `baseline` et `baselineYear` ajoutés, champs existants inchangés (un ancien site en cache reste lisible). | G-12 |
| C-7 | Date de naissance sur téléphone ? | Le champ date ne dépasse plus la colonne (apparence native retirée, largeur bornée) : aucun défilement horizontal. | Chrome sur iPhone |
| C-8 | Zoom de la carte sur petit écran ? | Échelle de départ selon la largeur de la carte : 2,5 sous 520 px, 1,6 sous 900 px, 1 au-delà ; même échelle pour le recentrage et le choix d’une localité ; une vue déjà déplacée n’est pas réinitialisée. | « Beaucoup plus zoomée sur petit écran » |

## Definition of Done — oracles

- [x] Écarts calculés contre le tarif 2027 du modèle actuel, tranche d’âge 2027, repli 2026 explicite — V2 (test de l’API sur la vraie base) et V3 (navigateur) (journal 1–3).
- [x] Profil réordonné, réglages du contrat visibles, mentions retirées — V3 (journal 2).
- [ ] Aucun défilement horizontal à 375 px, carte zoomée sur téléphone — V3 fait (journal 4) ; iPhone réel (V5) à confirmer par l’utilisateur.
- [x] Types, lint, build, tests touchés (journal 1, 5).

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Calcul de référence | `health.current.test.ts` sur PostgreSQL réel (Testcontainers) | 9/9 : référence 2027 du même modèle, passage de 25 à 26 ans, enfant devenu jeune adulte (franchise 300), commune qui change de région en 2027, repli 2026 sans tarif 2027, étranger au tarif 2027 du même assureur | — |
| 2 | Comparateur, bureau | navigateur intégré sur la preview | profil : assurance actuelle, franchise, date de naissance, sexe, accident ; fenêtre de choix : franchise, accident et localité visibles, les deux mentions absentes ; CSS Callmed : 2026 514,40, 2027 560,10 CHF / mois | — |
| 3 | Écarts affichés | liste de la région VD-1 et page d’un modèle | référence « Votre modèle actuel au tarif 2027 · CSS · Callmed · 560,10 » ; HMO 456,00 → 1 249,20 CHF économisés / an (contre 700,80 avec la prime 2026) ; page du modèle « par rapport au tarif 2027 de votre modèle actuel » ; née en 2001 : 2026 353,70 (jeune adulte), référence 2027 560,10 (adulte), note de nouvelle catégorie | — |
| 4 | Téléphone (375 px) | largeur mobile du navigateur intégré | largeur de défilement 375 = largeur ; champ date 315 px = sa colonne, apparence native retirée ; carte : 1er essai à l’échelle 1 (largeur mesurée seulement par ResizeObserver, muet dans un onglet caché), mesurée aussi au montage, puis échelle 2,5 centrée sur la Romandie | iPhone réel à confirmer (WebKit) |
| 5 | Contrôles | `tsc` API et contrats, `astro check`, ESLint, build du site (45 pages) | verts | — |
