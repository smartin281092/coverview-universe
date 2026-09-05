// Inventaire propriétaire de la navigation publique (§22/66). Les IDs restent hors UI.
export const journeys = [
  {
    slug: "analyser-3p",
    owner: "S-025",
    label: "Analyser mon 3P",
    title: "J’ai déjà un 3e pilier.",
    question:
      "Où est investi mon argent ? Combien cela coûte ? Quelles protections et quel potentiel ?",
    action: "Analyser mon contrat",
    heading: "Comprendre mon contrat de 3e pilier",
    description:
      "L’analyse de contrat n’est pas encore disponible. Découvrez les questions qu’elle devra éclairer avant de transmettre un document.",
    preparation:
      "Repérez dans votre contrat l’épargne, les frais et les protections. Distinguer ces éléments est le premier pas pour comprendre ce que vous avez.",
    unavailable:
      "L’analyse et le dépôt de documents ne sont pas encore disponibles. Aucun contrat ne peut être envoyé depuis cette page.",
  },
  {
    slug: "calculer-retraite",
    owner: "S-028",
    label: "Calculer ma retraite",
    title: "Je veux préparer ma retraite.",
    question: "Combien me faudra-t-il ? Pour quel niveau de vie ? Quel effet de l’inflation ?",
    action: "Calculer mon objectif",
    heading: "Définir mon objectif retraite",
    description:
      "Le calculateur retraite n’est pas encore disponible. Commencez par distinguer votre objectif de niveau de vie et la trajectoire à évaluer.",
    preparation:
      "Commencez par le niveau de vie souhaité et l’horizon de votre retraite. Un âge cible est un objectif ; il ne prouve pas que les ressources nécessaires seront réunies.",
    unavailable:
      "Le calculateur n’est pas encore disponible. Cette page ne produit aucune estimation personnelle ni probabilité.",
  },
  {
    slug: "comparer",
    owner: "S-030",
    label: "Comparer",
    title: "Je veux comparer.",
    question:
      "Quelles stratégies correspondent à mon objectif ? Avec quelles hypothèses, quels risques et quelle probabilité ?",
    action: "Comparer les stratégies",
    heading: "Comparer des stratégies pour un même objectif",
    description:
      "Le comparateur de stratégies n’est pas encore disponible. Découvrez pourquoi une comparaison commence par un objectif et des hypothèses communs.",
    preparation:
      "Pour comparer, gardez le même objectif et le même horizon. Les coûts, les protections et les hypothèses comptent aussi : un chiffre de rendement isolé ne suffit pas.",
    unavailable:
      "Le comparateur n’est pas encore disponible. Aucune stratégie n’est classée ou recommandée dans cette préversion.",
  },
] as const;

