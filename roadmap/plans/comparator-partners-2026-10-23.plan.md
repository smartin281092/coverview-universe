# Comparateur du 23 octobre 2026 — questionnaire masqué, accident exclu, modèles conseillés

Entrée : demande de l’utilisateur du 23 octobre 2026 sur le comparateur maladie : masquer, au moins temporairement, le questionnaire d’aide au choix du modèle ; exclure la couverture accident du profil de base ; dans la liste des modèles, un tag rose avec couronne de laurier (image fournie, « Best »), libellé « Recommandation ». Il porte sur le premier modèle Groupe Mutuel ou Assura de chaque région, « pas les autres compagnies comme je n’ai pas encore les conventions » ; exemples : Assura MedTel en Vaud 1, Groupe Mutuel Sanatel en Vaud 2 (premier résultat). Puis, en cours de travail : « C’est trop long recommandation, que recommandes-tu comme texte plus court ? Et ajoute aussi cet icone dans la liste lorsqu’on survole une zone si Assura ou Groupe Mutuel figure dedans. » Mandat PROG-23. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| C-1 | Masquer le questionnaire ? | Constante `guideEnabled = false` dans `HealthComparator` : ni questions, ni classement propre. Son option « Comparer aussi les autres franchises » et la note pour les résidents étrangers disparaissent avec lui, car ils ne servent qu’à lui (G-06). L’API reste disponible ; réactiver = passer la constante à `true`. | Demande |
| C-2 | Accident exclu ? | Exclu dans le profil de base et pour chaque personne ajoutée ; le choix du contrat 2026 l’excluait déjà depuis le 20 octobre. | Demande |
| C-3 | Quel modèle porte le tag ? | Dans chaque liste (région suisse ou pays de résidence), le premier modèle de Groupe Mutuel (Avenir, Mutuel, Philos, même regroupement que le 20 octobre) ou d’Assura (Assura-Basis). Calculé par l’API sur toute la liste filtrée, dans l’ordre affiché, jamais sur la seule page (G-11) ; les filtres s’appliquent ; jamais d’autre compagnie. Règle health.partner.1. | Exemples de l’utilisateur retrouvés (journal 3) |
| C-4 | Texte plus court ? | « Conseillé », recommandé à l’utilisateur : sens conservé, moitié plus court, sans prétendre au meilleur modèle. Alternatives : « Recommandé », « Top ». Info-bulle : « Premier modèle de cette liste chez une compagnie partenaire de CoverView. » | Demande |
| C-5 | Icône ? | Couronne de laurier originale (feuilles des deux côtés de chaque branche). L’icône fournie d’efficient.app vient d’une bibliothèque payante (Nucleo, classe `nc-icon-wrapper`), dont la licence ne couvre pas CoverView : non reprise. | Sprite fourni |
| C-6 | Survol d’une zone ? | Laurier seul, libellé « Conseillé » pour les lecteurs d’écran, à côté du modèle conseillé quand il figure parmi les trois primes les plus basses de la région. | Même liste ordonnée que C-3 |

## Definition of Done — oracles

- [x] Règle du tag : régions suisses, pagination, filtres, pays étrangers — V2 (journal 1).
- [x] Typecheck, lint, formatage des fichiers touchés — V0 (journal 2).
- [x] Exemples de l’utilisateur sur les primes 2027 locales — V3 API (journal 3).
- [x] Rendu dans le navigateur intégré : accident exclu, sans questionnaire ni son option, tag dans la liste, laurier dans la carte — V3 (journal 4).
- [ ] Mise en production et revue du titulaire — V5.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | Règle health.partner.1 | `health.recommended.test.ts` (Testcontainers) et `health.current.test.ts` | 13/13 : premier modèle partenaire seulement, même hors de la page affichée, filtres appliqués, aucune autre compagnie, pays de résidence | — |
| 2 | Statique | `tsc` (www, api, partners, client, admin, api-client, contracts), ESLint, Prettier sur fichiers propres à HEAD | verts | — |
| 3 | Données 2027 locales | `POST /health-insurance/compare`, adulte 1990, franchise 2500, accident exclu | Vaud 1 : Assura MediTel, 1er ; Vaud 2 : Philos SanaTel (Groupe Mutuel), 1er ; Genève : Assura QualiMed, 1er | — |
| 4 | Comparateur local | navigateur intégré, `127.0.0.1:4103` | « Exclue » sélectionné par défaut ; liste de Genève sans questionnaire, QualiMed tagué « Conseillé » avec laurier ; carte de Genève : laurier sur QualiMed seul (PharMed, second Assura, sans) ; filtres sans l’option de franchises | déploiement sur demande |
