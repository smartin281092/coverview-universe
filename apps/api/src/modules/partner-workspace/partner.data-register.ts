import {
  partnerDataRegisterVersion,
  walletDataAccess,
  type ProfessionalDataCategory,
  type WalletDataCategory,
} from "@coverview/contracts/partner-data";
import type { z } from "zod";
import type { dataRegisterSchema } from "@coverview/contracts/partner-data";

// Register v1 written into each export (C7a), in French: the only locale of the product so far, and
// a downloaded file cannot be translated by the client (INTL-06). It states facts of the product,
// not a legal assessment: no retention period has been decided, so none is stated.
const controller = "CoverView Sàrl, Avenue Louis-Casaï 71, 1216 Cointrin";
const retention =
  "Non définie : la durée de conservation reste à valider par CoverView. Aucune suppression automatique n'est active.";
const rights =
  "Vous pouvez consulter et exporter ces données depuis votre espace, et y demander une rectification, un accès complet, un effacement, ou poser une question. CoverView vous répond dans votre espace.";
const automated = [
  "Orientation automatique des offres : un repère factuel, toujours signalé comme non validé et distinct de la recommandation de votre conseiller.",
  "Proposition d'un conseiller par un classement expliqué, sans aucune donnée économique ; une personne décide et motive tout écart.",
  "Réattribution automatique bornée lorsqu'un conseiller ne donne pas suite dans le délai : le nouveau conseiller doit accepter, sinon CoverView reprend le dossier.",
];

const wallet: Record<WalletDataCategory, { purpose: string; recipients: string; origin: string }> =
  {
    requests: {
      purpose: "Traiter vos demandes de conseil et en suivre l'avancement.",
      recipients: "Le conseiller responsable, les intervenants associés à la demande, CoverView.",
      origin: "Vous, votre conseiller, ou l'apporteur qui a transmis la demande.",
    },
    contact: {
      purpose: "Vous joindre au sujet de vos demandes et connaître leur provenance.",
      recipients:
        "Le conseiller responsable et les intervenants autorisés à vous contacter, CoverView.",
      origin: "Vous, ou l'apporteur de la demande : la source est indiquée pour chaque demande.",
    },
    appointments: {
      purpose: "Organiser vos rendez-vous et réserver le temps convenu.",
      recipients: "Les conseillers concernés, CoverView.",
      origin: "Vous et vos conseillers.",
    },
    offers: {
      purpose:
        "Présenter et comparer des offres, consigner vos choix, vos questions et vos signatures.",
      recipients: "Les conseillers concernés, CoverView.",
      origin: "Vos conseillers, les documents des compagnies d'assurance et vous.",
    },
    preferences: {
      purpose:
        "Respecter vos préférences de langue, de mode de rendez-vous, de région et de conseiller référent.",
      recipients: "Les conseillers concernés, CoverView.",
      origin: "Vous.",
    },
    communications: {
      purpose:
        "Consigner les échanges et, uniquement avec votre accord, les enregistrements et leurs transcriptions.",
      recipients: "Les conseillers concernés, CoverView.",
      origin: "Vos conseillers et vous.",
    },
    quality: {
      purpose:
        "Mesurer la qualité du service, traiter vos réclamations et vérifier le suivi de vos demandes à partir de ce que vous en déclarez.",
      recipients:
        "Les conseillers concernés et CoverView ; vos notes d'enquête entrent dans leur évaluation. Vos déclarations sur le déroulement d'une demande ne sont lues que par CoverView et, lors d'une vérification, par le professionnel concerné.",
      origin: "Vous, et CoverView lorsqu'il consigne un échange avec vous.",
    },
    notifications: {
      purpose: "Vous informer des actions qui vous concernent.",
      recipients: "Vous.",
      origin: "CoverView.",
    },
    internal: {
      purpose:
        "Organiser le travail des intervenants : notes internes, tâches et journal de la demande.",
      recipients: "Les intervenants de la demande, CoverView.",
      origin: "Vos conseillers et CoverView.",
    },
  };

const professional: Record<
  ProfessionalDataCategory,
  { purpose: string; recipients: string; origin: string }
> = {
  membership: {
    purpose:
      "Examiner votre candidature, gérer votre habilitation, ses restrictions et ses réexamens, et tracer chaque décision.",
    recipients:
      "CoverView ; le responsable de votre organisation : état, habilitations, réexamen, types de restriction et charge, sans motif.",
    origin: "Vous et les décisions de CoverView.",
  },
  declarations: {
    purpose:
      "Vérifier vos compétences, conventions, disponibilités, capacité et pratique avant toute attribution.",
    recipients: "CoverView ; un résumé autorisé aux clients concernés.",
    origin: "Vous et vos justificatifs.",
  },
  profile: {
    purpose: "Publier votre profil et sa photo facultative après examen.",
    recipients: "Les clients que vous servez, les membres Partner, CoverView.",
    origin: "Vous.",
  },
  evaluations: {
    purpose: "Mesurer l'expérience client, la qualité opérationnelle et la fiabilité économique.",
    recipients: "Vous et CoverView ; la note publique à partir de 5 avis.",
    origin: "Enquêtes des clients, suivi des demandes, réclamations et dossiers économiques.",
  },
  internal_scores: {
    purpose:
      "Proposer un conseiller par un classement expliqué, et évaluer les demandes transmises par les apporteurs.",
    recipients: "CoverView et vous.",
    origin:
      "Vos déclarations validées, votre charge observée et les demandes que vous avez transmises.",
  },
  goals: {
    purpose: "Suivre les objectifs qui vous sont fixés.",
    recipients: "Vous, votre responsable, CoverView.",
    origin: "CoverView et votre responsable.",
  },
  remunerations: {
    purpose: "Établir et suivre vos droits économiques.",
    recipients:
      "Vous, CoverView ; le responsable de votre organisation lit vos conditions commerciales, jamais vos rémunérations.",
    origin: "Dossiers et accords économiques.",
  },
};

export function walletRegister(): z.infer<typeof dataRegisterSchema> {
  return {
    version: partnerDataRegisterVersion,
    controller,
    entries: (Object.keys(wallet) as WalletDataCategory[]).map((category) => ({
      category,
      access: walletDataAccess[category],
      ...wallet[category],
      retention,
    })),
    automated,
    rights,
  };
}
export function professionalRegister(): z.infer<typeof dataRegisterSchema> {
  return {
    version: partnerDataRegisterVersion,
    controller,
    entries: (Object.keys(professional) as ProfessionalDataCategory[]).map((category) => ({
      category,
      access: "self_service" as const,
      ...professional[category],
      retention,
    })),
    automated: automated.slice(1),
    rights,
  };
}
