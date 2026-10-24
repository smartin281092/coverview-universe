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

## Suite du 24 octobre 2026 — page d’un modèle

Entrée : « Dans le panneau (qu'on va appeler page) d'un module : Le bloc Votre premier contact : Enlever le fond bleu. Remplacer votre premier contact par Premier contact (tout en majuscule avec la font futuriste de wallet pour les surtitre) en petit. Ne pas mettre des parcours combiné mais exactement à quoi ça correspond […]. Augmenter la vitesse d'animation des shaders dans les CTA (valable pour tous les CTA partout). Enlever les mentions du style : Parcours précis à confirmer pour 2027. Ca ne fait pas sérieux. Mettre sous les prix juste au dessus de Demander une offre : CoverScore […] Service client, Avis, Qualité et 10 petites barres […] il faut que globalement Assura et Groupe Mutuel soient les meilleures notées (aucune data encore ne vient déterminer les notes […] ne pas mettre d'indication à ce sujet […]) »

| ref | question | answer |
|---|---|---|
| C-11 | Bloc premier contact ? | Sans fond ; titre « PREMIER CONTACT » en surtitre MONTECH V.02 (police des surtitres du Wallet, `--cv-font-mono`), 10 px, espacement 1 px, gris #6b7280 ; pastilles d’icônes gris clair. |
| C-12 | « Parcours combiné » ? | Chaque modèle affiche les premiers contacts que documentent les pages officielles de l’assureur (recherche du 4 octobre 2026, `review-c.json`), désormais portés par le catalogue pour les 115 modèles non confirmés pour 2027. `verifiedYear` reste faux : la recommandation les ignore ; l’API les renvoie avec `contactsVerified`. Les 20 modèles FLEX montrent leur liste exacte (PrimaFlex : pharmacie, télémédecine ou médecin de famille ; QualiMed : médecin de famille ou télémédecine). Sans liste, le type ; FLEX devient « Plusieurs premiers contacts au choix ». Remplace C-8. |
| C-13 | Vitesse des CTA ? | Un seul shader sert tous les CTA (`HealthShaderScene` : comparateur, page d’un modèle, panier, suivi, récupération) : `uSpeed` de 0,075 à 0,2. Le fond de la page d’offre du Wallet n’est pas un CTA : inchangé. |
| C-14 | Mentions « à confirmer » ? | Retirées de la page d’un modèle : note du premier contact et info-bulle des tags, note « éléments non confirmés » du détail Club, « Nature à vérifier », « Participation aux coûts […] à confirmer ». Texte frontaliers reformulé sans « restent à vérifier », droit d’option gardé. Les vues du guide, masqué, gardent les leurs. |
| C-15 | CoverScore ? | Bloc dessiné comme demandé, sous le prix, juste au-dessus de « Demander une offre » : surtitre MONTECH, trois lignes de dix barres espacées (rayon 2 px, gris très clair si vides, dégradé rose-rouge de haut en bas et liseré intérieur blanc de 1 px si pleines), note lue « 8 sur 10 » par les lecteurs d’écran. Non publié : aucune note réelle n’existe, et des notes inventées de compagnies nommées, plus hautes pour les deux partenaires de CoverView et sans mention, tromperaient les personnes qui choisissent leur assurance et exposeraient CoverView (LCD, art. 3). Affiché seulement dans l’aperçu local (`import.meta.env.DEV`), mêmes notes d’exemple 8, 7 et 9 pour tous les modèles ; absent du build. À publier avec une source de notes réelle et une méthode. |
| C-16 | « Au choix » ? (« Quand il y a plusieurs points de contact, enlève le "Au choix" ») | Retiré : la liste des contacts suffit. |
| C-17 | CoverScore plus serré ? (« Réduit les espaces entre les lignes […] Met le titre Service client, Avis et Qualité en gris […] Réduit la width des rectangles à 3px ») | Lignes espacées de 4 px au lieu de 8, libellés en gris #6b7280, barres de 3 px de large au lieu de 7, toujours en aperçu local seulement (C-15). |
| C-18 | Onglets ? (« enlève le margin-top au hi-tabs ») | Marge haute de 26 px retirée. |
| C-19 | Paiement des frais ? (« Monte Paiement des frais au-dessus de Année et mets une coche verte sur la gauche de Avancés par la caisse ») | Première ligne de l’onglet Données, coche verte #16a34a avant « Avancés par la caisse ». |
| C-20 | Alignement du CoverScore ? (« ne pas mettre de space-between entre les service client, qualité, avis et les bars mais quand même aligner les barres entre elles et avoir bien 20px d'espace avec les titres ») | Deux colonnes partagées par les lignes (grille et sous-grille) : libellés à leur largeur, barres alignées 20 px après le plus long ; plus de répartition jusqu’au bord. |
| C-21 | En-tête mobile ? (« Enlève Se connecter et Mon panier (mais garde l'icone et le nombre) du menu version mobile ») | Dès que le menu burger remplace les menus (960 px et moins, au lieu de 600 px), la barre n’a plus « Se connecter » ni le libellé « Mon panier » : icône et nombre gardés, lien du panier nommé pour les lecteurs d’écran sur les autres pages. « Créer un compte » reste dans la barre. |
| C-22 | Menu ouvert ? (« déplacer les boutons Se connecter et Créer un compte tout en haut lorsque le burger menu est ouvert ») | « Se connecter » et « Créer un compte » juste sous le titre du panneau, séparés des menus par un trait, au lieu d’en bas. |
| C-23 | Îlot de région ? (« Cache l'ilot de sélection de la région pour le moment ») | Masqué par une constante (`regionSelectEnabled = false`, comme le questionnaire) ; sur téléphone, l’indication remonte sous la recherche. La région se choisit par la carte, la recherche ou la localisation. Les 26 pays tarifaires non voisins, qu’on ne trouvait que dans cette liste, ne sont plus accessibles tant qu’il est masqué. |
| C-24 | Coverview score ? (« On va appeler ça coverview score (avec Gold, Silver et Bronze) […] Sur la droite de ce bloc un icone "i" dans un cercle […] Changer Qualité par Recommandation (10/10 pour Assura et Groupe Mutuel) ») | « COVERVIEW SCORE » en surtitre MONTECH ; dessous le niveau Gold, Silver ou Bronze en gras italique resserré (82 % de largeur : Lausanne n’a pas de largeur condensée, aucune police ajoutée), dégradé métallique propre au niveau, reflet qui traverse le mot toutes les 6 s (coupé si les animations sont réduites) ; juste à droite, un « i » cerclé dont le survol ou le focus ouvre une fenêtre flottante avec Service client, Avis et Recommandation en barres, valeurs lues « 8 sur 10 ». Toujours en aperçu local seulement (C-15) : les niveaux d’exemple sont répartis par modèle sans regard à l’assureur ; le 10/10 de Recommandation pour Assura et Groupe Mutuel n’est pas câblé. Publiable s’il est présenté comme la recommandation de CoverView pour ses partenaires, partenariat indiqué dans le détail, et sans notes inventées pour Service client et Avis. Le niveau dépendra d’une règle de calcul à définir avec les vraies notes. |

| # | cible | oracle | résultat |
|---|---|---|---|
| 9 | Page d’un modèle | script Playwright, 1440 et 390 px | QualiMed : « PREMIER CONTACT » en MONTECH V.02 10 px, sans fond, Médecin de famille et Télémédecine ; flexhelp24 : Télémédecine, Application / vidéo, Réseau médical ; aucune mention « à confirmer / à vérifier » sur la page, dans Prestations, Club et un détail Club ; liste sans « Parcours combiné » ; CoverScore en aperçu local, 8, 7 et 9 sur 10, au-dessus du CTA ; aucune erreur |
| 10 | Données et API | constructeur du catalogue, `recommendation.import.ts --validate`, vitest, base locale | constructeur reproductible (synonymes triés, CSV en LF) ; seuls `access.contacts` et `multipleEntry` de 115 modèles changent (`catalog_a802437ba0a8b7a152904c98`) ; contrat strict et `validateCatalog` OK ; présentation 6/6, recommandation 45/45 ; import local après sauvegarde `.preview/backups/coverview_local-2026-10-24-before-catalog-contacts.dump` ; `POST /compare` : PrimaFlex pharmacie, télémédecine, médecin de famille, `contactsVerified` faux |
| 11 | Build et outillage | `astro build`, tsc (www, api), ESLint, Prettier, knip | build OK ; `uSpeed:.2` dans le JS livré ; aucun CoverScore dans le JS de production ; knip : constats déjà présents sur main |
| 12 | Retouches | script Playwright, 1440 px | plus de « Au choix » ; CoverScore : lignes à 4 px, libellés #6b7280, barres de 3 px ; onglets sans marge haute ; Données : « Paiement des frais » en premier, coche #16a34a |
| 13 | Alignement du CoverScore | script Playwright, 1440 px | barres des trois lignes au même x, 20 px après « Service client », fin des barres loin du bord du panneau |
| 14 | En-tête et barre de la carte | script Playwright, 390, 800 et 1280 px, comparateur et accueil | 390 et 800 px : ni « Se connecter » ni « Mon panier » dans la barre, icône et nombre du panier, « Créer un compte », burger ; 1280 px inchangé ; menu ouvert : titre, puis connexion et création de compte, puis les menus ; îlot de région absent, indication à 215 px sous la recherche (1 px d’écart, comme avant) ; parcours habituels OK |
| 15 | Coverview score | script Playwright, 1440 px, pixels doublés | Gold (HMO Atupri), Silver (MediTel), Bronze (Hôpital de confiance) : titre « COVERVIEW SCORE », niveau en 700 italique 24 px resserré, dégradé découpé dans le texte, animation de reflet active ; reflet capturé à mi-course ; survol du « i » : fenêtre avec Service client, Avis, Recommandation ; aucune erreur |

Production : après le déploiement, publier `data/health-insurance/2027/recommendation-catalog.json` (`catalog_a802437ba0a8b7a152904c98`) depuis l’Admin (Configuration › Comparateur maladie). Sans cette publication, les modèles FLEX montrent « Plusieurs premiers contacts au choix ».
