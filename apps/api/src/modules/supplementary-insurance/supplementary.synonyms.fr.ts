// French words of a need → taxonomy tags (19 November 2026), for the assistant without OpenAI.
// Written by hand, read without accents, case or plural (see supplementary.interpret.ts). The
// longest phrase wins; a "fallback" entry only applies when no other tag of the same family was
// found ("hôpital" alone = common ward anywhere in Switzerland, but not with "hôpital privé").

export type Synonym = { phrases: string[]; tags: string[]; fallback?: boolean };

export const supplementarySynonyms: Synonym[] = [
  // Phrases read as nothing, so that their words are not taken for a need ("naissance").
  {
    phrases: ["annee de naissance", "date de naissance", "ne en", "nee en", "ne le", "nee le"],
    tags: [],
  },
  // Dental
  {
    phrases: [
      "dentaire",
      "dent",
      "dentiste",
      "soins dentaires",
      "carie",
      "couronne",
      "prothese dentaire",
      "implant dentaire",
      "plombage",
    ],
    tags: ["dental_treatment"],
  },
  {
    phrases: [
      "hygiene dentaire",
      "hygieniste",
      "detartrage",
      "controle dentaire",
      "nettoyage des dents",
    ],
    tags: ["dental_hygiene"],
  },
  {
    phrases: [
      "orthodontie",
      "orthodontiste",
      "appareil dentaire",
      "appareil pour les dents",
      "bague dentaire",
      "bagues",
      "redressement des dents",
      "invisalign",
      "gouttiere",
    ],
    tags: ["orthodontics"],
  },
  {
    phrases: ["dent de sagesse", "chirurgie dentaire", "extraction dentaire"],
    tags: ["dental_surgery"],
  },
  { phrases: ["accident dentaire"], tags: ["dental_accident"] },
  // Vision
  {
    phrases: [
      "lunette",
      "lentille",
      "lentilles de contact",
      "verre",
      "verres de contact",
      "verres correcteurs",
      "opticien",
      "myopie",
      "vue",
    ],
    tags: ["glasses_lenses"],
  },
  {
    phrases: [
      "laser",
      "operation des yeux",
      "operation de la myopie",
      "correction de la vue",
      "chirurgie refractive",
      "lasik",
    ],
    tags: ["vision_laser"],
  },
  // Complementary medicine
  {
    phrases: [
      "medecine douce",
      "medecines douces",
      "medecine alternative",
      "medecine complementaire",
      "medecine naturelle",
      "therapie alternative",
      "osteopathe",
      "osteopathie",
      "osteo",
      "acupuncture",
      "acupuncteur",
      "naturopathie",
      "naturopathe",
      "massage",
      "massage medical",
      "shiatsu",
      "reflexologie",
      "kinesiologie",
      "physio hors lamal",
      "physiotherapie hors lamal",
      "drainage lymphatique",
      "sophrologie",
      "hypnose",
      "medecine chinoise",
      "mtc",
    ],
    tags: ["alt_medicine_therapies"],
  },
  {
    phrases: [
      "homeopathie",
      "phytotherapie",
      "remede naturel",
      "remedes naturels",
      "plantes medicinales",
      "granules",
    ],
    tags: ["alt_medicine_remedies"],
  },
  // Prevention
  {
    phrases: [
      "fitness",
      "salle de sport",
      "salle de fitness",
      "abonnement de sport",
      "abonnement fitness",
      "sport",
      "gym",
      "yoga",
      "pilates",
      "cours de sante",
      "promotion de la sante",
      "piscine",
      "natation",
    ],
    tags: ["fitness_health_promotion"],
  },
  {
    phrases: [
      "prevention",
      "check up",
      "checkup",
      "bilan de sante",
      "examen preventif",
      "examens preventifs",
      "depistage",
      "medecine preventive",
    ],
    tags: ["prevention_checkup"],
  },
  { phrases: ["vaccin", "vaccination", "vaccins de voyage"], tags: ["vaccination"] },
  {
    phrases: [
      "gynecologue",
      "examen gynecologique",
      "controle gynecologique",
      "frottis",
      "mammographie",
    ],
    tags: ["gynecological_prevention"],
  },
  {
    phrases: ["arreter de fumer", "sevrage tabagique", "tabac", "cigarette"],
    tags: ["smoking_cessation"],
  },
  // Hospital
  {
    phrases: ["hopital", "hospitalisation", "clinique", "sejour hospitalier"],
    tags: ["hospital_general_ch"],
    fallback: true,
  },
  {
    phrases: [
      "libre choix de l hopital",
      "toute la suisse",
      "hopital hors canton",
      "division commune",
      "chambre commune",
    ],
    tags: ["hospital_general_ch"],
  },
  {
    phrases: [
      "demi prive",
      "mi prive",
      "semi prive",
      "demi privee",
      "mi privee",
      "semi privee",
      "division demi privee",
      "chambre a deux lits",
      "chambre double",
      "deux lits",
    ],
    tags: ["hospital_semi_private"],
  },
  {
    phrases: [
      "prive",
      "privee",
      "hopital prive",
      "clinique privee",
      "division privee",
      "chambre privee",
      "chambre individuelle",
      "chambre seule",
      "un lit",
    ],
    tags: ["hospital_private"],
  },
  {
    phrases: [
      "hopital flex",
      "flex",
      "choix de la division",
      "division au choix",
      "choisir la division",
    ],
    tags: ["hospital_flex"],
  },
  {
    phrases: [
      "libre choix du medecin",
      "choix du medecin",
      "medecin de mon choix",
      "medecin de son choix",
      "choisir mon medecin",
      "choisir le medecin",
      "medecin chef",
    ],
    tags: ["hospital_free_doctor_choice"],
  },
  {
    phrases: [
      "indemnite journaliere d hospitalisation",
      "indemnite d hospitalisation",
      "indemnite hospitaliere",
      "argent a l hopital",
    ],
    tags: ["hospital_daily_cash"],
  },
  { phrases: ["capital hospitalisation", "capital d hospitalisation"], tags: ["hospital_capital"] },
  {
    phrases: ["rooming in", "accompagner mon enfant a l hopital", "lit accompagnant"],
    tags: ["rooming_in"],
  },
  {
    phrases: ["psychiatrie", "clinique psychiatrique", "readaptation", "rehabilitation"],
    tags: ["psychiatry_rehab_stay"],
  },
  // Abroad and travel
  {
    phrases: [
      "etranger",
      "a l etranger",
      "hors de suisse",
      "urgence a l etranger",
      "soins a l etranger",
    ],
    tags: ["abroad_emergency"],
  },
  {
    phrases: ["voyage", "vacances", "sejour linguistique", "expatriation"],
    tags: ["abroad_emergency", "travel_assistance_repatriation"],
  },
  {
    phrases: ["rapatriement", "assistance voyage", "assistance a l etranger"],
    tags: ["travel_assistance_repatriation"],
  },
  {
    phrases: ["annulation", "annulation de voyage", "bagage", "frais d annulation"],
    tags: ["travel_cancellation_luggage"],
  },
  {
    phrases: ["traitement a l etranger", "se faire soigner a l etranger"],
    tags: ["abroad_planned_treatment"],
  },
  {
    phrases: [
      "hopital a l etranger",
      "hospitalisation a l etranger",
      "couverture mondiale",
      "monde entier",
    ],
    tags: ["hospital_abroad"],
  },
  // Maternity and family
  {
    phrases: [
      "maternite",
      "grossesse",
      "enceinte",
      "accouchement",
      "sage femme",
      "maison de naissance",
      "preparation a l accouchement",
      "naissance",
    ],
    tags: ["maternity"],
  },
  { phrases: ["allaitement", "conseillere en allaitement"], tags: ["breastfeeding"] },
  {
    phrases: ["bebe", "nouveau ne", "nourrisson", "assurance prenatale"],
    tags: ["newborn_coverage"],
  },
  {
    phrases: ["garde d enfant", "garde des enfants", "baby sitting"],
    tags: ["childcare_assistance"],
  },
  {
    phrases: [
      "fertilite",
      "fiv",
      "procreation",
      "procreation medicalement assistee",
      "desir d enfant",
      "insemination",
    ],
    tags: ["fertility"],
  },
  // Ambulatory
  {
    phrases: ["psychotherapie", "psychotherapeute", "psychologue", "psy", "therapie"],
    tags: ["psychotherapy_non_medical"],
  },
  {
    phrases: [
      "medicament hors liste",
      "medicaments hors liste",
      "medicament non rembourse",
      "medicaments non rembourses",
      "medicament",
      "pharmacie",
      "hors liste",
    ],
    tags: ["medication_non_listed"],
  },
  {
    phrases: [
      "appareil auditif",
      "appareils auditifs",
      "semelle orthopedique",
      "semelles orthopediques",
      "moyen auxiliaire",
      "moyens auxiliaires",
      "orthopedie",
      "bequille",
    ],
    tags: ["medical_aids"],
  },
  { phrases: ["podologue", "podologie", "pedicure", "pedicure medicale"], tags: ["podiatry"] },
  {
    phrases: [
      "dieteticien",
      "dieteticienne",
      "nutritionniste",
      "conseil nutritionnel",
      "conseils nutritionnels",
      "nutrition",
    ],
    tags: ["nutrition_counselling"],
  },
  {
    phrases: ["logopedie", "logopediste", "ergotherapie", "psychomotricite", "orthophonie"],
    tags: ["speech_psychomotor_therapy"],
  },
  {
    phrases: ["chirurgie esthetique", "esthetique", "oreilles decollees", "varice"],
    tags: ["cosmetic_corrections"],
  },
  {
    phrases: ["contraception", "sterilisation", "vasectomie", "pilule", "sterilet"],
    tags: ["sterilization_contraception"],
  },
  {
    phrases: ["franchise", "quote part", "participation aux couts"],
    tags: ["cost_sharing_coverage"],
  },
  {
    phrases: ["medecin prive", "traitement prive", "medecin hors convention"],
    tags: ["ambulatory_free_doctor_choice"],
  },
  { phrases: ["operation ambulatoire", "chirurgie ambulatoire"], tags: ["ambulatory_surgery"] },
  {
    phrases: ["traitement innovant", "therapie innovante", "hors catalogue"],
    tags: ["innovative_treatments"],
  },
  // Transport
  {
    phrases: ["transport", "ambulance", "transport en ambulance", "transport medical"],
    tags: ["transport_rescue"],
  },
  {
    phrases: [
      "sauvetage",
      "helicoptere",
      "rega",
      "secours",
      "frais de recherche",
      "recherche et sauvetage",
    ],
    tags: ["transport_rescue", "search_recovery"],
  },
  {
    phrases: ["frais de deplacement", "deplacement pour traitement"],
    tags: ["travel_expenses_treatment"],
  },
  // Care and support
  { phrases: ["cure", "cure thermale", "cure balneaire", "thermes"], tags: ["spa_cure"] },
  {
    phrases: ["convalescence", "cure de convalescence", "cure de repos"],
    tags: ["convalescence_cure"],
  },
  {
    phrases: ["aide menagere", "aide au menage", "aide a domicile", "menage"],
    tags: ["home_help"],
  },
  { phrases: ["soins a domicile", "spitex", "infirmiere a domicile"], tags: ["home_care"] },
  {
    phrases: ["ems", "soins de longue duree", "dependance", "home medicalise"],
    tags: ["long_term_care"],
  },
  // Capitals and income
  {
    phrases: [
      "capital deces",
      "capital invalidite",
      "capital deces invalidite",
      "deces",
      "invalidite",
    ],
    tags: ["illness_capital", "accident_capital"],
  },
  {
    phrases: ["capital accident", "deces par accident", "invalidite par accident"],
    tags: ["accident_capital"],
  },
  { phrases: ["capital maladie", "invalidite par maladie"], tags: ["illness_capital"] },
  {
    phrases: [
      "perte de gain",
      "indemnite journaliere",
      "incapacite de travail",
      "arret de travail",
      "perte de salaire",
    ],
    tags: ["daily_allowance"],
  },
  { phrases: ["liberation des primes", "exoneration des primes"], tags: ["premium_waiver"] },
  // Services
  {
    phrases: ["protection juridique", "juridique", "avocat", "litige"],
    tags: ["legal_protection"],
  },
  { phrases: ["deuxieme avis", "second avis", "deuxieme avis medical"], tags: ["second_opinion"] },
  {
    phrases: ["telemedecine", "consultation en ligne", "medecin en ligne", "conseil medical"],
    tags: ["telemedicine_services"],
  },
  { phrases: ["bonus", "rabais de fidelite", "sans sinistre"], tags: ["bonus_program"] },
];

