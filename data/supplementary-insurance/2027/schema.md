# Format d'un fichier `insurers/<clé>.json`

```json
{
  "insurer": {
    "key": "assura",
    "name": "Assura",
    "legalEntityLca": "raison sociale de l'assureur LCA si indiquée, sinon null",
    "website": "https://…",
    "calculatorUrl": "URL d'entrée du calculateur de primes, sinon null",
    "calculatorHosts": ["hôtes observés pour le calculateur ou son API"],
    "publishedTariffUrls": ["PDF ou pages publiant des primes LCA, sinon vide"],
    "notes": "particularités (rabais famille, combinaisons, entité porteuse…)"
  },
  "retrievedAt": "2026-11-18",
  "products": [
    {
      "key": "assura-complementa-extra",
      "name": "Nom commercial exact",
      "category": "clé de taxonomy.json › productCategories",
      "audience": "all | adult | child | young_adult | senior",
      "summary": "1 à 2 phrases factuelles",
      "variants": [{"key": "eco", "name": "Economy", "description": "ce qui distingue ce niveau"}],
      "prerequisites": "ex. produit X requis, questionnaire de santé, âge maximal d'admission, sinon null",
      "pricing": {
        "factors": ["age", "sex", "region", "deductible", "accident", "entry_age"],
        "ageBands": "tranches d'âge tarifaires si publiées, sinon null",
        "publishedPrices": [{"profile": "description", "birthYear": 1990, "age": 37, "ageBand": "36-40 ou null", "sex": "f | m | null", "region": "localité ou région tarifaire", "deductibleChf": null, "accident": true, "variant": "clé ou null", "monthlyChf": 0, "year": 2027, "sourceType": "official_calculator | official_published | secondary", "sourceUrl": "…"}],
        "discounts": "rabais famille, durée, combinaison, sinon null"
      },
      "sourceUrls": ["page produit", "PDF conditions"],
      "conditionsDoc": {"title": "CGA/CSA…", "edition": "ex. 01.2027", "url": "…"},
      "benefits": [
        {
          "tags": ["tag principal", "tag secondaire éventuel"],
          "label": "libellé tel que formulé par l'assureur",
          "variant": "clé de variante ou null si commun à toutes",
          "coverage": "texte fidèle : « 90 %, max. CHF 500 par année civile »",
          "ratePercent": 90,
          "maxAmountChf": 500,
          "maxPeriod": "year | 2_years | 3_years | case | day | lifetime | null",
          "unlimited": false,
          "waitingPeriod": "délai de carence, sinon null",
          "conditions": "conditions ou limites importantes, sinon null",
          "sourceUrl": "page ou PDF effectivement lu",
          "verification": "read | secondary"
        }
      ]
    }
  ]
}
```

`verification` : `read` = lu dans un document officiel de l'assureur ; `secondary` = repris d'une source tierce, à confirmer. Un montant inconnu vaut `null`, jamais une estimation.
