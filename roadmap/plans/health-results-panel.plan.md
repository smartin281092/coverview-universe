# Carte et volet des résultats

Mandat : demande utilisateur du 1 octobre 2026, exécution autonome autorisée (PROG-23).

## Objectif
Faire suivre la bulle au curseur, déplacer le questionnaire dans la liste, présenter les modèles avec leurs premiers contacts, logos et distinctions issues du moteur. Simplifier le détail et afficher la redistribution seulement avec preuve de montant et d'applicabilité pour 2027.

## Périmètre
WWW (carte, liste, fiche, questionnaire, shader), contrats et enrichissement serveur des offres, actifs officiels des assureurs. Aucun changement de tarification, de base, d'authentification ou de suivi des demandes. Aucun déploiement.

## Réalisation
1. Examiner les contrats existants, les données de premier contact et l'inventaire des assureurs.
2. Rechercher les logos et la redistribution sur les sources officielles, conserver la provenance.
3. Enrichir les offres côté serveur ; intégrer les composants partagés de présentation et le classement atomique du moteur dans le volet.
4. Ajuster carte, fiche, onglets et animation.
5. Vérifier les règles affectées par tests, types/lint, build et parcours navigateur desktop/mobile.

## Oracles et risques
- V2 : pas de montant de redistribution inventé ou provenant d'une autre année ; distinction étranger/Suisse ; données de contact provenant des conditions documentées.
- V3 : suivi du curseur, liste → questionnaire → fiche → retour avec réponses conservées ; badges exacts ; prix et tabs lisibles ; aucun questionnaire sur la carte.
- Les offres dont les conditions ne sont pas vérifiées restent signalées. Les badges ne doivent pas présenter une préférence provisoire comme une recommandation établie.
- Les actifs et fichiers préexistants hors périmètre sont conservés. Sources, couverture des logos et limites consignées dans le ledger.

## Référentiels
CLAUDE, PROJECT, docs/codex, frontend (FRONT-14), marketing-web, contracts (CTR-02), backend (G-11), brand, design, i18n, delivery (G-18), MEMORY ; README health-insurance. Pas de migration, donnée personnelle supplémentaire, événement ou dépendance envisagés.

## Journal
- Audit initial : 32 assureurs juridiques suisses ; offres étrangères séparées ; le moteur fournit `leaders` et `ranked`. Le questionnaire est actuellement monté sur la carte et les résultats personnalisés ont une liste distincte.
- Livré et vérifié : 32 logos officiels, métadonnées serveur 2027, liste personnalisée intégrée au volet, fiche simplifiée, contrôles bureau/mobile et frontaliers. 52 tests, types API/WWW, lint ciblé et build réussis. Détail et limite de recette du mouvement sans bouton dans `roadmap/evidence/health-results-panel.md`.
- Retouche visuelle demandée ensuite : noms des modèles, lignes bord à bord, badge vert au-dessus du prix, cadrage Vaud, nouvelles icônes, unité CHF claire, accident inclus vert, prestations en liste et shader accéléré. Recette bureau/mobile, types WWW, build et lint ciblé réussis ; réserves documentaires conservées. Voir le complément daté du ledger.
