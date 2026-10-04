/** Contenu éditorial de la landing ; chiffres commerciaux non documentés exclus. */
export const landing = {
  seo: {
    title: "Découvrez le potentiel de votre 3e pilier | CoverView",
    description:
      "Comprenez votre 3e pilier, explorez l’effet du temps et de l’inflation sur votre épargne, puis retrouvez vos documents dans votre espace CoverView Wallet.",
  },
  navLabel: "Navigation principale",
  footerLabel: "Liens utiles",
  nav: [
    { label: "Votre audit", href: "#comprendre" },
    { label: "Les simulateurs", href: "#simuler" },
    { label: "Notre méthode", href: "#methode" },
    { label: "Questions", href: "#questions" },
  ],
  account: "Mon Wallet",
  cta: "Analyser mon 3e pilier",
  alternative: "Commencer sans mon contrat",
  arrow: "Découvrir",
  motion: { pause: "Mettre les animations en pause", play: "Activer les animations" },
  hero: {
    eyebrow: "COURTIER INDÉPENDANT · NON LIÉ",
    title: ["Votre 3e pilier.", "Tout son potentiel."],
    wheelLabel:
      "Carrousel de logos de prévoyance : AXA, Pax, Finpension, Helvetia, UBS, Swiss Life, VIAC, Generali, Swissquote, La Mobilière, Raiffeisen, Groupe Mutuel, Zurich, Liechtenstein Life, Allianz et Retraites Populaires.",
    description:
      "Comprenez vos frais, vos garanties et le potentiel de votre épargne. Identifiez ce qui mérite d’être conservé ou ajusté pour préparer votre retraite.",
    assurances: ["Simulations gratuites", "Sans compte pour simuler", "Sans engagement"],
    caption: "Comprendre aujourd’hui. Choisir la suite librement.",
    visual: {
      label: "L’EFFET DU TEMPS",
      horizon: "Dans 30 ans",
      total: "Capital illustratif",
      currency: "CHF",
      monthly: "300 CHF / mois",
      rate: "Hypothèse à 16 % / an",
      invested: "Dont 108’000 CHF investis",
      badge: "Le temps travaille pour vous",
      note: "Illustration mathématique · rendement non garanti",
      cardAlt: "Exemple de carte de membre CoverView Wallet",
    },
  },
  strip: {
    lead: "Votre prévoyance, sous tous les angles.",
    items: ["Stratégie", "Frais", "Garanties", "Flexibilité", "Horizon", "Pouvoir d’achat"],
  },
  discovery: {
    eyebrow: "01 / COMPRENDRE",
    title: "Votre retraite.\nCombien faut-il vraiment ?",
    description:
      "Combien épargner chaque mois pour préserver votre niveau de vie ? Combien de temps faudrait-il avec votre stratégie actuelle ? Le rapport met des chiffres sur ces questions.",
    items: [
      {
        number: "01",
        title: "Ce que votre épargne doit financer",
        description:
          "Votre niveau de vie souhaité, vos rentes et vos avoirs : comprendre l’écart à couvrir, au-delà du seul contrat.",
      },
      {
        number: "02",
        title: "Combien épargner chaque mois",
        description:
          "Estimer l’effort nécessaire selon votre horizon, les frais et les hypothèses de rendement retenues.",
      },
      {
        number: "03",
        title: "Combien de temps il faudrait",
        description:
          "Mesurer la durée nécessaire au rythme actuel et identifier les leviers à réexaminer : versements, stratégie ou objectif.",
      },
    ],
    report: {
      eyebrow: "LA LECTURE DE VOTRE CONTRAT",
      title: "Tout se précise.",
      status: "Exemple de lecture",
      labels: ["Votre stratégie", "Vos protections", "Vos frais"],
      values: ["Où va votre épargne ?", "Qu’est-ce qui est couvert ?", "Quel coût dans le temps ?"],
      bottom: "Données extraites · hypothèses · points à confirmer",
      conclusion: "Une information claire change la décision.",
      steps: ["Ajouter", "Comprendre", "Décider"],
    },
  },
  savings: {
    eyebrow: "02 / PRENDRE DE LA PERSPECTIVE",
    title: "Même effort.\nAutre horizon.",
    description:
      "À effort d’épargne égal, le temps et le rendement peuvent changer le résultat. Comparez deux hypothèses pour comprendre ce qui fait la différence.",
    hint: "À vous de jouer. Faites varier votre épargne.",
    contribution: "Épargne investie chaque mois",
    duration: "Durée d’épargne",
    years: "ans",
    monthlyUnit: "CHF / mois",
    invested: "Total investi",
    lower: "Hypothèse A",
    upper: "Hypothèse B",
    rateA: "Rendement annuel A",
    rateB: "Rendement annuel B",
    delta: "d’écart entre ces deux hypothèses",
    axisStart: "Aujourd’hui",
    axisEnd: "À l’horizon choisi",
    chart: "Évolution de deux capitaux illustratifs à versements identiques",
    chartHelp: "Survolez la courbe pour lire un point dans le temps.",
    disclaimer:
      "Illustration mathématique, pas prévision de rendement. Des rendements différents impliquent des risques différents. Le capital investi peut diminuer.",
    assumptions:
      "Capital initial nul. Versements investis en fin de mois ; taux annuels effectifs constants supposés nets de frais, avant inflation et fiscalité au retrait. Une prime d’assurance n’est pas nécessairement investie en totalité.",
    details: "Les hypothèses de calcul",
    early: "Le meilleur allié de votre épargne ? Le temps.",
  },
  inflation: {
    eyebrow: "03 / REGARDER AU-DELÀ DU SOLDE",
    title: "Et demain,\nque vaudra\nvotre capital ?",
    description:
      "Votre objectif, c’est aussi ce que votre épargne vous permettra d’acheter. Faites varier l’inflation pour voir votre capital en pouvoir d’achat d’aujourd’hui.",
    capital: "Capital futur envisagé",
    duration: "Dans combien d’années ?",
    rate: "Inflation annuelle testée",
    result: "EN POUVOIR D’ACHAT D’AUJOURD’HUI",
    future: "Capital futur",
    purchasing: "Pouvoir d’achat actuel",
    note: "Scénario de test, pas une prévision de l’inflation suisse. Le solde nominal ne diminue pas : c’est son pouvoir d’achat qui change.",
    formula: "Capital futur ÷ (1 + inflation annuelle)ⁿ, avec n = durée en années.",
    detail:
      "Augmenter vos versements renforce votre épargne, mais ne revalorise pas à lui seul le capital déjà accumulé.",
    cta: "Mettre mon 3e pilier en perspective",
    years: "ans",
    currency: "CHF",
    loss: "de pouvoir d’achat en moins",
    noLoss: "de baisse de pouvoir d’achat",
  },
  evidence: {
    eyebrow: "04 / COMPARER AVEC MÉTHODE",
    title: "Comparez ce qui compte.\nPour vous.",
    description:
      "Le rendement compte. Les frais, les garanties et la liberté de faire évoluer votre contrat aussi. Regardez chaque solution à travers ce qui compte pour votre projet.",
    dimensions: ["Coûts", "Investissements", "Protections", "Risques", "Flexibilité", "Objectifs"],
    number: "dimensions à regarder ensemble",
    link: "Explorer les critères de comparaison",
    note: "Des critères pour comprendre les différences entre les solutions et les mettre en perspective avec vos besoins.",
  },
  method: {
    eyebrow: "05 / UNE MÉTHODE, PAS UNE BOÎTE NOIRE",
    title: "Comprendre d’abord.\nDécider en confiance.",
    description:
      "Nous partons de votre situation pour vous aider à comprendre vos options. Conserver, ajuster ou étudier une alternative : vous gardez la main sur la décision.",
    items: [
      {
        title: "Partir de votre réalité",
        description: "Votre contrat, vos protections et ce que vous voulez construire.",
      },
      {
        title: "Éprouver les hypothèses",
        description:
          "Des frais, une inflation ou des marchés moins favorables : regardez aussi l’autre côté du scénario.",
      },
      {
        title: "Garder votre liberté",
        description: "Conserver, ajuster ou explorer une alternative. La décision reste la vôtre.",
      },
    ],
    link: "Comprendre notre méthode",
    visual: {
      top: "VOTRE DÉCISION",
      center: "Vous.",
      satellites: ["Vos objectifs", "Votre horizon", "Vos protections"],
      bottom: "Une analyse. Plusieurs issues possibles.",
    },
  },
  strategy: {
    eyebrow: "L’INDÉPENDANCE AU SERVICE DE VOTRE PROJET",
    title: "Votre intérêt.\nNotre point de départ.",
    description:
      "En tant que courtier indépendant et non lié, nous recherchons les solutions les plus adaptées à vos objectifs. Votre situation guide nos choix, de la sélection des fonds au suivi de votre stratégie.",
    independence:
      "Votre contrat peut déjà offrir des possibilités à explorer. Une allocation revue, des risques mieux compris et un suivi adapté peuvent faire partie de la réponse.",
    link: "Découvrir les résultats de nos clients",
    labels: ["Comprendre", "Comparer", "Réexaminer"],
    visual: "UNE TRAJECTOIRE À CONSTRUIRE",
    caption: "Schéma de méthode · aucune performance représentée",
    foot: "Votre prévoyance mérite d’être pensée comme un ensemble.",
  },
  cases: {
    eyebrow: "06 / DÉCIDER EN CONNAISSANCE DE CAUSE",
    title: "Parfois, la meilleure décision\nest de ne rien changer.",
    label: "CAS ILLUSTRATIF · PAS UN TÉMOIGNAGE CLIENT",
    items: [
      {
        step: "Le point de départ",
        title: "Un contrat. Des questions.",
        text: "La stratégie correspond-elle encore à l’objectif ? Les protections sont-elles utiles ?",
      },
      {
        step: "L’analyse",
        title: "Remettre les pièces ensemble.",
        text: "Examiner les coûts, les garanties et la flexibilité avant d’envisager un remplacement.",
      },
      {
        step: "La décision possible",
        title: "Conserver. Et suivre.",
        text: "Si le contrat reste cohérent, le garder et le réexaminer lorsque la situation évolue.",
      },
    ],
    link: "Lire le cas illustratif",
  },
  follow: {
    eyebrow: "07 / VOIR PLUS LOIN",
    title: "Votre vie avance.\nVotre prévoyance aussi.",
    description:
      "Un projet immobilier, une famille, la retraite qui approche : vos priorités évoluent. Nous vous accompagnons pour réexaminer votre stratégie et vos allocations au fil de ces étapes.",
    items: [
      {
        time: "Aujourd’hui",
        title: "Faire le point",
        text: "Comprendre vos contrats et préciser vos objectifs.",
      },
      {
        time: "Au fil de vos projets",
        title: "Réexaminer les choix",
        text: "Suivre les fonds, réexaminer les allocations et adapter la réflexion aux changements de vie et aux objectifs.",
      },
      {
        time: "À l’approche de la retraite",
        title: "Préparer la suite",
        text: "Étudier les retraits, les besoins de revenus et leur organisation.",
      },
    ],
  },
  wallet: {
    eyebrow: "COVERVIEW WALLET",
    title: "Vos contrats.\nVotre espace.\nVotre liberté.",
    description:
      "Retrouvez vos contrats au même endroit et comprenez leur rôle dans votre situation. Wallet vous aide à les centraliser et à les analyser avec rigueur, même s’ils ont été conclus ailleurs.",
    benefits: [
      "Tous vos contrats et documents au même endroit",
      "Vos garanties, frais et conditions remis en perspective",
      "Aucune obligation de changer de contrat",
    ],
    cta: "Découvrir mon Wallet",
    caption: "Votre espace personnel sécurisé, accessible après connexion.",
    visualLabel: "TOUT COMMENCE PAR VOUS",
    cardAlt: "Carte de membre CoverView Wallet",
    badge: "Votre espace personnel",
  },
  faq: {
    eyebrow: "08 / EN TOUTE TRANSPARENCE",
    title: "Les bonnes questions.\nDes réponses directes.",
    items: [
      {
        question: "Puis-je commencer gratuitement et sans compte ?",
        answer:
          "Oui, les simulations sont gratuites et accessibles immédiatement, sans compte ni numéro de téléphone. Pour commencer avec votre contrat, connectez-vous à Wallet : vous pourrez y déposer et retrouver vos documents dans votre espace personnel.",
      },
      {
        question: "Je n’ai pas mon contrat. Est-ce un problème ?",
        answer:
          "Vous pouvez commencer dès maintenant avec les simulateurs pour explorer votre épargne et votre pouvoir d’achat futur. Vous pourrez ensuite retrouver votre contrat pour approfondir ses frais, ses garanties et ses conditions.",
      },
      {
        question: "L’analyse va-t-elle forcément me conseiller de changer ?",
        answer:
          "Non. Un contrat adapté peut mériter d’être conservé. Dans certains cas, faire évoluer les fonds ou les versements suffit à réexaminer votre stratégie. Avant un éventuel remplacement, il faut aussi regarder les coûts de sortie et les garanties auxquelles vous renonceriez.",
      },
      {
        question: "Les montants présentés sont-ils garantis ?",
        answer:
          "Non. Ils dépendent des hypothèses choisies. Les taux sont constants dans le modèle, alors que les marchés varient. Les résultats ne sont ni une promesse de rendement ni une recommandation d’investissement. Le capital investi peut diminuer.",
      },
      {
        question: "Que deviennent mes données ?",
        answer:
          "Vos paramètres de simulation restent dans votre navigateur. Pour vos documents, le dépôt passe par votre espace Wallet après connexion. Les informations sur leur traitement sont accessibles dans ce parcours avant le dépôt.",
      },
      {
        question: "Comment connaître la rémunération de CoverView ?",
        answer:
          "Les simulations sont gratuites. Pour un accompagnement, les conditions de rémunération applicables vous sont communiquées avant tout engagement, afin que vous puissiez décider en connaissance de cause.",
      },
    ],
  },
  closing: {
    eyebrow: "LE PREMIER PAS EST LE PLUS SIMPLE",
    title: "Faites le point aujourd’hui.\nChoisissez la suite librement.",
    description:
      "Avec votre contrat ou une première simulation, avancez vers une prévoyance que vous comprenez mieux.",
    note: "Vous décidez de la suite. Aucune obligation de changer de contrat.",
  },
  entry: {
    title: "Commençons par vous.",
    description: "Avec ou sans votre contrat, choisissez comment avancer.",
    close: "Fermer",
    with: "J’ai mon contrat",
    withText:
      "Connectez-vous à Wallet pour déposer votre contrat et retrouver vos documents au même endroit.",
    withNote: "Votre espace personnel · connexion requise",
    withCta: "Continuer dans Wallet",
    without: "Je commence sans contrat",
    withoutText:
      "Voyez ce que vos versements, le temps et l’inflation peuvent changer pour votre épargne.",
    withoutNote: "Gratuit · sans compte · aucun document nécessaire",
    withoutCta: "Essayer les simulateurs",
  },
  footer: {
    tagline: "La clarté, pour aller plus loin.",
    address: "Avenue Louis-Casaï 71 · 1216 Cointrin",
    copyright: "CoverView. Tous droits réservés.",
    links: [
      { label: "Méthodologie", href: "/methode" },
      { label: "Exemple retraite", href: "/demonstration" },
      { label: "Sources et limites", href: "/sources" },
      { label: "Contact", href: "/contact" },
    ],
    status: "Courtier indépendant non lié",
  },
};
