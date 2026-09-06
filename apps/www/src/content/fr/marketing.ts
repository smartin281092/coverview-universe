// Narration publique : bible §2–6, §21–28, §66 et R1–R2.
// Les CTA ouvrent des contenus existants ou le compte ; aucune capacité future
// n'est annoncée comme active. Les sources détaillées sont dans le README www.
export const marketing = {
  seo: {
    title: "Assurance, prévoyance et retraite en Suisse | CoverView",
    description:
      "Comprenez vos assurances, votre 3e pilier et votre objectif retraite. Découvrez la méthode CoverView pour relier vos contrats aux décisions qui comptent.",
  },
  nav: {
    services: { label: "Vos besoins", href: "/services" },
    method: { label: "Notre méthode", href: "/methode" },
    resources: { label: "Comprendre", href: "/articles" },
    account: { label: "Mon compte", href: "/account" },
    all: { label: "Explorer CoverView", href: "/explorer" },
  },
  hero: {
    eyebrow: "Assurance. Prévoyance. Retraite.",
    title: "Votre prévoyance.\nEnfin plus claire.",
    description:
      "Votre 3e pilier, vos assurances, votre retraite : comprenez ce que vous avez, ce que vous souhaitez et les questions à poser avant de décider.",
    primary: { label: "Trouver mon point de départ", href: "/overview" },
    secondary: { label: "Découvrir notre méthode", href: "/methode" },
    note: "Commencez par comprendre. Sans compte, à votre rythme.",
    imageAlt:
      "Porte-documents blanc et argent, feuilles réunies sous une protection transparente courbe",
  },
  trust: ["Pensé pour la Suisse", "L’objectif avant le produit", "Une méthode à examiner"],
  problem: {
    eyebrow: "Le point de départ",
    title: "Des contrats, vous en avez.\nLa vue d’ensemble, beaucoup moins.",
    description:
      "Un contrat signé il y a plusieurs années. Des documents éparpillés. Un projet de retraite encore difficile à chiffrer. La première question est simple : comment tout cela fonctionne-t-il ensemble ?",
    questions: [
      "Que contient réellement mon 3e pilier ?",
      "Quelles protections ai-je déjà ?",
      "Mes choix sont-ils cohérents avec mes projets ?",
    ],
    conclusion:
      "CoverView part de ces questions pour relier votre situation, vos objectifs et les décisions à prendre.",
  },
  benefits: {
    eyebrow: "Ce qui devient plus clair",
    title: "Comprendre l’essentiel.\nDécider avec du recul.",
    description:
      "Une décision de prévoyance concerne à la fois votre argent, votre protection et votre horizon. Ces trois dimensions méritent d’être regardées ensemble.",
    items: [
      {
        eyebrow: "Vos contrats",
        title: "Savoir ce que vous avez.",
        description:
          "Épargne, frais, protections, conditions : distinguez les éléments de votre contrat et les informations qui restent à vérifier.",
        href: "/services#3e-pilier",
        linkLabel: "Comprendre mon 3e pilier",
      },
      {
        eyebrow: "Vos projets",
        title: "Donner un cap à votre retraite.",
        description:
          "Partez du niveau de vie que vous souhaitez, de votre horizon et de vos ressources. Un objectif précis donne du sens à la comparaison.",
        href: "/retire",
        linkLabel: "Préparer les bonnes questions",
      },
      {
        eyebrow: "Vos choix",
        title: "Comparer sur les bonnes bases.",
        description:
          "Regardez les coûts, les risques et la flexibilité dans un même cadre. Un rendement isolé ne raconte pas toute l’histoire.",
        href: "/benchmark",
        linkLabel: "Comprendre le benchmark",
      },
    ],
  },
  pillars: {
    eyebrow: "Vos besoins, reliés",
    title: "Une vie. Plusieurs sujets.\nUne approche d’ensemble.",
    description:
      "Assurance, prévoyance et retraite se rencontrent dans vos décisions du quotidien. Explorez le sujet qui vous concerne aujourd’hui, puis élargissez la vue.",
    items: [
      {
        eyebrow: "Assurance",
        title: "Comprendre votre protection.",
        description:
          "Qu’est-ce qui est couvert, dans quelles conditions et avec quelles limites ? Le point de départ reste votre contrat et les documents qui l’accompagnent.",
        href: "/services#assurances",
        linkLabel: "Explorer les questions de couverture",
      },
      {
        eyebrow: "Prévoyance",
        title: "Relier le 3e pilier et la LPP.",
        description:
          "Votre contrat individuel et vos avoirs professionnels appartiennent à la même réflexion : ce que vous détenez aujourd’hui et la place de chaque élément dans votre projet.",
        href: "/services#lpp",
        linkLabel: "Faire le point sur la prévoyance",
      },
      {
        eyebrow: "Retraite",
        title: "Penser votre futur niveau de vie.",
        description:
          "Horizon, dépenses, revenus, rente ou capital : clarifiez d’abord les décisions à préparer, avant de chercher une réponse chiffrée.",
        href: "/retire",
        linkLabel: "Découvrir l’approche retraite",
      },
    ],
  },
  steps: {
    eyebrow: "La méthode CoverView",
    title: "Votre objectif d’abord.\nLe produit ensuite.",
    description:
      "L’horizon, la situation et les contraintes donnent le cadre. La méthode relie ensuite l’analyse à la décision, puis au suivi dans le temps.",
    items: [
      {
        number: "01",
        title: "Comprendre",
        description: "Partir des documents, identifier ce que vous avez et ce qui manque.",
      },
      {
        number: "02",
        title: "Comparer",
        description:
          "Mettre les solutions en perspective avec des critères et des hypothèses communs.",
      },
      {
        number: "03",
        title: "Décider",
        description: "Examiner les compromis, y compris l’intérêt de conserver l’existant.",
      },
      {
        number: "04",
        title: "Réévaluer",
        description: "Revenir sur la décision lorsque vos projets ou ses hypothèses évoluent.",
      },
    ],
    action: { label: "Voir la méthode complète", href: "/methode" },
  },
  proof: {
    eyebrow: "La confiance se construit",
    title: "Une méthode visible.\nDes conclusions à expliquer.",
    description:
      "Vous devez pouvoir comprendre pourquoi une question est posée, sur quels critères une comparaison repose et ce qu’elle ne permet pas de conclure.",
    items: [
      {
        title: "Des critères explicites",
        description:
          "Frais, protections, risques, flexibilité : le cadre de lecture est accessible avant toute décision.",
        href: "/articles/lire-un-benchmark",
        linkLabel: "Lire une comparaison pas à pas",
      },
      {
        title: "Le choix de conserver",
        description:
          "Une analyse n’implique pas de changer. Une décision de maintien doit pouvoir être expliquée autant qu’une adaptation.",
        href: "/articles/pourquoi-conserver",
        linkLabel: "Comprendre cette approche",
      },
      {
        title: "Une origine identifiable",
        description:
          "La vision, la méthode et les sources des contenus sont consultables. Les exemples pédagogiques restent distincts des résultats clients.",
        href: "/sources",
        linkLabel: "Consulter les sources",
      },
    ],
  },
  faq: {
    eyebrow: "Vos questions",
    title: "Avant de commencer.",
    items: [
      {
        question: "Dois-je déjà savoir ce que je cherche ?",
        answer:
          "Non. Vous pouvez partir d’un contrat que vous comprenez mal, d’une question sur votre retraite ou de plusieurs options à comparer. La page « Comment ça marche » vous aide à choisir les premières questions à examiner.",
        href: "/overview",
        linkLabel: "Choisir mon point de départ",
      },
      {
        question: "Analyser mon contrat signifie-t-il devoir en changer ?",
        answer:
          "Non. Comprendre l’existant vient avant toute proposition de changement. Il faut examiner ce que le contrat apporte, ses limites et ses conditions, puis les relier à votre objectif. Conserver le contrat peut faire partie des options à étudier.",
        href: "/articles/pourquoi-conserver",
        linkLabel: "Lire pourquoi conserver reste une option",
      },
      {
        question: "Comment savoir si deux 3es piliers sont comparables ?",
        answer:
          "Commencez par leur objectif, leur catégorie et les contraintes qu’ils doivent respecter. Regardez ensuite les coûts, les protections, les risques, la flexibilité et la période observée. Une comparaison utile explique son cadre ; elle ne se limite pas à un chiffre de rendement.",
        href: "/benchmark",
        linkLabel: "Découvrir le cadre de comparaison",
      },
      {
        question: "Faut-il un compte pour découvrir CoverView ?",
        answer:
          "Les guides, la méthode et les articles sont accessibles sans compte. La page de connexion donne accès à votre compte CoverView lorsque la connexion est disponible. La lecture des contenus publics ne demande aucun document personnel.",
        href: "/account",
        linkLabel: "Accéder à la page de connexion",
      },
      {
        question: "Puis-je déjà envoyer un contrat ou obtenir une simulation ?",
        answer:
          "Pas encore. Le dépôt de contrats, les analyses personnalisées et les simulateurs ne sont pas ouverts. Vous pouvez dès maintenant explorer la méthode, les critères de comparaison et les questions à préparer pour votre situation.",
        href: "/outils",
        linkLabel: "Voir les parcours et leur disponibilité",
      },
      {
        question: "CoverView s’adresse-t-il uniquement à la retraite ?",
        answer:
          "La retraite est un point d’entrée. L’approche couvre aussi la compréhension des assurances, du 3e pilier, de la prévoyance professionnelle et des documents contractuels. L’objectif est de relier ces sujets à vos besoins, plutôt que de les examiner séparément.",
        href: "/services",
        linkLabel: "Explorer mes besoins",
      },
    ],
  },
  closing: {
    eyebrow: "Le prochain pas",
    title: "Commencez par une question.\nAvancez avec une vue plus claire.",
    description:
      "Vous n’avez pas besoin de tout comprendre aujourd’hui. Choisissez ce qui vous préoccupe et découvrez les premiers repères.",
    primary: { label: "Trouver mon point de départ", href: "/overview" },
    secondary: { label: "Accéder à mon compte", href: "/account" },
  },
  overview: {
    seo: {
      title: "Comment fonctionne CoverView ? Trois points de départ",
      description:
        "Un 3e pilier à comprendre, une retraite à préparer ou des options à comparer : choisissez les premières questions à examiner avec la méthode CoverView.",
    },
    eyebrow: "Comment ça marche",
    title: "Partez de votre question.",
    description:
      "Pas besoin d’avoir déjà une stratégie. Un contrat, un projet ou un doute suffit pour commencer à mettre les choses à plat.",
    journeys: [
      {
        eyebrow: "J’ai un contrat",
        title: "Que contient mon 3e pilier ?",
        description:
          "Où va mon épargne ? Quels frais sont prévus ? Quelles protections et quelle marge de manœuvre ? Identifiez ce que vous souhaitez comprendre avant toute modification.",
        questions: [
          "L’épargne et les placements",
          "Les frais et les protections",
          "La flexibilité et les conditions de sortie",
        ],
        action: { label: "Comprendre les points à examiner", href: "/services#3e-pilier" },
      },
      {
        eyebrow: "J’ai un projet",
        title: "Quelle retraite est-ce que je souhaite ?",
        description:
          "Partez de votre niveau de vie, de votre horizon et des ressources à réunir. Distinguez votre objectif personnel des hypothèses qui serviront à l’évaluer.",
        questions: [
          "Le niveau de vie souhaité",
          "L’horizon et les ressources",
          "Les décisions à préparer",
        ],
        action: { label: "Explorer les questions de retraite", href: "/retire" },
      },
      {
        eyebrow: "J’ai plusieurs options",
        title: "Comment les comparer correctement ?",
        description:
          "Remettez les propositions dans un cadre commun. Comprendre les compromis demande de regarder les risques, les coûts et les contraintes autant que les résultats affichés.",
        questions: [
          "Le même objectif et le même horizon",
          "Des critères comparables",
          "Les compromis de chaque option",
        ],
        action: { label: "Découvrir les critères de comparaison", href: "/benchmark" },
      },
    ],
    convergenceTitle: "Les questions se rejoignent. Votre réflexion aussi.",
    convergenceDescription:
      "Comprendre votre contrat aide à préciser les ressources dont vous disposez. Votre objectif donne le cadre de la comparaison. La méthode CoverView relie ces étapes pour garder le sens de chaque décision.",
    availability:
      "Les lectures sont ouvertes. Les analyses personnalisées, les calculs et la sauvegarde de résultats seront disponibles dans les parcours dédiés ; ils ne sont pas encore activés.",
    action: { label: "Découvrir la méthode complète", href: "/methode" },
  },
  services: {
    seo: {
      title: "Assurance, 3e pilier, LPP et retraite : vos besoins | CoverView",
      description:
        "Contrats d’assurance, 3e pilier, prévoyance professionnelle et retraite : identifiez les informations et les questions à réunir pour comprendre votre situation.",
    },
    eyebrow: "Vos besoins",
    title: "Les sujets qui comptent.\nUne réflexion d’ensemble.",
    description:
      "Votre protection, votre épargne et votre futur niveau de vie se répondent. Commencez par le sujet qui vous concerne, puis replacez-le dans votre situation.",
    availability:
      "Cette page vous aide à préparer votre réflexion. Les demandes de documents, analyses personnalisées et démarches ne sont pas encore ouvertes.",
    action: { label: "Choisir mon point de départ", href: "/overview" },
  },
  account: {
    eyebrow: "Votre compte CoverView",
    title: "Un même compte.\nUn point de repère.",
    description: "Retrouvez votre connexion et accédez à votre espace personnel dans Wallet.",
    publicAction: { label: "Découvrir CoverView sans compte", href: "/overview" },
  },
  footer: {
    statement: "Vos contrats. Vos objectifs. Une vue d’ensemble.",
    description: "Assurance, prévoyance et retraite en Suisse.",
    copyright: "CoverView",
    resources: "Comprendre",
    company: "CoverView",
    account: "Votre espace",
    availability: "Les outils personnalisés sont en préparation.",
    links: {
      glossary: { label: "Glossaire", href: "/glossaire" },
      vision: { label: "Notre vision", href: "/vision" },
      questions: { label: "Vos questions", href: "/articles/questions-frequentes" },
      sources: { label: "Nos sources", href: "/sources" },
      overview: { label: "Comment ça marche", href: "/overview" },
      contact: { label: "Contact", href: "/contact" },
    },
  },
} as const;
