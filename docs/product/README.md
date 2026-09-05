# Référence produit CoverView

La [Bible produit et plateforme v1.5](../../references/CoverView_Bible_Produit_Plateforme_v1.5.docx) est la référence maître fournie par le porteur du projet. Les documents de ce dossier sont des **instruments dérivés de lecture et de traçabilité**, pas un second canon métier. Les instructions explicites du porteur du projet et leurs arbitrages consignés dans [PROJECT.md](../../PROJECT.md) priment sur une proposition de la bible.

## État réel

Initialisation documentaire réalisée le 5 septembre 2026. Aucun parcours produit n’est implémenté par ce travail. Tous les domaines, y compris les éléments qualifiés de possibles, futurs, indicatifs ou proposés dans la source, sont conservés dans la [roadmap complète](../../ROADMAP.md). Un qualificatif de source reste à traiter au plan concerné ; il ne retire pas silencieusement une capacité de la v1.

La roadmap distingue couverture demandée, dépendances, préparation avec données fictives, validation métier, intégration réelle et activation commerciale. Une simulation n'est pas une prestation, une signature ou une intégration prouvée. Les règles transverses applicables vivent dans PROJECT et le harness ; ce dossier les référence sans les recopier.

## Routage

| Pour… | Lire |
|---|---|
| Trouver une section ou sous-section précise | [Index des 258 titres](sections.md) |
| Comprendre les capacités et les parcours à couvrir | [Carte fonctionnelle](capabilities.md) |
| Préparer les décisions préalables aux slices concernées | [Questions, divergences et limites de preuve](open-questions.md) |
| Charger les exigences sources d’un domaine pour écrire un plan | [Inventaire structuré](requirements.json), filtré par `domain` ou `section_path` |
| Vérifier le texte exact et la position d’une exigence | [Extraction intégrale avec ancrages](bible.extracted.md) |
| Vérifier tableaux, cellules, styles et empreinte du DOCX | [Extraction structurée](bible.source.json) |
| Vérifier les cinq diagrammes de la source | [Images sources et lecture](source-media.md) |
| Reproduire ou vérifier les fichiers dérivés | [Extracteur](../../scripts/extract-bible.py) |

Ne pas charger intégralement les deux gros fichiers JSON ou l’extraction Markdown pour une slice. Filtrer d’abord les domaines et sections utiles ; les identifiants `bible.v15.*` sont reliés aux critères dans [la couverture](../../roadmap/coverage.json). Les domaines servent à rechercher, sans fixer les modules propriétaires.

## Provenance et couverture vérifiée

Source : `references/CoverView_Bible_Produit_Plateforme_v1.5.docx`.

SHA256 : `6264300267b345c1a6e7347139afe2653aeeac332ce3f21f5d21c37119f5454f`.

| Mesure | Résultat |
|---|---:|
| Paragraphes OOXML du corps conservés | 3 062 |
| Paragraphes non vides couverts | 2 945 / 2 945 |
| Tableaux et lignes de tableaux | 108 / 603 |
| Caractères textuels du corps extraits | 189 869 |
| Titres et sous-titres indexés | 258 |
| Sections numérotées | 114 : 1–96, 89 bis, 89 ter et R1–R16 |
| Unités de source dans l’inventaire | 2 115 |
| Médias d’origine conservés et inspectés | 5 / 5 |
| Insertions / suppressions suivies dans le corps | 0 / 0 |

Les 2 115 unités sont des paragraphes ou lignes de tableau, **pas un décompte de fonctionnalités ni de critères atomiques déjà validés**. Elles incluent titres, exemples, glossaire, questions et propositions. Le champ `source_statement` conserve intégralement les comportements et critères de la source ; `kind` aide à qualifier ces éléments mais un encadré classé table_header peut contenir une règle réelle. Les critères vérifiables, leurs slices et leurs oracles sont dans [l'index de roadmap](../../roadmap/index.md), avec qualification explicite du contexte documentaire.

Les identifiants sont stables pour cette révision épinglée : `bible.v15.p0017` pour un paragraphe, `bible.v15.t002r002` pour une ligne de tableau. Les coordonnées `pNNNN`, `tNNN/rN/cN` sont des ancrages structurels, **pas des numéros de page Word**. Toute nouvelle version du DOCX exige une réconciliation explicite des IDs et de la couverture ; ne pas renuméroter silencieusement une traçabilité existante.

## Reproduction

Avec un Python disponible (bibliothèque standard seule, aucune dépendance ajoutée) :

```powershell
python scripts/extract-bible.py
python scripts/extract-bible.py --check
```

Dans le runtime Codex Windows utilisé lors de l’initialisation :

```powershell
& 'C:/Users/sebm1/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/extract-bible.py --check
```

`--check` compare les fichiers dérivés, tous les ancrages non vides et les médias à la source retenue. Les fichiers générés portent leur nature dérivée ; la carte fonctionnelle et le registre de questions sont une lecture humaine à revoir si la source change. Aucun test produit n’est prétendu par cette vérification.

Limites : le DOCX n’a pas été modifié ; aucun moteur LibreOffice embarqué n’était disponible pour vérifier la pagination visuelle. Le corps entier et les cinq images ont été lus, les relations/tableaux/en-tête/pied ont été inspectés structurellement. Le PDF autonome `[RET-1]` cité dans la bible n’est pas présent dans `references` à cette initialisation ; seules ses reprises dans le DOCX ont été analysées.
