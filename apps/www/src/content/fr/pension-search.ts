// Page « Retrouver mes avoirs LPP » (4 novembre 2026) : structure inspirée de la page d’accueil de
// Kala, contenus propres à CoverView. Aucun chiffre commercial, avis ou montant retrouvé n’est
// affiché : seuls des faits sourcés (art. 4 LFLP, procédure de la Centrale du 2e pilier).
export const pensionSearch = {
  seo: {
    title: "Retrouver mes avoirs LPP oubliés | CoverView",
    description:
      "Un ancien employeur, une pause, un départ de Suisse : votre 2e pilier dort peut-être sur un compte de libre passage. Lancez la recherche gratuite en quelques minutes et suivez-la dans votre Wallet.",
  },
  cta: "Retrouver mes avoirs",
  ctaUnavailable: "La commande en ligne est momentanément fermée.",
  noscript:
    "Le formulaire de recherche demande JavaScript. Activez-le pour lancer votre recherche.",
  hero: {
    eyebrow: "2E PILIER · RECHERCHE D’AVOIRS",
    title: "Vos avoirs LPP oubliés.\nRetrouvés gratuitement.",
    description:
      "Un ancien employeur, une pause, un départ à l’étranger : une partie de votre 2e pilier peut dormir sur un compte de libre passage. Nous lançons la recherche pour vous, en ligne.",
    secondary: "Comment ça marche",
    assurances: ["Recherche gratuite", "100 % en ligne", "Sans engagement"],
    visual: {
      label: "LA RECHERCHE",
      center: "Vos avoirs",
      nodes: ["Anciennes caisses de pension", "Comptes de libre passage", "Institution supplétive"],
      caption: "La Centrale du 2e pilier interroge les institutions de prévoyance pour vous.",
      badge: "Environ 3 minutes de formulaire",
    },
  },
  tiles: [
    {
      href: "#probleme",
      eyebrow: "LE PROBLÈME",
      title: "Un avoir se perd vite",
      text: "Un changement d’emploi, une adresse qui change, un formulaire jamais renvoyé.",
    },
    {
      href: "#quand",
      eyebrow: "QUAND CHERCHER",
      title: "À chaque étape de vie",
      text: "Nouvel emploi, chômage, départ de Suisse, retraite : autant d’occasions de vérifier.",
    },
    {
      href: "#comment",
      eyebrow: "COMMENT",
      title: "Nous nous en occupons",
      text: "Vous remplissez le formulaire, nous lançons la recherche, vous suivez chaque étape.",
    },
  ],
  offer: {
    eyebrow: "01 / NOTRE SERVICE",
    title: "Deux étapes.\nLa première est gratuite.",
    description:
      "Savoir où se trouve votre argent ne coûte rien. Ce que vous en faites ensuite, vous le décidez librement.",
    steps: [
      {
        label: "ÉTAPE 1",
        title: "La recherche",
        price: "Gratuite",
        text: "Nous vérifions votre demande, la transmettons à la Centrale du 2e pilier et suivons la réponse pour vous.",
        points: [
          "Formulaire en ligne, environ 3 minutes",
          "Chaque étape visible dans votre Wallet",
          "Aucun paiement",
        ],
      },
      {
        label: "ÉTAPE 2",
        title: "Vos avoirs au bon endroit",
        price: "Facultative",
        text: "Si des avoirs sont retrouvés, nous vous aidons à décider : les regrouper, les transférer ou les placer, selon votre situation.",
        points: [
          "Analyse avant toute décision",
          "Conditions présentées avant tout engagement",
          "Vous restez libre de vos choix",
        ],
      },
    ],
    note: "L’étape 1 est gratuite et sans engagement. L’étape 2 est facultative.",
  },
  problem: {
    eyebrow: "02 / LE PROBLÈME",
    title: "Pourquoi des avoirs\nse perdent.",
    description:
      "Votre 2e pilier vous suit d’employeur en employeur, à condition que quelqu’un donne les bonnes instructions au bon moment.",
    items: [
      {
        title: "Un départ sans consigne",
        text: "Sans instruction de votre part, votre ancienne caisse verse votre prestation de sortie à l’institution supplétive, au plus tôt six mois et au plus tard deux ans après votre départ (art. 4 LFLP).",
      },
      {
        title: "Des comptes dispersés",
        text: "Plusieurs employeurs, plusieurs caisses : chaque changement peut laisser un compte de libre passage derrière vous.",
      },
      {
        title: "Des courriers perdus",
        text: "Un déménagement, un nouveau nom ou un départ à l’étranger, et les courriers de la caisse ne vous parviennent plus.",
      },
    ],
  },
  when: {
    eyebrow: "03 / QUAND CHERCHER",
    title: "Quand faire\nla recherche ?",
    description: "Chaque étape de votre parcours professionnel est une bonne occasion de vérifier.",
    items: [
      {
        icon: "briefcase",
        title: "Changement d’employeur",
        text: "Votre ancienne caisse a-t-elle bien transféré votre avoir ?",
      },
      {
        icon: "pause",
        title: "Chômage",
        text: "Sans nouvelle caisse, votre avoir attend sur un compte de libre passage.",
      },
      {
        icon: "compass",
        title: "Pause ou congé",
        text: "Un congé sabbatique ou une formation peut interrompre votre affiliation.",
      },
      {
        icon: "plane",
        title: "Départ de Suisse",
        text: "Avant de partir, sachez où se trouve chaque franc de votre 2e pilier.",
      },
      {
        icon: "sunrise",
        title: "Préparer sa retraite",
        text: "Rassemblez tous vos avoirs pour décider entre rente et capital.",
      },
      {
        icon: "spark",
        title: "Devenir indépendant",
        text: "Votre avoir peut rester dans le 2e pilier ou financer votre projet, selon les règles.",
      },
      {
        icon: "home",
        title: "Achat d’un logement",
        text: "Vos avoirs du 2e pilier peuvent compter pour votre propriété.",
      },
      {
        icon: "split",
        title: "Divorce",
        text: "Le partage de la prévoyance demande une vue complète des avoirs.",
      },
      {
        icon: "search",
        title: "Simple curiosité",
        text: "Vous ne savez pas ? La recherche est gratuite : autant vérifier.",
      },
    ],
  },
  how: {
    eyebrow: "04 / COMMENT ÇA MARCHE",
    title: "Trois étapes\navec CoverView.",
    description:
      "Vous pouvez aussi écrire vous-même à la Centrale du 2e pilier. Nous vous évitons les formulaires, le suivi et les relances.",
    with: "Avec CoverView",
    without: "Seul",
    steps: [
      {
        title: "Vous remplissez le formulaire",
        text: "En ligne, environ 3 minutes, depuis votre téléphone ou votre ordinateur.",
      },
      {
        title: "Nous lançons la recherche",
        text: "Nous vérifions votre dossier et transmettons la demande à la Centrale du 2e pilier.",
      },
      {
        title: "Vous suivez, puis décidez",
        text: "Chaque étape s’affiche dans votre Wallet ; un conseiller vous accompagne si vous le souhaitez.",
      },
    ],
    alone: [
      "Trouver le formulaire de la Centrale du 2e pilier",
      "Le compléter et l’envoyer",
      "Attendre la réponse par la poste",
      "Contacter chaque institution concernée",
      "Organiser vous-même un éventuel transfert",
    ],
  },
  wallet: {
    eyebrow: "05 / SUIVI",
    title: "Votre recherche,\nétape par étape.",
    description:
      "Votre demande est enregistrée dans votre Wallet dès son envoi. Chaque étape s’y affiche, datée, au moment où notre équipe l’enregistre.",
    benefits: [
      "Votre demande et vos informations au même endroit",
      "Chaque étape datée, sans progression fictive",
      "La suite de votre prévoyance dans le même espace",
    ],
    visualLabel: "EXEMPLE DE SUIVI",
    visualTitle: "Recherche d’avoirs LPP",
    // The real steps of a search (pension-searches module), shown here as an example.
    visualSteps: [
      "Demande reçue",
      "Vérification du dossier",
      "Recherche lancée",
      "Résultats reçus",
      "Démarche terminée",
    ],
  },
  trust: {
    eyebrow: "06 / CONFIANCE",
    title: "Pourquoi nous confier\nla recherche ?",
    items: [
      {
        title: "Courtier indépendant",
        text: "CoverView Sàrl n’est lié à aucune caisse : nous vous montrons vos options, sans produit imposé.",
      },
      {
        title: "Inscrit à la FINMA",
        text: "Intermédiaire d’assurance inscrit au registre de la FINMA sous le numéro F01536662.",
      },
      {
        title: "Vos données protégées",
        text: "Vos informations servent à votre recherche et ne sont transmises qu’aux organismes concernés.",
      },
    ],
    register: "Voir le registre FINMA",
  },
  faq: {
    eyebrow: "07 / QUESTIONS",
    title: "Vos questions,\nnos réponses.",
    items: [
      {
        question: "Qu’est-ce qu’un avoir de libre passage ?",
        answer:
          "C’est votre prestation de sortie du 2e pilier lorsque vous quittez une caisse de pension sans la transférer dans une nouvelle. Elle est alors conservée sur un compte ou une police de libre passage, ou versée à l’institution supplétive.",
      },
      {
        question: "Comment savoir si j’ai des avoirs oubliés ?",
        answer:
          "Si vous avez changé d’employeur, connu une période sans emploi, travaillé pour plusieurs employeurs ou quitté la Suisse, une recherche permet d’en avoir le cœur net.",
      },
      {
        question: "Qu’est-ce que la Centrale du 2e pilier ?",
        answer:
          "C’est l’organe officiel de liaison du 2e pilier, rattaché au Fonds de garantie LPP. Elle ne gère pas d’argent : elle recherche auprès des institutions de prévoyance et de libre passage si des avoirs existent à votre nom et communique les résultats par la poste.",
      },
      {
        question: "Combien coûte la recherche ?",
        answer:
          "Rien. La recherche est gratuite et sans engagement. Si des avoirs sont retrouvés, l’accompagnement pour les regrouper ou les placer est facultatif ; ses conditions vous sont présentées avant tout engagement.",
      },
      {
        question: "Pourquoi mon numéro AVS est-il demandé ?",
        answer:
          "Les institutions de prévoyance l’utilisent pour identifier leurs assurés. Avec vos noms, y compris d’anciens noms, et votre date de naissance, il permet une recherche fiable. Il n’est utilisé que pour votre recherche.",
      },
      {
        question: "Combien de temps dure la recherche ?",
        answer:
          "Cela dépend des réponses des institutions. Chaque étape s’affiche dans votre Wallet dès que notre équipe l’enregistre.",
      },
      {
        question: "Dois-je faire quelque chose pendant la recherche ?",
        answer:
          "Non. Nous vous contactons si une information manque. Attention : la Centrale du 2e pilier n’appelle que depuis son numéro officiel, le +41 31 380 79 75.",
      },
    ],
  },
  closing: {
    eyebrow: "COMMENCER",
    title: "Retrouvons ensemble\nvos avoirs du 2e pilier.",
    description:
      "Quelques minutes suffisent pour lancer la recherche. Vous suivez la suite dans votre Wallet.",
    cta: "Démarrer la recherche",
    note: "Gratuit · sans engagement · suivi dans Wallet",
  },
};

