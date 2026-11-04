/**
 * Page produit Hyperion (4 novembre 2026). Les chiffres de rendement, de frais et de simulation ne
 * sont pas écrits ici : ils viennent de `components/hyperion/hyperion-model.ts` ; les avis Google
 * sont dans `hyperion-reviews.ts`. Les textes s’adressent au visiteur ; les observations de travail
 * restent dans le ledger.
 */
import { hyperionOrder } from "./hyperion-order";
import { hyperionUi } from "./hyperion-ui";

export const hyperionCopy = {
  ...hyperionUi,
  order: hyperionOrder,
  seo: {
    title: "Hyperion, 3e pilier 3a à gestion active | CoverView",
    description:
      "Hyperion : la stratégie 3e pilier de CoverView dans un contrat 3a Liechtenstein Life. Gestion active, revue semestrielle, rendements 2016–2026, simulateur Monte Carlo, avis clients et commande en ligne.",
  },
  breadcrumb: {
    label: "Fil d’Ariane",
    home: "Accueil",
    category: "3e pilier",
    current: "Hyperion",
  },
  explorerLabel: "Hyperion · 3e pilier à gestion active",
  navLabel: "Hyperion · 3e pilier",
  navDescription:
    "La stratégie 3e pilier de CoverView : gestion active, rendements 2016 – 2026, simulateur et commande.",
  homeLink: "Découvrir Hyperion, notre 3e pilier",
  homeCta: "Découvrir Hyperion",
  hero: {
    eyebrow: hyperionUi.eyebrow,
    title: "Hyperion",
    subtitle: "Le 3e pilier qui vise votre patrimoine, pas seulement votre déduction.",
    rating: { label: "Note Google", value: "5/5", count: "15 avis", link: "Lire les avis" },
    partnerLabel: "Contrat porté par",
    partnerName: "Liechtenstein Life",
    stats: {
      annualised: { label: "Rendement annualisé", note: "2016 – 2026 · après frais modélisés" },
      current: { label: "Année en cours", note: "2026 · rendement communiqué" },
      rank: { label: "Classement 2026", value: "1er", note: "sur 8 solutions · 1er semestre" },
    },
    top: {
      badge: "Top 1 %",
      title: "Top 1 % des 3e piliers analysés",
      text: "Sur plus de 140’000 contrats analysés par notre partenaire Liechtenstein Life, pour la 4e année consécutive.",
    },
  },
  gallery: {
    label: "Visuels du produit",
    items: {
      illustration: "Le coffret Hyperion",
      performance: "Rendements annuels 2016 – 2026",
      top: "Top 1 % des 3e piliers analysés",
    },
    illustrationAlt:
      "Coffret Hyperion, 3e pilier, en trois quarts sur fond blanc, avec une liasse de billets, des pièces et un graphique en chandeliers en arrière-plan.",
    performanceAlt:
      "Diagramme en barres des rendements annuels de la stratégie Hyperion de 2016 à 2026.",
    box: { line1: "3e pilier", line2: "Stratégie de placement", spine: "Hyperion · 3e pilier" },
  },
  strip: {
    lead: "Ce qui fait Hyperion.",
    items: [
      "Gestion active",
      "Revue semestrielle",
      "Veille permanente",
      "Déductible 3a",
      "Liechtenstein Life",
    ],
  },
  advantages: {
    eyebrow: "AVANTAGES PRODUIT",
    title: "Une stratégie qui vit.\nPas un contrat qui dort.",
    description:
      "La plupart des 3e piliers sont réglés une fois, à la signature. Hyperion est suivi, revu et adapté : c’est ce travail continu qui fait la différence sur vingt ou trente ans.",
    items: [
      {
        icon: "refresh",
        title: "Une gestion vivante",
        text: "La stratégie est revue chaque semestre et ajustée : les allocations suivent les marchés au lieu de rester figées au jour de la signature.",
      },
      {
        icon: "radar",
        title: "Une veille active, en continu",
        text: "Entre deux revues, nous suivons les évolutions du marché et les nouvelles opportunités. Cette veille soutient les performances obtenues depuis 2016.",
      },
      {
        icon: "growth",
        title: "L’objectif : votre patrimoine",
        text: "Hyperion ne sert pas seulement à combler une lacune ou à déduire des impôts. Il vise à constituer le plus de patrimoine possible pour votre retraite.",
      },
      {
        icon: "medal",
        title: "Une vraie alternative",
        text: "Face aux solutions standard, Hyperion cherche à faire mieux que le marché et que les solutions comparées, avec un cadre de risque explicite et assumé.",
      },
      {
        icon: "shield",
        title: "Le cadre d’un 3a chez Liechtenstein Life",
        text: "Prévoyance liée 3a : versements déductibles du revenu imposable, couverture en cas de décès ou d’incapacité de gain selon les conditions du contrat.",
      },
      {
        icon: "person",
        title: "Un suivi humain et indépendant",
        text: "Courtier indépendant non lié, nous vous expliquons chaque décision. Votre contrat et vos documents vous suivent dans CoverView Wallet.",
      },
    ],
  },
  specs: {
    eyebrow: "FICHE TECHNIQUE",
    title: "Hyperion en bref.",
    rows: [
      { label: "Type de contrat", value: "Prévoyance liée 3a, assurance" },
      { label: "Assureur", value: "Liechtenstein Life" },
      { label: "Stratégie de placement", value: "Hyperion, conçue et suivie par CoverView" },
      { label: "Revue de la stratégie", value: "Semestrielle, veille continue entre deux revues" },
      {
        label: "Versement",
        value: "Dès 100 CHF par mois · plafond 3a 2026 : 7’258 CHF par an avec caisse de pension",
      },
      {
        label: "Frais annuels modélisés",
        value: "2,21 % par an, appliqués une fois aux rendements",
      },
      { label: "Couverture", value: "Décès et incapacité de gain, selon le contrat" },
      { label: "Historique disponible", value: "2016 – 2026, onze observations annuelles" },
      {
        label: "Retrait",
        value: "Dès cinq ans avant l’âge de référence AVS, ou motifs légaux anticipés",
      },
    ],
  },
  performance: {
    eyebrow: "PERFORMANCES · 2016 – 2026",
    title: "Dix années pleines.\nEt l’année en cours.",
    description:
      "Les rendements annuels communiqués pour la stratégie Hyperion, puis le taux annualisé après frais modélisés : ce que la stratégie a fait, année après année, hausses comme baisses.",
    kpis: {
      annualised: {
        label: "Rendement annualisé après frais",
        note: "2016 – 2026, frais de 2,21 % par an modélisés",
      },
      mean: {
        label: "Rendement annuel moyen communiqué",
        note: "Moyenne arithmétique des onze rendements",
      },
      current: { label: "2026, année en cours", note: "Rendement communiqué, avant frais" },
      positive: { label: "Années positives", note: "sur onze observations" },
    },
    growth: {
      label: "10’000 CHF investis début 2016",
      value: "{{amount}} CHF fin 2025",
      note: "Après frais modélisés, sans versement complémentaire ni retenue de contrat · {{current}} CHF avec l’année en cours",
    },
    chart: {
      title: "Rendements annuels communiqués, avant frais",
      current: "en cours",
      alt: "Rendements annuels de la stratégie Hyperion, 2016 à 2026, avant frais : {{values}}.",
    },
    detail: "Détail, sources et classement",
    note: "Rendements communiqués avant frais ; le taux annualisé applique une fois les frais annuels de 2,21 % modélisés. Les performances passées ne préjugent pas des performances futures ; le capital investi peut baisser, comme en 2018 et 2022.",
    dialog: {
      eyebrow: "DÉTAIL DES PERFORMANCES",
      title: "Chaque année.\nAvec sa source.",
      intro:
        "Les onze rendements utilisés par la page, le simulateur et les simulations Monte Carlo. Le taux annualisé est la moyenne géométrique des rendements après frais : expm1(moyenne(log1p(r))).",
      columns: {
        year: "Année",
        gross: "Communiqué",
        net: "Après frais modélisés",
        status: "Statut",
      },
      status: {
        reported: "Année civile",
        current: "Année en cours",
        legacy: "Série communiquée",
        communicated: "Communiqué 2026",
      },
      methodTitle: "Lecture",
      method: [
        "Les rendements 2016 – 2025 sont ceux communiqués pour la stratégie ; ils n’ont pas fait l’objet d’une vérification indépendante par un tiers. Le rendement 2026 est celui communiqué pour l’année en cours et compte comme une observation entière, sans extrapolation.",
        "Les frais annuels de 2,21 % sont appliqués une fois à chaque rendement : r_net = (1 + r) × (1 − 2,21 %) − 1. Les retenues des cinq premières années et la prime de risque du contrat sont appliquées dans le simulateur, pas dans ce tableau.",
        "La composition de la stratégie et ses règles d’allocation sont présentées en entretien et dans la documentation remise aux clients.",
      ],
      rankingTitle: "Classement 2026 des performances",
      rankingIntro:
        "Huit solutions sélectionnées, comparées sur une base harmonisée en francs suisses, au premier semestre 2026.",
      rankingColumns: { rank: "Rang", solution: "Solution", performance: "Performance 2026" },
      rankingNote:
        "Performances 2026 selon les dernières factsheets disponibles, converties en CHF lorsque la devise de référence diffère. Les périodes exactes, les frais, les niveaux de risque et les expositions peuvent varier selon les solutions. Les performances passées ne préjugent pas des performances futures.",
      ranking: [
        {
          rank: 1,
          name: "Hyperion",
          company: "CoverView · Liechtenstein Life",
          performance: 0.218451964784196,
        },
        { rank: 2, name: "VIAC", company: "VIAC", performance: 0.123 },
        { rank: 3, name: "Allianz", company: "Allianz", performance: 0.101358234915181 },
        { rank: 4, name: "finpension", company: "finpension", performance: 0.0916 },
        { rank: 5, name: "Generali", company: "Generali", performance: 0.087 },
        { rank: 6, name: "Pax", company: "Pax", performance: 0.0743 },
        { rank: 7, name: "Helvetia", company: "Helvetia", performance: 0.061 },
        { rank: 8, name: "AXA", company: "AXA", performance: 0.0501 },
      ],
      close: "Fermer",
    },
  },
  proof: {
    eyebrow: "RÉSULTATS DE CLIENTS ACCOMPAGNÉS",
    title: "Les captures.\nTelles qu’affichées.",
    description:
      "Des performances affichées dans les applications de clients que nous accompagnons, avec la période propre à chaque vue. Elles ne représentent pas une moyenne et ne sont pas directement comparables entre elles.",
    all: "Voir les sept captures",
    note: "Résultats individuels sélectionnés, sur des périodes différentes. Les performances passées ne garantissent pas les résultats futurs ; le capital peut diminuer.",
    dialogTitle: "Les résultats.\nAvec leur contexte.",
    close: "Fermer",
  },
  reviews: {
    eyebrow: "AVIS CLIENTS",
    title: "Ce que nos clients disent.",
    subtitle: "Note moyenne sur Google 5/5 · 15 avis",
    google: "Avis Google",
    stars: "{{rating}} étoiles sur 5",
    readAll: "Lire tous les avis",
    dialogTitle: "Les avis Google.",
    note: "Avis publiés sur Google. Plusieurs citent Bassa Martin Partners, notre ancienne raison sociale : la société s’appelle aujourd’hui CoverView Sàrl.",
    close: "Fermer",
    pause: "Mettre les avis en pause",
    play: "Faire défiler les avis",
  },
  faq: {
    eyebrow: "QUESTIONS FRÉQUENTES",
    title: "Les bonnes questions.\nDes réponses directes.",
    items: [
      {
        question: "Qu’est-ce qu’Hyperion, exactement ?",
        answer:
          "Hyperion est la stratégie de placement conçue et suivie par CoverView pour le 3e pilier. Elle est mise en œuvre dans un contrat de prévoyance liée 3a de Liechtenstein Life : l’assureur porte le contrat, la couverture et la garde des avoirs ; CoverView choisit l’allocation, la revoit chaque semestre et l’adapte entre deux revues selon sa veille des marchés.",
      },
      {
        question: "Quels sont les frais d’Hyperion ?",
        answer:
          "Le modèle de la page applique des frais annuels de 2,21 % aux rendements, une prime de risque mensuelle de 5 CHF à 30 CHF selon le versement, et une retenue de 67 % des versements pendant les cinq premières années du contrat. Ce sont les hypothèses du simulateur, identiques à celles d’horizon3.finance ; le périmètre exact des frais figure dans l’offre Liechtenstein Life que vous recevez avant de signer.",
      },
      {
        question: "Les performances affichées sont-elles garanties ?",
        answer:
          "Non. Les rendements 2016 – 2026 sont des performances passées, communiquées pour la stratégie ; ils comprennent deux années négatives, dont −30,82 % en 2022. Le capital investi peut baisser. Le simulateur et les simulations Monte Carlo donnent des ordres de grandeur, pas une promesse.",
      },
      {
        question: "Que signifie « Top 1 % des 3e piliers » ?",
        answer:
          "Notre partenaire Liechtenstein Life analyse chaque année les contrats de 3e pilier qu’il porte, plus de 140’000. Hyperion figure dans le 1 % le plus performant de cette analyse pour la quatrième année consécutive. C’est un classement établi par l’assureur sur son portefeuille, pas une garantie pour l’avenir.",
      },
      {
        question: "Combien puis-je verser chaque année ?",
        answer:
          "En 2026, le plafond déductible du pilier 3a est de 7’258 CHF pour une personne affiliée à une caisse de pension, soit environ 604 CHF par mois. Sans caisse de pension, il est de 20 % du revenu de l’activité lucrative, au maximum 36’288 CHF. Le simulateur accepte un versement dès 100 CHF par mois.",
      },
      {
        question: "Puis-je transférer un 3e pilier existant vers Hyperion ?",
        answer:
          "Oui, un transfert de 3a à 3a est possible : indiquez le montant comme capital de départ dans le simulateur. Avant tout transfert, votre conseiller examine avec vous les coûts de sortie et les garanties de votre contrat actuel : conserver un contrat adapté reste une option, et nous vous le dirons.",
      },
      {
        question: "Suis-je couvert en cas de décès ou d’incapacité de gain ?",
        answer:
          "Le contrat Liechtenstein Life prévoit une couverture en cas de décès ou d’incapacité de gain, dont l’étendue dépend des conditions choisies. Les prestations exactes figurent dans l’offre et sont expliquées avant la signature.",
      },
      {
        question: "Et si je dois réduire ou suspendre mes versements ?",
        answer:
          "Les conditions de réduction, de suspension et de rachat sont fixées par le contrat Liechtenstein Life ; nous les passons en revue avec vous avant la signature, car une assurance diffère d’un compte bancaire sur ce point. Un engagement compatible avec votre budget est la première règle d’un bon 3e pilier.",
      },
      {
        question: "Comment se passe la commande ?",
        answer:
          "Vous laissez vos coordonnées et vos paramètres. Un conseiller CoverView vous rappelle sous 24 heures ouvrées pour vérifier votre situation, puis vous recevez l’offre et les documents contractuels de Liechtenstein Life. Rien n’est prélevé et rien ne vous engage avant votre signature. Le contrat rejoint ensuite vos documents dans CoverView Wallet.",
      },
      {
        question: "Hyperion convient-il à tout le monde ?",
        answer:
          "Non. Hyperion s’adresse à un horizon long et suppose d’accepter des fluctuations marquées d’une année à l’autre. Pour un horizon court ou une faible tolérance aux baisses, d’autres stratégies sont plus adaptées : votre conseiller vous le dira.",
      },
    ],
  },
  closing: {
    eyebrow: "PRÊT À COMMENCER",
    title: "Faites travailler votre 3e pilier.\nDès ce mois-ci.",
    description:
      "Commandez Hyperion en deux minutes. Un conseiller vous rappelle, vous recevez l’offre Liechtenstein Life et vous décidez librement.",
    cta: "Commander Hyperion",
    note: "Sans engagement avant la signature · Courtier indépendant non lié",
  },
} as const;