// Words that make the insured person a child.
export const childWords = [
  "enfant",
  "fils",
  "fille",
  "bebe",
  "ado",
  "adolescent",
  "adolescente",
  "garcon",
  "nourrisson",
  "nouveau ne",
  "petit fils",
  "petite fille",
];
export const femaleWords = ["femme", "fille", "enceinte", "grossesse", "madame", "petite fille"];
export const maleWords = ["homme", "fils", "garcon", "monsieur", "petit fils"];
export const cantonWords: Record<string, string[]> = {
  VD: ["vaud", "vaudois", "vaudoise", "lausanne"],
  GE: ["geneve", "genevois", "genevoise"],
  FR: ["fribourg", "fribourgeois", "fribourgeoise"],
  VS: ["valais", "valaisan", "valaisanne", "sion"],
  NE: ["neuchatel", "neuchatelois", "neuchateloise"],
  JU: ["jura", "jurassien", "jurassienne", "delemont"],
};
export const insurerWords: Record<string, string[]> = {
  assura: ["assura"],
  "groupe-mutuel": ["groupe mutuel", "mutuel"],
  css: ["css"],
  helsana: ["helsana"],
  sanitas: ["sanitas"],
  concordia: ["concordia"],
  swica: ["swica"],
  axa: ["axa"],
  atupri: ["atupri"],
  visana: ["visana"],
  sympany: ["sympany"],
  kpt: ["kpt", "cpt"],
};
