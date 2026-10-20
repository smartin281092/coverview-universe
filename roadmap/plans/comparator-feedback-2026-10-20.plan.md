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

## Definition of Done — oracles

- [ ] API : modèle 2027 et groupe renvoyés — V2 (test sur PostgreSQL réel).
- [ ] Profil, date, fenêtre de choix sur ordinateur et à 375 px — V3 (navigateur intégré).
- [ ] Types, lint, build du site.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