// The order: the comparator's checkout (same dialog, steps, access and buttons), for one person.
export const pensionCheckout = {
  title: "Votre recherche d’avoirs LPP",
  subtitle: "Gratuite et sans engagement. Votre demande est suivie dans votre Wallet.",
  steps: ["Votre accès", "Votre identité", "Votre parcours", "Confirmation"],
  accessTitle: "Connectez-vous à votre Wallet",
  accessHint:
    "Votre recherche est enregistrée dans votre Wallet : vous y suivez chaque étape. Pas encore de compte ? Il est créé avec votre adresse email.",
  walletConnected: "Continuer avec mon Wallet",
  email: "Adresse email",
  emailHint:
    "Recevez un code par email pour vous connecter. Si vous n’avez pas encore de compte, il sera créé avec cette adresse.",
  sendCode: "Recevoir mon code",
  code: "Code à 6 chiffres",
  codeSent: "Un code de connexion a été envoyé à cette adresse.",
  codeUnavailable:
    "L’envoi du code est momentanément indisponible. Réessayez dans quelques minutes.",
  resend: "Renvoyer un code",
  verify: "Valider et continuer",
  verified: "Adresse email vérifiée",
  continue: "Continuer",
  back: "Retour",
  otherEmail: "Utiliser une autre adresse",
  identityHint: "Les informations qui permettent aux institutions de vous identifier.",
  firstName: "Prénom",
  lastName: "Nom",
  previousNames: "Ancien(s) nom(s)",
  previousNamesHint: "Par exemple votre nom avant un mariage. Facultatif.",
  birthDate: "Date de naissance",
  sex: "Sexe",
  female: "Féminin",
  male: "Masculin",
  choose: "À préciser",
  nationality: "Nationalité",
  avsNumber: "Numéro AVS",
  avsHint:
    "13 chiffres commençant par 756, sur votre carte d’assurance maladie ou votre certificat AVS.",
  avsInvalid: "Ce numéro AVS n’est pas valable. Vérifiez les 13 chiffres.",
  street: "Rue et numéro",
  postalCode: "NPA",
  city: "Localité",
  country: "Pays de résidence",
  phone: "Téléphone",
  phoneHint: "Facultatif, si nous devons vous joindre.",
  pathHint: "Ces repères aident à cibler la recherche. Ils sont facultatifs.",
  situation: "Votre situation",
  situations: {
    job_change: "Changement d’employeur",
    unemployment: "Chômage",
    break: "Pause ou congé",
    leaving_switzerland: "Départ de Suisse",
    retirement: "Préparer ma retraite",
    self_employed: "Devenir indépendant",
    home: "Achat d’un logement",
    divorce: "Divorce",
    other: "Simple vérification",
  },
  employers: "Anciens employeurs",
  employersHint: "Ajoutez ceux dont vous vous souvenez, jusqu’à 10.",
  employerName: "Employeur",
  employerCity: "Lieu",
  fromYear: "De",
  toYear: "À",
  addEmployer: "Ajouter un employeur",
  removeEmployer: "Retirer",
  noEmployer: "Aucun employeur ajouté. Vous pouvez continuer sans.",
  summary: "Récapitulatif",
  summaryIdentity: "Identité",
  summaryAddress: "Adresse",
  summaryPath: "Parcours",
  edit: "Modifier",
  employerCount: { one: "1 ancien employeur", other: "{{count}} anciens employeurs" },
  mandate:
    "J’autorise CoverView Sàrl à transmettre en mon nom cette demande de recherche à la Centrale du 2e pilier et aux institutions de prévoyance concernées, et à recevoir leurs réponses.",
  mandateRequired: "Cochez l’autorisation pour lancer la recherche.",
  free: "Recherche gratuite et sans engagement. Aucun paiement n’est demandé.",
  legal:
    "CoverView Sàrl est un courtier indépendant non lié, inscrit au registre de la FINMA sous le numéro",
  privacy: "Protection des données",
  submit: "Lancer ma recherche",
  sending: "Envoi en cours…",
  working: "Un instant…",
  required: "Complétez les champs obligatoires avant de poursuivre.",
  invalidBirthDate: "Vérifiez la date de naissance.",
  invalidPeriod: "L’année de début doit précéder l’année de fin.",
  error: "L’opération n’a pas abouti. Vérifiez vos informations et réessayez.",
  invalidCode:
    "Le code est incorrect, expiré ou déjà utilisé. Vous pouvez demander un nouveau code.",
  rateLimited:
    "Un code vient d’être envoyé à cette adresse. Patientez une minute avant d’en demander un autre.",
  sessionLost: "Votre session a expiré. Reconnectez-vous pour envoyer votre demande.",
  unavailable: "La recherche en ligne est momentanément indisponible.",
  refresh: "Réessayer",
  close: "Fermer",
  success: "Votre recherche est lancée",
  successHint: "Nous vous ouvrons son suivi dans votre Wallet.",
};
