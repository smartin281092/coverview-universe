/**
 * Textes des îlots de la page Hyperion (bloc d’achat, simulateur), séparés du reste du contenu
 * pour que le JavaScript de la page n’embarque pas toute la page (MKT-06) ; ceux du dialogue de
 * commande sont dans `hyperion-order.ts`, chargé avec lui. `hyperion.ts` les recompose pour le
 * rendu statique.
 */
export const hyperionUi = {
  eyebrow: "3E PILIER 3A · STRATÉGIE COVERVIEW · ASSUREUR LIECHTENSTEIN LIFE",
  buy: {
    title: "Composez votre Hyperion",
    investment: "Votre versement",
    perMonth: "CHF / mois",
    perYear: "CHF / an",
    frequency: "Rythme des versements",
    monthly: "Mensuel",
    annual: "Annuel",
    birthYear: "Année de naissance",
    initialCapital: "Capital de départ",
    initialCapitalHint: "Facultatif : transfert d’un 3e pilier existant ou versement initial.",
    currency: "CHF",
    horizon: "{{years}} ans jusqu’à vos 65 ans",
    horizonShort:
      "La retraite à 65 ans est atteinte ou trop proche pour une projection : un conseiller étudie votre situation avec vous.",
    cap: "Plafond 3a 2026 avec caisse de pension : 7’258 CHF par an, soit 604 CHF par mois.",
    capExceeded: "Au-dessus du plafond 3a 2026 d’une personne affiliée à une caisse de pension.",
    projected: "Capital potentiel à 65 ans",
    projectedNote:
      "Projection au taux annualisé 2016 – 2026 après frais modélisés · aucune garantie",
    invested: "dont {{amount}} CHF versés",
    cta: "Commander Hyperion",
    simulate: "Voir la simulation détaillée",
    assurances: [
      "Un conseiller vous rappelle sous 24 h ouvrées",
      "Sans engagement avant la signature de l’offre",
      "Couverture décès et incapacité de gain selon le contrat",
      "Courtier indépendant non lié",
    ],
  },

  simulator: {
    eyebrow: "SIMULATEUR",
    title: "Votre capital à 65 ans.\nEn projection et en probabilités.",
    description:
      "Les mêmes paramètres que sur horizon3.finance : versement, rythme, année de naissance et capital de départ. La projection applique le taux annualisé après frais ; les simulations Monte Carlo rejouent les onze rendements de référence dans un ordre aléatoire.",
    parameters: "Vos paramètres",
    projection: "Projection historique",
    projectionNote:
      "Au taux annualisé {{rate}} après frais modélisés, versements en début de mois.",
    invested: "Capital versé",
    capital: "Capital potentiel à 65 ans",
    gain: "Gain potentiel",
    years: "ans",
    horizon: "Horizon",
    chart: {
      alt: "Évolution du capital versé et du capital potentiel jusqu’à 65 ans.",
      invested: "Versé",
      capital: "Capital",
    },
    assumptions: "Hypothèses du modèle",
    assumptionsDialog: {
      title: "Les hypothèses.\nNoir sur blanc.",
      items: [
        "Rendement constant égal au taux annualisé 2016 – 2026 après frais modélisés ; les marchés, eux, varient : les simulations Monte Carlo en donnent la mesure.",
        "Frais annuels de 2,21 % appliqués une fois aux rendements de la stratégie.",
        "Prime de risque mensuelle de 5 CHF à 30 CHF pour des versements de 100 CHF à 605 CHF par mois (5 % en dessous de 100 CHF, plafond de 30 CHF au-delà). En mode annuel, douze primes calculées sur le versement mensuel équivalent.",
        "Pendant les cinq premières années, 67 % de chaque versement net de prime sont retenus par le modèle (frais d’acquisition et de gestion du contrat) ; 100 % sont investis ensuite. Le périmètre exact des frais figure dans l’offre Liechtenstein Life.",
        "Versements en début de mois, capital de départ investi au premier jour, retraite à 65 ans, horizon de 1 à 45 ans. Pas de fiscalité au retrait, pas d’inflation : le simulateur de l’accueil montre leur effet.",
        "Les montants sont indicatifs. Ils ne constituent ni une promesse de rendement ni une recommandation d’investissement personnalisée.",
      ],
      close: "Fermer",
    },
    monteCarlo: {
      title: "Distribution des scénarios",
      count: "{{count}} simulations Monte Carlo",
      method:
        "Des trajectoires annuelles sont tirées avec remise parmi les {{observations}} rendements de référence, indépendamment d’une année à l’autre.",
      computing: "Calcul des 100’000 trajectoires…",
      unavailable:
        "Les simulations sont indisponibles sur cet appareil. La projection historique reste affichée.",
      median: "Scénario médian",
      medianNote: "50 % des simulations terminent au-dessus.",
      position: "Position de la projection historique",
      positionNote: "{{probability}} des simulations aboutissent à un capital supérieur.",
      belowInvested: "{{probability}} des simulations terminent sous le capital versé.",
      central: "Scénarios centraux",
      centralNote: "Du 10e au 90e percentile",
      centralShare: "{{probability}} des simulations",
      histogram: "Répartition des capitaux simulés, du 1er au 99e percentile",
      ranges: {
        "central-low": "Central bas",
        "central-mid-low": "Proche de la médiane",
        "median-low": "Cœur central inférieur",
        "median-high": "Cœur central supérieur",
        "central-mid-high": "Proche de la médiane",
        "central-high": "Central haut",
      },
      extremeLow: "Scénario extrême bas",
      extremeHigh: "Scénario extrême haut",
      percentiles: "Percentiles",
      disclaimer:
        "Les simulations reposent sur les onze rendements historiques disponibles, tirés dans un ordre aléatoire. Elles ne représentent ni tous les régimes de marché ni une crise absente de cette fenêtre, et ne constituent ni une garantie ni une prévision.",
    },
    cta: "Commander avec ces paramètres",
  },
} as const;
