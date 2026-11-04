/**
 * Textes du dialogue de commande Hyperion, chargés avec lui à la première ouverture (MKT-06).
 */
export const hyperionOrder = {
  eyebrow: "3E PILIER 3A · STRATÉGIE COVERVIEW · ASSUREUR LIECHTENSTEIN LIFE",
  title: "Commander Hyperion.",
  intro:
    "Laissez vos coordonnées : un conseiller CoverView vous rappelle sous 24 h ouvrées pour finaliser votre 3e pilier avec Liechtenstein Life. Aucun prélèvement, aucun engagement avant la signature de l’offre.",
  summary: {
    title: "Votre configuration",
    investment: "Versement",
    frequency: "Rythme",
    birthYear: "Année de naissance",
    initialCapital: "Capital de départ",
    none: "aucun",
    edit: "Modifier dans la page",
  },
  firstName: "Prénom",
  lastName: "Nom",
  email: "Email",
  phone: "Téléphone",
  phoneHint: "Pour convenir du rappel",
  privacy:
    "Vos coordonnées servent uniquement au traitement de cette commande par CoverView Sàrl, courtier indépendant non lié. Elles ne sont transmises à aucun autre intermédiaire.",
  legal: "Informations sur l’intermédiaire (art. 45 LSA)",
  submit: "Envoyer ma commande",
  submitting: "Envoi…",
  required: "Merci de compléter ce champ.",
  invalidEmail: "Adresse email invalide.",
  invalidPhone: "Numéro de téléphone invalide.",
  success: {
    title: "Commande reçue.",
    text: "Merci {{firstName}}. Un conseiller CoverView vous contacte sous 24 h ouvrées au {{phone}} pour finaliser votre Hyperion.",
    reference: "Référence : {{reference}}",
    close: "Fermer",
  },
  errors: {
    network:
      "La commande n’a pas pu être envoyée. Vérifiez votre connexion et réessayez : votre saisie est conservée.",
    rateLimited: "Trop de tentatives depuis cet appareil. Réessayez dans une minute.",
    invalid:
      "Certaines informations n’ont pas été acceptées. Vérifiez vos coordonnées et réessayez.",
    unavailable:
      "Le service de commande est momentanément indisponible. Réessayez dans quelques instants.",
  },
  retry: "Réessayer",
  close: "Fermer",
} as const;