export const plannedPages = [
  {
    slug: "retrouver-lpp",
    label: "Retrouver mes avoirs LPP",
    owner: "S-021",
    group: "tools",
    description:
      "Retrouver les avoirs de prévoyance professionnelle est une démarche distincte de l’analyse d’un 3e pilier.",
    unavailable:
      "La demande de recherche LPP n’est pas encore disponible. Aucun organisme n’est contacté depuis cette page.",
  },
  {
    slug: "recuperer-contrats",
    label: "Récupérer mes contrats",
    owner: "S-020",
    group: "tools",
    description:
      "Réunir les contrats existants doit permettre de partir des documents et des garanties réellement souscrites.",
    unavailable:
      "La demande de récupération n’est pas encore disponible. Aucune compagnie n’est contactée.",
  },
  {
    slug: "signature",
    label: "Procurations et signature",
    owner: "S-018",
    group: "tools",
    description:
      "Une procuration ou un mandat doit identifier la démarche et le consentement qu’il engage.",
    unavailable:
      "La préparation et la signature de documents ne sont pas encore disponibles. Aucun mandat n’est créé.",
  },
  {
    slug: "partager",
    label: "Sauvegarde, favoris et partage",
    owner: "S-032",
    relatedOwners: ["S-013"],
    group: "tools",
    description:
      "Conserver une analyse et partager un résultat sont deux actions différentes, à réaliser avec le contrôle de leur visibilité.",
    unavailable:
      "La sauvegarde de résultats, les favoris et leur partage ne sont pas encore disponibles.",
  },
  {
    slug: "services",
    label: "Services",
    owner: "S-011",
    group: "understand",
    description:
      "Les besoins envisagés couvrent le 3e pilier, la LPP, l’audit, les contrats, la prévoyance et les assurances.",
    unavailable:
      "Les services sont en préparation. Aucune prestation ne peut être commandée dans cette préversion.",
  },
  {
    slug: "vision",
    label: "Vision & philosophie",
    owner: "S-011",
    group: "understand",
    description:
      "Comprendre l’existant, tenir compte de son horizon, puis suivre et adapter : les principes qui guident le projet CoverView.",
    unavailable:
      "La présentation détaillée de la vision est en préparation. Vous pouvez déjà lire les étapes de la méthode.",
  },
  {
    slug: "modeles",
    label: "Comparaison des modèles de service",
    owner: "S-011",
    group: "understand",
    description:
      "Agent, courtier et CoverView : la future présentation distinguera les approches et leurs responsabilités.",
    unavailable: "La comparaison documentée des modèles de service n’est pas encore publiée.",
  },
  {
    slug: "benchmark",
    label: "Benchmark",
    owner: "S-011",
    group: "understand",
    description:
      "Un benchmark situe une solution par rapport à un ensemble comparable, avec des critères et une méthode explicites.",
    unavailable:
      "Le contenu détaillé et les références du benchmark sont en préparation. Aucun classement de produits n’est disponible.",
  },
  {
    slug: "etudes-de-cas",
    label: "Études de cas",
    owner: "S-011",
    group: "understand",
    description:
      "Un cas relie une situation, une analyse, un benchmark, une décision et un résultat documenté.",
    unavailable:
      "Aucune étude de cas validée n’est publiée ici. La démonstration de l’accueil est entièrement fictive.",
  },
  {
    slug: "rapports",
    label: "Rapports",
    owner: "S-011",
    group: "understand",
    description:
      "Un rapport doit permettre de retrouver les observations, les hypothèses et les raisons d’une décision.",
    unavailable:
      "Les rapports et extraits validés sont en préparation. Aucun rapport client n’est exposé.",
  },
  {
    slug: "articles",
    label: "Articles & FAQ",
    owner: "S-011",
    group: "understand",
    description:
      "Les contenus de référence ont vocation à répondre aux questions de prévoyance avec des sources identifiables.",
    unavailable:
      "Les articles et la FAQ documentée sont en préparation. Aucun assistant de conseil n’est actif.",
  },
  {
    slug: "contact",
    label: "Contact / Expert",
    owner: "S-012",
    group: "understand",
    description:
      "Un échange avec un expert doit partir de votre besoin et des éléments que vous choisissez de transmettre.",
    unavailable:
      "La prise de contact et de rendez-vous n’est pas encore ouverte. Aucun message n’est envoyé depuis cette préversion.",
  },
  {
    slug: "retire",
    label: "CoverView Retire",
    owner: "S-050",
    group: "spaces",
    description:
      "Retire est le volet retraite prévu dans Wallet : explorer le niveau de vie, les budgets et les décisions dans le temps.",
    unavailable:
      "Retire Check et le plan retraite ne sont pas encore disponibles. Aucune offre payante n’est activée.",
  },
  {
    slug: "miles",
    label: "Miles & avantages",
    owner: "S-103",
    group: "spaces",
    description:
      "Le programme de fidélité envisagé reliera les Miles, les avantages et leurs conditions d’utilisation.",
    unavailable: "Le programme n’est pas encore actif. Aucun Mile ni avantage n’est attribué.",
  },
  {
    slug: "carte-digitale",
    label: "Carte digitale",
    owner: "S-101",
    group: "spaces",
    description: "La carte de membre est prévue dans l’espace personnel, avec un accès contrôlé.",
    unavailable:
      "La création et l’activation de la carte ne sont pas encore disponibles, même après connexion.",
  },
  {
    slug: "partners",
    label: "CoverView Partners",
    owner: "S-110",
    group: "spaces",
    description:
      "L’espace Partners est prévu pour les apporteurs et partenaires, dans leur périmètre autorisé.",
    unavailable:
      "L’espace partenaire n’est pas encore disponible. Aucun accès ni commission n’est attribué.",
  },
  {
    slug: "intelligence",
    label: "CoverView Intelligence",
    owner: "S-112",
    group: "spaces",
    description:
      "Intelligence est l’espace envisagé pour les analyses, benchmarks et scénarios professionnels.",
    unavailable:
      "L’espace professionnel n’est pas encore disponible. Aucun catalogue professionnel n’est publié.",
  },
  {
    slug: "exchange",
    label: "CoverView Exchange",
    owner: "S-114",
    group: "spaces",
    description:
      "Exchange est un domaine distinct du projet, dont les opérations restent à spécifier et à qualifier.",
    unavailable:
      "Exchange n’est pas ouvert. Aucun engagement ni opération financière n’est possible.",
  },
] as const;

