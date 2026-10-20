# Retours du 20 octobre 2026 — profil et choix du modèle actuel du comparateur

Entrée : demande de l’utilisateur du 20 octobre 2026 (neuf points, capture d’une superposition). Mandat PROG-23 : meilleurs défauts consignés, sans GO répété. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| D-1 | Marge de la date de naissance ? | 18 px, comme la franchise annuelle. | Demande explicite |
| D-2 | Profil déplié ? | Sur téléphone, il descend jusqu’au bas de l’écran avec le même écart que sur les côtés (14 px). Sur ordinateur, sa hauteur s’arrête à 24 px du bas, l’écart latéral. | « La popup arrive jusqu’en bas de l’écran en gardant le même espace que sur les côtés » |
| D-3 | En-tête du profil ? | « Votre profil » et son bouton restent visibles ; le contenu défile dessous. | Demande explicite |
| D-4 | Format de la date de naissance ? | Champ texte `jj.mm.aaaa` (jour d’abord, points suisses), quelle que soit la langue du navigateur ; chiffres seuls, points ajoutés en tapant, barre oblique acceptée. Une date incomplète ou impossible ne compte pas. | « Jour avant le mois », exemple « 01.01.1990 » ; le champ date natif suit la langue du navigateur |
| D-5 | Date par défaut ? | 01.01.1990 : les prix s’affichent tout de suite. Une demande d’offre ne reprend qu’une date saisie par la personne ; sinon elle garde l’année 1990 modifiable, comme avant. | Exactitude des demandes (priorité 1) |
| D-6 | Superposition dans la fenêtre ? | Les règles de placement du profil sur téléphone ne s’appliquent plus aux champs de la fenêtre de choix, rendue à l’intérieur du profil. | Capture : « Franchise annuelle » et « Couverture accident » empilés |
| D-7 | Couverture accident du contrat actuel ? | Exclue par défaut à l’ouverture de la fenêtre, sauf contrat déjà choisi. | Demande explicite |
| D-8 | Groupe Mutuel ? | Avenir, Mutuel et Philos forment une seule entrée « Groupe Mutuel » (même logo officiel dans nos sources) ; ses modèles sont listés ensemble, les moins chers de la région d’abord, chacun avec sa compagnie. AMB reste à part : rien dans nos sources ne la rattache au groupe. | « Avenir, Mutuel ou Philos se partagent des régions » |
| D-9 | Prix des modèles ? | Affichés dans la liste (date par défaut) et triés du moins cher au plus cher, pour toutes les compagnies. | Demande explicite |
| D-10 | Images des modèles ? | Image du même modèle en 2027 (même compagnie, même code de tarif), comme pour la référence 2027 ; sans image, le logo reste. Contrat d’API : ajouts `nextModelId` et `group`, champs existants inchangés. | Demande explicite ; G-12 |
| D-11 | Bloc des réglages du contrat dans la fenêtre (suite du même jour) ? | Sans encadré ni fond : franchise, couverture accident et localité posées sur la fenêtre, marges conservées. | Demande explicite |
| D-12 | Cartes des compagnies et des modèles ? | Fond blanc, bordure conservée ; le survol reste marqué. | Demande explicite |
| D-13 | En-tête des fenêtres en défilement ? | Titre et croix de fermeture toujours visibles, le contenu passant dessous, pour toutes les fenêtres du comparateur (même composant ; aucune n’a d’autre élément collant). | « Votre compagnie en 2026 et la croix toujours visibles » |

## Definition of Done — oracles

- [x] API : modèle 2027 et groupe renvoyés — V2 (test sur PostgreSQL réel) (journal 1).
- [x] Profil, date, fenêtre de choix sur ordinateur et à 375 px — V3 (navigateur intégré) (journal 3, 4).
- [x] Types, lint, build du site (journal 2).

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | API | `health.current.test.ts` sur PostgreSQL réel | 10/10 : modèle 2026 relié à son modèle 2027 de même code de tarif, aucun sans équivalent, `hfm_2027_…` à l’étranger ; groupe porté par une compagnie du Groupe Mutuel seulement | — |
| 2 | Contrôles | `tsc` du site, de l’API, des contrats, de Wallet, Admin, Partner et des paquets partagés ; ESLint ; `astro check` ; build du site ; contrôle de `.env.example` | verts ; 45 pages ; le contrôle exigeait aussi `RESEND_API_KEY` et `MAIL_FROM` (ajoutés le 16 octobre sans exemple), documentés | — |
| 3 | Ordinateur | navigateur intégré, preview locale | profil à 24 px du bas comme du côté, titre fixe, contenu défilant ; marge de la date 18 px ; 01.01.1990, invite jj.mm.aaaa ; 31.02.1990 refusé avec message ; 15/08/1985 devient 15.08.1985 ; fenêtre : accident « Exclue » ; une seule entrée Groupe Mutuel ; ses 12 modèles de 443,80 à 516,80 CHF, chacun avec sa compagnie et l’image du produit | — |
| 4 | Téléphone | 375 × 812 puis 375 × 600 | profil à 14 px du bas et des côtés, sans défilement horizontal ; contenu défilé de 121 px sous le titre immobile ; fenêtre : franchise et couverture accident côte à côte, plus de superposition | iPhone réel à confirmer |
| 5 | Production | version 260396c, curl et navigateur intégré | API : Avenir, Mutuel et Philos groupés, équivalent 2027 pour 89 modèles sur 105 (Vaud 1) ; page : 01.01.1990 et marge de 18 px, accident exclu, Groupe Mutuel unique, modèles triés de 443,80 CHF avec compagnie et image | iPhone réel à confirmer |
| 6 | Encadré et cartes (D-11, D-12) | navigateur intégré, preview locale | bloc des réglages : fond transparent, sans marge intérieure ni arrondi ; cartes : fond blanc, bordure #ececef | mise en production sur demande |
| 7 | En-tête collant (D-13) | navigateur intégré, ordinateur et 375 px | après 900 px (ordinateur) et 700 px (téléphone) de défilement, titre et croix au même endroit, sur toute la largeur, cartes dessous, sans débordement horizontal | mise en production sur demande |
