export const recommendationCopy = {
  intro:
    "Le moins cher n’est pas toujours le plus adapté. Affinez votre profil pour comparer aussi vos dépenses de soins, vos habitudes et les avantages que vous utiliserez réellement.",
  start: "Affiner ma recommandation",
  question: "Question",
  close: "Masquer",
  resume: "Reprendre",
  stop: "Voir les résultats maintenant",
  continue: "Continuer",
  skip: "Ignorer",
  back: "Retour",
  edit: "Mes réponses et autres sujets",
  save: "Confirmer",
  loading: "Recalcul de votre comparaison…",
  retry: "Réessayer",
  failed:
    "Le calcul personnalisé est momentanément indisponible. Le classement par prime reste accessible sur la carte.",
  disabled:
    "La recommandation personnalisée est désactivée. Vous pouvez toujours comparer les primes sur la carte.",
  privacy:
    "Avec votre accord, vos réponses sont traitées uniquement pour cette simulation et restent en mémoire pendant la session. Aucun diagnostic demandé, aucune transmission publicitaire. Fermer cette page ou effacer le profil supprime les réponses. Les notes personnelles ne quittent jamais votre navigateur et ne sont pas analysées.",
  consent: "Commencer la simulation avec mes réponses",
  clear: "Effacer mon profil de simulation",
  scope: "Périmètre de comparaison",
  same: "À franchise identique",
  optimize: "Optimiser aussi la franchise",
  note: "Note personnelle, non analysée",
  notePlaceholder: "Votre note privée…",
  amount: "Montant en CHF",
  upper: "Estimation haute facultative, en CHF",
  multiple: "Plusieurs réponses possibles · confirmez avec Continuer.",
  tariff:
    "Renseignez votre date de naissance et votre localité dans les paramètres au-dessus. Le calcul se mettra à jour automatiquement.",
  result: "Votre comparaison personnalisée",
  premium: "Prime mensuelle la plus basse",
  premiumAmount: "Prime mensuelle",
  annual: "Coût annuel simulé le plus bas",
  preferred: "Selon vos préférences",
  monthly: "CHF / mois",
  annualUnit: "CHF / an",
  deductible: "Franchise",
  year: "Année",
  accident: "Accident",
  included: "Inclus",
  excluded: "Exclu",
  price: "Primes annuelles",
  share: "Participation aux soins",
  total: "Assurance + soins",
  peripheral: "Avantages périphériques, séparés du coût",
  ordinary: "Franchise + quote-part ordinaires",
  explain: "Pourquoi cette offre",
  conditions: "Conditions et points à vérifier",
  details: "Modèle, conditions et demande d’offre",
  all: "Toutes les offres examinées",
  offers: "offres examinées",
  scenarios: "scénarios de sensibilité",
  uncertain: "Non calculable avec les informations disponibles",
  tied: "Ex æquo",
  changed:
    "La sélection a changé à la suite de votre dernière réponse ou modification des paramètres.",
  ignored: "Ignorée",
  unknown: "Inconnue",
  declined: "Refus de réponse",
  inactive: "Conservée, inactive pour cet objectif",
  notAsked: "Pas encore renseignée",
  sourceCases: "Dossiers de vérification documentaire",
  affordability: "Réserve financière",
  available: "Offre tarifaire disponible",
  compatibility: {
    compatible: "Compatible avec vos exigences renseignées",
    incompatible: "Incompatible avec une exigence impérative",
    verify: "Compatibilité à vérifier",
  },
  outcomes: {
    continue: "Affinage en cours",
    established: "Recommandation établie selon les informations renseignées",
    tradeoff: "Plusieurs candidats à départager",
    provisional: "Résultat provisoire : informations ou vérifications manquantes",
    disabled: "Classement par prix disponible",
  },
  reasons: {
    tariff: "Cette information détermine les tarifs et leur disponibilité.",
    constraint: "Cette question vérifie une contrainte déterminante.",
    ranking_sensitivity: "Cette question peut départager les modèles les mieux placés.",
    dependent_benefit:
      "Les réponses à cette branche peuvent changer l’utilité d’un avantage documenté.",
    cost_sensitivity: "Cette information peut modifier le coût simulé ou l’évaluation du budget.",
    requested: "Vous avez choisi d’explorer ce sujet.",
  },
  reserve: {
    sufficient:
      "La réserve déclarée couvre la participation ordinaire simulée, mais pas nécessairement tous les frais possibles.",
    insufficient:
      "La réserve déclarée est inférieure à la franchise et à la quote-part ordinaires maximales. Cette alerte ne retire pas l’offre du classement.",
    uncertain:
      "Votre fourchette de réserve ne permet pas de conclure. Vous pouvez saisir un montant précis.",
    unknown:
      "Réserve non précisée : cette franchise n’est pas présentée comme adaptée à votre budget.",
  },
  utility: {
    freedom: "Liberté du parcours",
    practical: "Parcours préféré accessible",
    simplicity: "Plusieurs portes d’entrée souhaitées",
    services: "Services confirmés que vous prévoyez d’utiliser",
  },
  rules: {
    care_estimate_incomplete:
      "Des soins réguliers ou prévus ne sont pas encore intégrés à l’estimation. Le coût annuel reste à recalculer avec votre nouveau total.",
    individual_costs_only:
      "Ce résultat concerne la personne renseignée. Comparez séparément chaque membre du foyer ; aucun rabais familial ou avantage unique n’est multiplié automatiquement.",
    required_benefit_unverified:
      "L’un des avantages exigés dans vos filtres reste à confirmer pour cette offre et votre situation.",
    ordinary_costs_only:
      "Simulation des soins ordinaires : la contribution hospitalière, la quote-part majorée de certains médicaments et les exemptions particulières demandent un calcul distinct. Ce montant n’est pas un plafond universel.",
    before_unverified_subsidy:
      "Résultats avant subside. Aucun droit ou montant cantonal non vérifié n’est déduit.",
    no_commercial_ranking:
      "Les commissions, partenariats et accords commerciaux n’influencent pas ce classement.",
    care_range_changes_leader:
      "Selon le scénario de dépenses, l’offre la moins coûteuse peut changer.",
    legacy_answers_require_confirmation:
      "Des réponses de l’ancien questionnaire ont été conservées dans leur version d’origine ; elles doivent être reconfirmées avant utilisation.",
    no_compatible_candidates: "Aucune offre ne satisfait actuellement les contraintes évaluées.",
    enough_information: "Les informations renseignées permettent déjà une recommandation.",
    cost_utility_tradeoff:
      "Une offre coûte moins cher, une autre répond mieux à vos préférences : un arbitrage reste nécessaire.",
    municipality_required: "La disponibilité doit être confirmée pour votre commune.",
    tariff_incomplete:
      "Date de naissance ou localité manquante : le tarif affiché repose encore sur les paramètres provisoires.",
    acceptable_path_unknown: "Les parcours acceptables restent à préciser.",
    mandatory_path_refused: "Ce modèle impose un parcours que vous avez refusé.",
    free_access: "Ce modèle permet le libre choix sans premier contact imposé.",
    obligations_unresolved: "L’acceptation des obligations du modèle reste à préciser.",
    model_conditions_unverified: "Les conditions de parcours de cette année restent à vérifier.",
    entry_points_unknown: "Les premiers interlocuteurs autorisés restent à vérifier.",
    entry_points_incompatible:
      "Les premiers interlocuteurs ne correspondent pas aux parcours acceptés.",
    acceptable_entry_point: "Le modèle propose un premier interlocuteur que vous acceptez.",
    multiple_entry_unknown:
      "La possibilité de choisir entre plusieurs premiers contacts reste à vérifier.",
    multiple_entry_required:
      "Le modèle ne satisfait pas votre exigence de plusieurs premiers contacts au choix.",
    professionals_unknown: "Les professionnels à conserver restent à préciser.",
    professional_importance_unknown:
      "Le caractère indispensable de la conservation de vos professionnels reste à préciser.",
    professional_gp_incompatible:
      "Votre médecin indispensable n’est pas admis selon la preuve de réseau disponible.",
    professional_specialist_incompatible:
      "Votre spécialiste indispensable n’est pas compatible selon les conditions vérifiées.",
    professional_gp_verify: "La compatibilité avec votre médecin reste à vérifier.",
    professional_specialist_verify:
      "L’accès à votre spécialiste selon le parcours reste à vérifier.",
    accident_exclusion_unverified:
      "L’exclusion de l’accident demande confirmation de votre couverture par l’employeur.",
    ordinary_reserve_shortfall:
      "Cette franchise peut nécessiter une réserve supérieure à celle déclarée.",
    maternity_specific_costs:
      "La maternité nécessite une simulation séparant les soins exemptés et les autres soins.",
    medical_benefits_interaction_unresolved:
      "Les dépenses éligibles et leurs interactions ne permettent pas encore un calcul certain.",
    documentary_verification: "Une condition déterminante fait l’objet d’un contrôle documentaire.",
  } as Record<string, string>,
  evidence: {
    title: "Conditions et preuves",
    partial:
      "Les éléments non confirmés pour l’année sélectionnée restent conditionnels, sans économie certaine.",
    empty:
      "Aucune prestation identifiée dans les sources consultées pour ce périmètre ne signifie pas qu’aucune prestation n’existe.",
    conditions: "Éligibilité et activation",
    exclusions: "Exclusions",
    source: "Source",
    confirmed: "Année et conditions vérifiées",
    pending: "À contrôler pour cette année",
    nature: {
      legal_common: "Socle légal commun",
      model_condition: "Condition du modèle",
      base_service: "Service associé à la base",
      commercial: "Avantage commercial",
      supplementary: "Conditionné à une complémentaire",
      public_service: "Accessible sans cette offre",
      unknown: "Nature à vérifier",
    },
    telemedicine: {
      not_applicable: "",
      platform_only: "Accès à la plateforme seulement",
      triage_only: "Conseil ou triage gratuit uniquement",
      free_consultation: "Consultation sans participation aux coûts selon conditions",
      billed_consultation: "Consultation facturée selon les règles applicables",
      deductible_only: "Franchise exonérée ; quote-part possible",
      unknown: "Participation aux coûts de la consultation à confirmer",
    },
  },
};
