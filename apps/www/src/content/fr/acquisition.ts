// Inventaire propriétaire de la navigation publique (§22/66). Les IDs restent hors UI.
export const journeys = [
  {
    slug: "analyser-3p",
    owner: "S-025",
    label: "Analyser mon 3P",
    title: "J’ai déjà un 3e pilier.",
    question:
      "Où est investi mon argent ? Combien cela coûte ? Quelles protections et quel potentiel ?",
    action: "Découvrir les points à vérifier",
    heading: "Comprendre mon contrat de 3e pilier",
    description:
      "Placements, frais, garanties : identifiez les points clés de votre 3e pilier pour savoir ce qu’il vous apporte et quelles questions poser.",
    preparation:
      "Repérez dans votre contrat l’épargne, les frais et les protections. Distinguer ces éléments est le premier pas pour comprendre ce que vous avez.",
    unavailable:
      "Votre contrat mérite d’être compris avant d’être modifié. Commencez par les points clés, puis réunissez vos documents dans Wallet après connexion.",
  },
  {
    slug: "calculer-retraite",
    owner: "S-028",
    label: "Calculer ma retraite",
    title: "Je veux préparer ma retraite.",
    question: "Combien me faudra-t-il ? Pour quel niveau de vie ? Quel effet de l’inflation ?",
    action: "Comprendre l’objectif retraite",
    heading: "Définir mon objectif retraite",
    description:
      "Précisez votre niveau de vie souhaité, votre horizon et vos ressources pour donner un cap à votre épargne retraite.",
    preparation:
      "Commencez par le niveau de vie souhaité et l’horizon de votre retraite. Un âge cible est un objectif ; il ne prouve pas que les ressources nécessaires seront réunies.",
    unavailable:
      "Quelle épargne pour quelle vie à la retraite ? Explorez d’abord l’effet de vos versements, de la durée et de l’inflation avec nos simulateurs gratuits.",
  },
  {
    slug: "comparer",
    owner: "S-030",
    label: "Comparer",
    title: "Je veux comparer.",
    question:
      "Quelles stratégies correspondent à mon objectif ? Avec quelles hypothèses, quels risques et quelle probabilité ?",
    action: "Lire les critères de comparaison",
    heading: "Comparer des stratégies pour un même objectif",
    description:
      "Comparez vos options avec le même objectif, le même horizon et des critères clairs : placements, frais, protections et flexibilité.",
    preparation:
      "Pour comparer, gardez le même objectif et le même horizon. Les coûts, les protections et les hypothèses comptent aussi : un chiffre de rendement isolé ne suffit pas.",
    unavailable:
      "Un rendement affiché ne raconte pas tout. Remettez vos options sur les mêmes bases pour comprendre les compromis et ce qui compte pour vous.",
  },
] as const;

