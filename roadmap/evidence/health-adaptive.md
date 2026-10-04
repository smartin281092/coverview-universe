# Livraison locale — recommandation maladie adaptative

1er octobre 2026. Mandat utilisateur détaillé, autonomie conservée. Aucun déploiement, message à un assureur ou changement de droits sur un compte réel. Espace de travail déjà largement modifié : les autres chantiers ont été préservés.

## Références et périmètre

Plan : [health-adaptive.plan.md](../plans/health-adaptive.plan.md). Calculs, règles, confidentialité et limites : [référentiel du module](../../apps/api/src/modules/health-insurance/recommendation.md). Audit légal primaire : [règles](health-adaptive-rules-audit.md). Recherches nominatives : `data/health-insurance/2027/research/review-a.json` et `review-b.json`, rapprochées de `inventory.json`. Recherche documentaire indépendante, code sous un propriétaire ; aucun sous-agent n’a modifié le moteur.

Session : agent de la famille GPT-6. L’identifiant exact du modèle et l’effort effectif ne sont pas exposés dans les métadonnées utilisables de ce tour ; ne pas les déduire du nom du dépôt. Aucune dépendance applicative ajoutée et aucune migration de framework/base.

## Vérifié

- **WWW/API** : banque de questions adaptative, réponse unique immédiate, multisélection confirmée, retours, modification, ignorance, note locale, arrêt volontaire, résultats et réserves atomiques. Le serveur examine tous les candidats dans le périmètre, sépare compatibilité/coût/adéquation/avantages et teste des dépendances conjointes. Le classement par prix reste disponible.
- **Catalogue réel importé** : `catalog_18fd5e1e9e2891c09f193b6d`, rattaché au snapshot actif `hi_eb1eceb51a217fd4a4f4cd529e81`. 219 916 primes conservées. Inventaire exact : 32 assureurs juridiques / 153 modèles. 138 fiches, 215 références de passages, 19 fiches avec année explicitement confirmée. Quatre formules médicales documentées, toujours soumises aux conditions de profil.
- **Couverture** : 153 modèles examinés, 0 non examiné ; 139 partiels, 14 à contrôler, **0 modèle entièrement vérifié**. Les conditions complètes de 153 modèles restent à valider. 323 dossiers nominatifs ouverts, dont 62 bloquants et 261 importants. Aucune absence documentaire transformée en absence de prestation. Les 32 dossiers OPAS portent la contradiction juridique effectivement constatée.
- **Administration** : route `/configuration/comparateur-maladie`, lecture protégée, configuration versionnée, simulation sans publication, publications et retours arrière audités des règles et du catalogue, contrôles versionnés avec responsables/historique, revue documentaire par échéance, exports. PostgreSQL isolé : refus anonyme/non-admin/MFA insuffisante, CSRF/origine/Host, habilitation révoquée, idempotence, conflit de révision, catalogue incomplet rejeté, historique conservé, métadonnées opérateur retirées de la projection publique.
- **Persistance locale** : migrations additives `0024_flawless_drax.sql` (catalogue/règles/contrôles/commandes) et `0025_wooden_lester.sql` (index couvrant), appliquées à la base locale existante. Aucun reset, effacement de primes, profil ou demande. Plusieurs versions du catalogue restent conservées. Aucune réponse personnelle de recommandation persistée.
- **Tests** : 37 tests de recommandation + 5 tests de coûts existants, 2 tests de séquence/annulation du client réellement employé par WWW et 1 scénario HTTP/SQL d’administration. **45 tests passent**, répartis sur quatre fichiers. Les 20 exigences d’acceptation ont une correspondance documentée dans le référentiel ; le cas de multisélection est observé au navigateur, les autres invariants sont exercés au moteur/transport.
- **Régression des données réelles** : `node scripts/verify-health-live.mjs` : 26 assertions, 42 régions, 219 916 primes, prix VD/GE contrôlés, bornes d’âge, communes restreintes, filtres et franchises. Sortie horodatée 2026-10-01T09:57:48.510Z. Aucun compte, offre fictive ou demande commerciale ajouté à la base réelle.
- **Deux profils de simulation fictifs** sur l’API réelle : parcours court 106 offres, aucun soin estimé, aucune prochaine question, résultat provisoire à cause des conditions documentaires ; parcours approfondi 630 offres, 37 scénarios de sensibilité, prochaine question liée aux avantages pertinents. Le scénario approfondi observé après indexation des jointures répond en environ 342 ms sur cet environnement ; pas un engagement de performance production.
- **Recette navigateur CUA** : onglet de contrôle distinct, paramètres 1990/Lausanne/accident inclus. Médecin + téléphone restent sur la même question jusqu’à Continuer ; obligations puis professionnels ; arrêt court sans prévention/fitness imposés. Modification de l’objectif vers coût annuel : contraintes précédentes conservées, estimation de soins demandée, zéro soin réutilisé ; la même offre reçoit les trois badges lorsqu’ils correspondent au calcul. Volet droit et onglet Prestations affichent les conditions et sources du catalogue réel. À 390 × 844, panneau lisible, aucune largeur de débordement (contenu et largeur scroll 375 pixels hors barre). Le viewport a été rétabli. Route Admin anonyme : écran de connexion, aucune configuration affichée. Aucun panier ni session de l’onglet utilisateur modifié.
- **Compilations et lint** : types API, Admin, WWW ; build API, build Admin et build WWW passent. Astro Check : 76 fichiers, zéro erreur/avertissement/indice. ESLint ciblé des fichiers nouveaux/modifiés passe. Aucun test ou règle désactivé.