export const acquisition = {
  availabilityTitle: "{{label}} : disponibilité — CoverView",
  overview: "Comment ça marche",
  explore: "Explorer CoverView",
  method: "La méthode",
  founder: "Sébastien Martin",
  coming: "En préparation",
  readable: "À lire",
  choose: "Choisir mon point de départ",
  returnHome: "Revenir à l’accueil",
  returnOverview: "Revenir aux trois parcours",
  returnExplore: "Revenir à l’explorateur",
  preparation: "Un premier repère",
  resume: "Retrouver cette entrée",
  resumeNote:
    "Vous pouvez conserver cette adresse pour revenir à ce parcours. Aucun résultat personnel n’est enregistré.",
  home: {
    eyebrow: "Prévoyance · Assurance · Retraite",
    heading: "Votre 3e pilier vous rapproche-t-il de la retraite que vous souhaitez ?",
    analyse: "Analyser mon 3e pilier",
    calculate: "Calculer mon objectif retraite",
    note: "Découvrez les parcours. L’analyse, le calculateur et le comparateur sont en préparation.",
    methodTeaser: "Choisir. Mesurer. Suivre. Adapter.",
    methodText:
      "Partir de ce que vous avez, le relier à votre objectif et garder une vue dans le temps.",
    methodAction: "Comprendre la méthode",
  },
  demo: {
    label: "Exemple fictif · aucune estimation personnelle",
    title: "Un objectif. Une trajectoire. Un écart.",
    target: "Objectif retraite",
    trajectory: "Trajectoire de l’exemple",
    gap: "Écart illustré",
    targetValue: "65 ans",
    trajectoryValue: "71 ans",
    gapValue: "+6 ans",
    question: "Et si votre stratégie pouvait faire mieux ?",
    note: "Ces chiffres illustrent une question, pas votre situation ni un résultat calculé.",
    action: "Comprendre cet exemple",
  },
  overviewPage: {
    title: "Trois parcours pour comprendre votre prévoyance — CoverView",
    description:
      "Analyse d’un 3e pilier, objectif retraite ou comparaison : choisissez votre entrée et découvrez les questions traitées et la disponibilité de chaque outil.",
    heading: "Partez de votre question.",
    introduction:
      "Vous avez déjà un contrat, un objectif en tête ou des options à comparer. Chaque entrée commence par une question différente.",
    convergenceTitle: "Trois entrées, une même vue d’ensemble.",
    convergence:
      "Le parcours prévu reliera contrat, objectif et comparaison au même profil et aux mêmes moteurs. Vous pourrez compléter votre point de départ progressivement, puis retrouver vos résultats dans Wallet.",
    status:
      "Aujourd’hui, vous pouvez explorer ces parcours sans compte. Les outils et la sauvegarde de résultats restent en préparation.",
  },
  explorer: {
    title: "Explorer les parcours et espaces CoverView",
    description:
      "Retrouvez les pages de présentation, les futurs outils et les espaces CoverView. Leur état est indiqué avant toute démarche ou connexion.",
    heading: "Tous vos points de repère.",
    introduction:
      "Les pages de présentation sont à lire librement. Les outils, contenus détaillés et services en préparation indiquent ce qui reste indisponible.",
    navigation: "Toutes les destinations CoverView",
    understand: "Comprendre CoverView",
    tools: "Outils & démarches",
    spaces: "Vos espaces",
    accountStatus: "Disponibilité de la connexion",
    wallet: "Wallet et mon compte",
  },
};