export const plannedPages = [
  {
    slug: "retrouver-lpp",
    label: "Retrouver mes avoirs LPP",
    owner: "S-021",
    group: "tools",
    description:
      "Un parcours professionnel peut laisser des documents dispersés. Faites le point sur les informations utiles pour retrouver vos avoirs de prévoyance.",
    unavailable:
      "Réunissez vos certificats de prévoyance et les informations de vos anciens employeurs. Le parcours de demande de recherche LPP est en préparation.",
  },
  {
    slug: "recuperer-contrats",
    label: "Récupérer mes contrats",
    owner: "S-020",
    group: "tools",
    description:
      "Réunissez vos contrats et leurs conditions pour comprendre les garanties, les frais et les possibilités d’adaptation.",
    unavailable:
      "Centralisez les contrats dont vous disposez dans Wallet après connexion. La demande de récupération auprès des compagnies est en préparation.",
  },
  {
    slug: "signature",
    label: "Procurations et signature",
    owner: "S-018",
    group: "tools",
    description:
      "Comprenez le rôle d’un mandat et des autorisations avant de signer : la démarche concernée, son périmètre et les documents utiles.",
    unavailable:
      "Avant toute signature, prenez connaissance de la démarche et des autorisations demandées. Retrouvez votre espace personnel et vos documents dans Wallet.",
  },
  {
    slug: "partager",
    label: "Sauvegarde, favoris et partage",
    owner: "S-032",
    relatedOwners: ["S-013"],
    group: "tools",
    description:
      "Gardez vos repères et choisissez les informations que vous souhaitez partager pour préparer vos décisions.",
    unavailable:
      "Retrouvez vos documents dans Wallet. La sauvegarde et le partage des résultats des simulateurs publics sont en préparation.",
  },
  {
    slug: "services",
    label: "Services",
    owner: "S-011",
    group: "understand",
    description:
      "Assurances, 3e pilier, prévoyance professionnelle et retraite : abordez votre situation dans son ensemble.",
    unavailable:
      "Commencez par le sujet qui vous concerne, puis découvrez les questions et les outils pour avancer.",
  },
  {
    slug: "vision",
    label: "Vision & philosophie",
    owner: "S-011",
    group: "understand",
    description:
      "Votre objectif avant le produit : comprendre l’existant, comparer les options et suivre les décisions dans le temps.",
    unavailable: "Découvrez les principes qui guident notre approche de votre prévoyance.",
  },
  {
    slug: "modeles",
    label: "Comparaison des modèles de service",
    owner: "S-011",
    group: "understand",
    description:
      "Indépendance, frais, analyse de l’existant et suivi : les questions à poser pour choisir votre accompagnement.",
    unavailable:
      "Comparez aussi la manière d’être accompagné et les explications que vous pouvez attendre.",
  },
  {
    slug: "benchmark",
    label: "Benchmark",
    owner: "S-011",
    group: "understand",
    description:
      "Frais, risques, protections et flexibilité : comparez les solutions avec des critères compréhensibles.",
    unavailable:
      "Découvrez comment lire une comparaison et relier les différences à votre objectif.",
  },
  {
    slug: "etudes-de-cas",
    label: "Études de cas",
    owner: "S-011",
    group: "understand",
    description:
      "Conserver un contrat ou approfondir une comparaison : deux cas fictifs pour comprendre les raisons d’une décision.",
    unavailable: "Découvrez des cas pratiques qui rendent la méthode concrète.",
  },
  {
    slug: "rapports",
    label: "Rapports",
    owner: "S-011",
    group: "understand",
    description:
      "Comprenez comment un rapport relie vos contrats, votre objectif retraite et les prochaines décisions.",
    unavailable: "Parcourez les dix volets d’un rapport à travers un exemple fictif.",
  },
  {
    slug: "articles",
    label: "Articles & FAQ",
    owner: "S-011",
    group: "understand",
    description:
      "Des réponses aux questions de prévoyance pour comprendre vos contrats et avancer à votre rythme.",
    unavailable:
      "Retrouvez nos guides, nos repères de comparaison et les réponses aux questions fréquentes.",
  },
  {
    slug: "contact",
    label: "Contact / Expert",
    owner: "S-012",
    group: "understand",
    description:
      "Un contrat à comprendre, une retraite à préparer ou une offre à comparer : partez de votre question.",
    unavailable: "Préparez les informations utiles à votre échange avec CoverView.",
  },
  {
    slug: "retire",
    label: "CoverView Retire",
    owner: "S-050",
    group: "spaces",
    description:
      "Reliez votre niveau de vie souhaité, votre épargne et les décisions à préparer pour votre retraite.",
    unavailable:
      "Explorez les premières questions de retraite et les simulateurs gratuits. Le parcours personnalisé Retire est en préparation.",
  },
  {
    slug: "miles",
    label: "Miles & avantages",
    owner: "S-103",
    group: "spaces",
    description:
      "Découvrez le programme de fidélité CoverView en préparation et les outils déjà accessibles.",
    unavailable: "Les Miles et leurs avantages seront présentés à l’ouverture du programme.",
  },
  {
    slug: "carte-digitale",
    label: "Carte digitale",
    owner: "S-101",
    group: "spaces",
    description:
      "Votre carte de membre digitale CoverView réunira vos repères d’adhésion dans votre espace personnel.",
    unavailable:
      "La carte digitale est en préparation. Vous pouvez déjà retrouver vos documents dans Wallet après connexion.",
  },
  {
    slug: "partners",
    label: "CoverView Partners",
    owner: "S-110",
    group: "spaces",
    description:
      "CoverView Partners est le futur espace dédié aux apporteurs et partenaires de CoverView.",
    unavailable:
      "L’espace Partners est en préparation. Découvrez notre approche et les besoins auxquels CoverView répond.",
  },
  {
    slug: "intelligence",
    label: "CoverView Intelligence",
    owner: "S-112",
    group: "spaces",
    description:
      "CoverView Intelligence est le futur espace d’analyse, de comparaison et de scénarios destiné aux professionnels.",
    unavailable:
      "L’espace Intelligence est en préparation. Notre méthode et nos critères de comparaison sont accessibles dès maintenant.",
  },
  {
    slug: "exchange",
    label: "CoverView Exchange",
    owner: "S-114",
    group: "spaces",
    description:
      "Retrouvez la présentation de CoverView Exchange et explorez les espaces CoverView.",
    unavailable:
      "CoverView Exchange est en préparation. Découvrez dès maintenant nos guides et nos simulateurs en accès libre.",
  },
] as const;