## Diagnostic de performance et corrections

L’essai concomitant prix/affinage a révélé des dépassements de délai. Les mesures séparées ont distingué la répétition de jointures dans le moteur et les lectures disque à froid de la table des primes. Correction : index de modèles/preuves/dossiers propre à chaque calcul, accès par identifiant lors des sondes, puis index SQL couvrant l’offre sans charger les archives JSON. `EXPLAIN ANALYZE` enfant : 2 586 ms avec lectures de lignes ; après index, `Index Only Scan health_premium_offer_cover`, **Heap Fetches 0**, environ **26 ms SQL**. Les 26 assertions de prix passent ensuite avec le délai API habituel.

La création de l’index sur les données importées dépassait la limite interactive. La CLI `db:migrate` utilise désormais un délai DDL borné de 60 s, sans modifier le délai API ni les gardes d’environnement/reset. Une tentative avec une variable à 30 000 ms avait été refusée par la validation existante ; aucun `.env` n’a été changé. Les échecs ne sont pas présentés comme des preuves de succès. Instrumentation diagnostique temporaire retirée.

## Fait, avec limites explicites

- Catalogue et recherche couvrent tous les identifiants, **pas une certification exhaustive des avantages**. Les éligibilités, réseaux, périodes et gratuités non prouvés restent conditionnels et nommés dans la file. Les montants publicitaires ne deviennent pas des économies attendues. Une résolution opérateur exige une preuve révisée pour changer le calcul.
- Calcul d’une personne à la fois, scénarios ordinaires qualifiés. Pas de simulation familiale globale/K3-K4, d’admission nominative en réseau raccordée ou d’audit complet de complémentaire. Le panier existant agrège les primes de plusieurs profils ; aucune économie familiale inventée. Maternité et autres coûts particuliers sont signalés comme non évaluables sans ventilation vérifiée. Ces limites sont visibles et documentées.
- L’Admin permet réellement la configuration et l’import de preuves JSON, mais la session administrative **WorkOS réelle** de cette nouvelle page n’a pas été ouverte pendant la recette : seul l’écran anonyme a été observé, et les autorisations/mutations ont été exercées avec PostgreSQL et un double fournisseur explicite. Aucun droit créé pour contourner ce manque de session.
- Cadre juridique de traitement/consentement, durée de conservation de l’audit technique et contrôle humain des contrats : à valider avant production. Les réponses/notes personnelles restent éphémères ; aucune transmission à une IA ou publicité, aucun entraînement.

## Contrôles globaux hors périmètre

`pnpm boundaries` : zéro erreur de frontière sur le code livré. Trois avertissements d’orphelins préexistants (`content/fr/retirement-preview.ts`, `performance.ts`, `landing.ts`) et quatre anciens fichiers Astro inutilisés (`Closing`, `Faq`, `GuideVisual`, `ResourceVisual`) font encore échouer Knip globalement. Ils ne sont pas modifiés ou masqués. L’entrée CLI réelle de l’importeur est déclarée à Knip, et l’ancienne banque WWW inutilisée est retirée.

Vite signale encore le bundle principal Admin supérieur à 500 kB ; la nouvelle page est chargée séparément (33,19 kB, 8,60 kB gzip lors du build). Runtime local Node 24.13.1 observé, inférieur au minimum 24.20 demandé par le dépôt ; les contrôles cités passent néanmoins dans cet environnement. Aucune mise à niveau système improvisée.

## Livrables et suite

- [Catalogue JSON](../../data/health-insurance/2027/recommendation-catalog.json)
- [Couverture par compagnie et modèle CSV](../../data/health-insurance/2027/research-coverage.csv)
- [File nominative JSON](../../data/health-insurance/2027/operator-reviews.json)
- [Rapport opérateur lisible](../../data/health-insurance/2027/operator-report.md)
- [Profils de démonstration explicitement fictifs](../../data/health-insurance/2027/research/profiles-fictional.json)

Backlog S-011 enrichi sans clôture abusive des autres chantiers. Décisions promues dans le référentiel du module et lien mémoire ajouté. [Brouillon de revue opérateur](../plans/health-adaptive-operator-review.plan.md), non auto-exécuté. Aucune PR, publication de site ou communication externe effectuée.

## Affichage des marques — 1er octobre 2026

Le comparateur utilise les marques du catalogue publié dans la carte, les résultats, les recommandations, les filtres et les panneaux de modèles. Les nouvelles demandes gardent aussi la marque dans leur instantané pour le panier et le suivi WWW / Wallet / Admin. Champs API additifs `brand`, `insurerBrand`, `currentInsurerBrand` ; identifiants et noms juridiques conservés séparément, aucune fusion des modèles ou avantages. Repli sur le nom historique pour un ancien instantané dépourvu de marque.

Vérifié sur l’API locale : 32/32 compagnies rapprochées du catalogue, 141 offres de comparaison/carte et 106 offres de recommandation avec la bonne marque, détail modèle cohérent. Les 26 assertions existantes de `verify-health-live.mjs` passent à 12:45 UTC. Types API / WWW / Wallet / Admin et ESLint ciblé passent. Dans un onglet de contrôle indépendant, résultats et détail « Assura », « Atupri », « Sympany » et liste alphabétique des 32 marques observés. Aucun dossier personnel, état de demande ou onglet utilisateur modifié.
