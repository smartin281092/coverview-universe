# Comparateur du 23 octobre 2026 — questionnaire masqué, accident exclu, modèles conseillés

Entrée : demande de l’utilisateur du 23 octobre 2026 sur le comparateur maladie : masquer, au moins temporairement, le questionnaire d’aide au choix du modèle ; exclure la couverture accident du profil de base ; dans la liste des modèles, un tag rose avec couronne de laurier (image fournie, « Best »), libellé « Recommandation ». Il porte sur le premier modèle Groupe Mutuel ou Assura de chaque région, « pas les autres compagnies comme je n’ai pas encore les conventions » ; exemples : Assura MedTel en Vaud 1, Groupe Mutuel Sanatel en Vaud 2 (premier résultat). Puis, en cours de travail : « C’est trop long recommandation, que recommandes-tu comme texte plus court ? Et ajoute aussi cet icone dans la liste lorsqu’on survole une zone si Assura ou Groupe Mutuel figure dedans. » Mandat PROG-23. Session réelle : Claude Code, Claude Opus 5.5, effort max.

## Décisions déléguées (PROG-23)

| ref | question | answer | evidence |
|---|---|---|---|
| C-1 | Masquer le questionnaire ? | Constante `guideEnabled = false` dans `HealthComparator` : ni questions, ni classement propre. Son option « Comparer aussi les autres franchises » et la note pour les résidents étrangers disparaissent avec lui, car ils ne servent qu’à lui (G-06). L’API reste disponible ; réactiver = passer la constante à `true`. | Demande |
| C-2 | Accident exclu ? | Exclu dans le profil de base et pour chaque personne ajoutée ; le choix du contrat 2026 l’excluait déjà depuis le 20 octobre. | Demande |
| C-3 | Quel modèle porte le tag ? | Dans chaque liste (région suisse ou pays de résidence), le premier modèle de Groupe Mutuel (Avenir, Mutuel, Philos, même regroupement que le 20 octobre) ou d’Assura (Assura-Basis). Calculé par l’API sur toute la liste filtrée, dans l’ordre affiché, jamais sur la seule page (G-11) ; les filtres s’appliquent ; jamais d’autre compagnie. Règle health.partner.1. | Exemples de l’utilisateur retrouvés (journal 3) |
| C-4 | Texte plus court ? | « Conseillé », recommandé à l’utilisateur : sens conservé, moitié plus court, sans prétendre au meilleur modèle. Alternatives : « Recommandé », « Top ». Info-bulle : « Premier modèle de cette liste chez une compagnie partenaire de CoverView. » | Demande |
| C-5 | Icône ? | La couronne dessinée par l’utilisateur, vectorisée depuis son dessin (trait #FE4A77, remplissage du même rose à 29 %), 12 px. L’icône d’efficient.app, issue d’une bibliothèque payante (Nucleo), n’est pas reprise. Texte du tag non gras, couleurs du tag de référence : texte #FE4A77, bordure #FACAD7, fond #F9F0F3. | Dessin et tag de référence échantillonnés |
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
| 5 | Couronne dessinée | dessin agrandi et version vectorielle côte à côte ; comparateur local | tracé conforme au dessin ; tag « Conseillé » en graisse 400, #FE4A77, icône 12 px ; laurier sur MediTel en Vaud 1 (liste et carte), pas sur PharMed | déploiement sur demande |

## Suite du 23 octobre 2026 — fiche modèle, mobile et carte

Entrée : « Ajoute un peu de padding dans les tabs […] ; Dans données rajoute l’info : Tiers payant Oui (ils sont tous en tiers payant […]) ; Ajouter sur la page d’un modèle la liste des premiers point de contact exact […] ; Quand on est sur mobile et qu’on a choisi notre assurance de base actuelle et/ou qu’on rapetisse la petite fenêtre de sélection de profil : ouvrir la fenêtre avec la liste des modèles […] ; La carte est trop lente […] Que proposes-tu ? »

| ref | question | answer |
|---|---|---|
| C-7 | Tiers payant ? | Affirmation de l’utilisateur : tous les modèles. Ligne « Paiement des frais : Avancés par la caisse » avec info-bulle (tiers payant expliqué simplement). À confirmer : la LAMal (art. 42) prévoit le tiers garant sauf convention ; si un modèle ou un canton fait exception, la ligne devra dépendre des données. |
| C-8 | Premiers contacts ? | Carte en tête de fiche : contacts vérifiés pour 2027 avec une phrase par contact ; sans liste vérifiée, le type de modèle et « Parcours précis à confirmer pour 2027 » (24 modèles sur 105 vérifiés en Vaud 1). |
| C-9 | Mobile ? | Profil replié (− ou Terminer) ou assurance actuelle choisie : liste de la région si elle est connue (localité, carte, géolocalisation), sinon bulle bleue « Touchez la carte pour choisir votre région ». |
| C-10 | Lenteur de la carte ? | Cause mesurée : le filtre d’ombre SVG recalculé à chaque image. Il quitte la carte pendant le mouvement. La carte 3D est une proposition soumise à l’utilisateur. |

| # | cible | oracle | résultat |
|---|---|---|---|
| 6 | Fiche modèle | navigateur intégré | onglets aérés ; « Avancés par la caisse » et son info-bulle ; Favorit Medpharm : Pharmacie, Télémédecine, Application / vidéo ; MediTel : Télémédecine, à confirmer |
| 7 | Téléphone (375 px) | navigateur intégré | sans région : bulle affichée, liste fermée ; après la localité 1003 : liste ouverte au repli, bulle absente. Choix de l’assurance actuelle : même fonction, non exercé |
| 8 | Carte | 80 images de zoom à la molette | avant : médiane 19,9 ms, p90 27,2, max 47,6 ; après : 16,7, 17,5, 24,8 ; aucune image en mouvement avec ombre, ombre revenue au repos |