export const acquisition = {
  editorialLinks: [
    { href: "/outils", label: "Guide des outils" },
    { href: "/glossaire", label: "Glossaire" },
    { href: "/sources", label: "Notre approche et vos repères" },
  ],
  availabilityTitle: "{{label}} | CoverView",
  overview: "Comment ça marche",
  explore: "Explorer CoverView",
  exploreShort: "Explorer",
  method: "La méthode",
  founder: "Sébastien Martin",
  coming: "En préparation",
  guide: "Guide pratique",
  toolsAction: "Explorer les outils et simulateurs",
  savingsTool: "Simulateur d’épargne",
  inflationTool: "Simulateur d’inflation",
  freeTool: "Gratuit · sans compte",
  readable: "À lire",
  choose: "Choisir mon point de départ",
  returnHome: "Revenir à l’accueil",
  returnOverview: "Revenir aux trois parcours",
  returnExplore: "Revenir à l’explorateur",
  preparation: "Un premier repère",
  resume: "Retrouver cette entrée",
  resumeNote: "Gardez cette page dans vos favoris pour retrouver vos repères.",
  home: {
    eyebrow: "Prévoyance · Assurance · Retraite",
    heading: "Votre 3e pilier prépare-t-il vraiment votre retraite ?",
    discover: "Comprendre la méthode",
    account: "Accéder à mon compte",
    note: "Simulateurs gratuits et guides en accès libre, sans compte.",
    readingLabel: "Les premiers repères",
    readingTitle: "Les repères pour avancer.",
    readings: [
      {
        href: "/articles",
        label: "Les questions qui comptent",
        description: "Articles et réponses pour vous orienter.",
      },
      {
        href: "/glossaire",
        label: "Les mots de la prévoyance",
        description: "Des définitions pour mieux comprendre.",
      },
      {
        href: "/modeles",
        label: "Les modèles d’accompagnement",
        description: "Comparer les approches et leurs rôles.",
      },
    ],
    methodTeaser: "Choisir. Mesurer. Suivre. Adapter.",
    methodText:
      "Partir de ce que vous avez, le relier à votre objectif et garder une vue dans le temps.",
    methodAction: "Comprendre la méthode",
  },
  demo: {
    label: "Exemple fictif",
    title: "Un objectif. Une trajectoire. Un écart.",
    target: "Objectif retraite",
    trajectory: "Trajectoire de l’exemple",
    gap: "Écart illustré",
    targetValue: "65 ans",
    trajectoryValue: "71 ans",
    gapValue: "+6 ans",
    question: "L’écart est un point de départ.",
    note: "Aucune estimation personnelle. Ces chiffres illustrent une question à explorer.",
    action: "Comprendre cet exemple",
  },
  overviewPage: {
    title: "Trois parcours pour comprendre votre prévoyance — CoverView",
    description:
      "Un contrat, un objectif retraite ou une comparaison : choisissez les repères et les outils qui vous aident à avancer.",
    heading: "Partez de votre question.",
    introduction:
      "Vous avez déjà un contrat, un objectif en tête ou des options à comparer. Chaque entrée commence par une question différente.",
    convergenceTitle: "Trois entrées, une même vue d’ensemble.",
    convergence:
      "Votre contrat, votre objectif et vos options font partie de la même réflexion. Commencez par votre question, puis élargissez la vue à votre situation.",
    status:
      "Les guides et les simulateurs sont accessibles sans compte. Retrouvez vos documents personnels dans Wallet après connexion.",
  },
  explorer: {
    title: "Explorer les parcours et espaces CoverView",
    description:
      "Retrouvez nos guides, les simulateurs gratuits et votre espace Wallet. Choisissez le point de départ qui répond à votre besoin.",
    heading: "Que souhaitez-vous explorer ?",
    introduction: "Un repère à comprendre, une démarche à découvrir ou un espace à rejoindre.",
    categories: "Les trois entrées de l’explorateur",
    navigation: "Toutes les destinations CoverView",
    understand: "Comprendre CoverView",
    tools: "Outils & démarches",
    spaces: "Vos espaces",
    accountStatus: "Accès après connexion",
    wallet: "Wallet et mon compte",
    open: "Explorer",
    sections: {
      understand: {
        slug: "comprendre",
        title: "Comprendre la prévoyance et CoverView — Guide",
        heading: "Comprendre, avant de décider.",
        description:
          "La méthode, les articles et les exemples pour mieux lire votre prévoyance et vos choix. Retrouvez ici les contenus disponibles de CoverView.",
        summary: "Méthode, articles et exemples pour éclairer vos choix.",
        status: "Lectures disponibles",
      },
      tools: {
        slug: "outils",
        title: "Vos outils et démarches de prévoyance | CoverView",
        heading: "Les démarches, étape par étape.",
        description:
          "Contrat, objectif retraite et comparaison : choisissez votre guide, explorez les simulateurs et réunissez vos documents.",
        summary: "Analyse, retraite et comparaison : comprendre chaque démarche.",
        status: "Guides et simulateurs",
      },
      spaces: {
        slug: "espaces",
        title: "Votre compte et les espaces CoverView",
        heading: "À chaque besoin, son espace.",
        description:
          "Accédez à Wallet pour retrouver vos documents et découvrez les espaces CoverView en préparation.",
        summary: "Votre compte Wallet et les autres espaces CoverView.",
        status: "Compte et espaces à découvrir",
      },
    },
  },
};
