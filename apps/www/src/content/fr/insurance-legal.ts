import texts from "../../../../../packages/contracts/src/authorization-texts.json";
export const insuranceLegal = {
  title: "Informations légales · Demande d’offre",
  description:
    "Informations sur l’intermédiaire, les données personnelles et les conditions de la demande d’offre CoverView.",
  version: "insurance-request-2026-10-03",
  updated: "Dernière mise à jour : 3 octobre 2026",
  information: texts.information.map((section) =>
    section.title === "Identité et inscription au registre"
      ? {
          ...section,
          text: "CoverView Sàrl est un intermédiaire d’assurance non lié inscrit au registre FINMA sous le numéro F01536662. Adresse de contact : Avenue Louis-Casaï 71, 1216 Cointrin.",
        }
      : section,
  ),
  privacy: [
    {
      title: "Responsable et finalités",
      text: "CoverView Sàrl est responsable du traitement des données. Les coordonnées, la localité et les caractéristiques d’assurance saisies servent à préparer votre demande d’offre, vous contacter et suivre son traitement. Les réponses médicales libres du guide de comparaison ne sont pas ajoutées à cette demande.",
    },
    {
      title: "Compte et destinataires",
      text: "Si vous choisissez le parcours Wallet, WorkOS assure la connexion ou la création et la vérification du compte par email. Le parcours invité ne crée pas de compte. Les données de la demande sont accessibles à l’équipe habilitée et peuvent être transmises à l’assureur concerné pour préparer l’offre. Les profils familiaux du Wallet sont privés au compte qui les crée ; ils ne créent pas de comptes de connexion pour les proches.",
    },
    {
      title: "Conservation et droits",
      text: "Les brouillons non envoyés sont supprimés après 24 heures. L’accès invité dans ce navigateur dure au maximum 30 jours. Les demandes envoyées et leur historique sont conservés pour leur traitement et les obligations applicables décrites dans la notice ci-dessous. Pour exercer vos droits d’accès, de rectification ou d’effacement, adressez votre demande à CoverView Sàrl, Avenue Louis-Casaï 71, 1216 Cointrin.",
    },
    {
      title: "Cookies nécessaires",
      text: "Un cookie privé sécurise le panier et le suivi de votre demande. Le compte utilise une session de connexion distincte. Ces cookies servent au fonctionnement demandé et ne réalisent pas de suivi publicitaire.",
    },
  ],
  terms: [
    {
      title: "Objet de la demande",
      text: "Le parcours permet de solliciter une offre d’assurance maladie auprès de CoverView. L’envoi du panier ne conclut aucun contrat d’assurance, ne résilie aucun contrat existant et n’autorise aucun paiement.",
    },
    {
      title: "Informations fournies",
      text: "Vous renseignez des informations exactes et disposez de l’autorisation nécessaire pour présenter une demande pour les personnes ajoutées au panier. Vous pouvez corriger les informations avant l’envoi et signaler ensuite une correction à CoverView.",
    },
    {
      title: "Primes et prestations",
      text: "Les primes affichées proviennent du catalogue Priminfo indiqué dans le comparateur et sont revalidées avant l’envoi. La disponibilité, les prestations particulières et les conditions finales doivent être confirmées dans l’offre de l’assureur. Une donnée non confirmée ne constitue pas un avantage acquis.",
    },
    {
      title: "Traitement et rémunération",
      text: "CoverView analyse la demande puis accompagne les échanges nécessaires à l’établissement d’une offre. Aucune date de délivrance d’une offre n’est garantie par ce parcours. La rémunération de l’intermédiaire est décrite dans la notice d’information selon l’art. 45 LSA ; aucun paiement n’est demandé dans ce panier.",
    },
    {
      title: "Suite de la démarche",
      text: "L’acceptation éventuelle d’une offre, les déclarations nécessaires et la conclusion du contrat d’assurance font l’objet d’étapes distinctes. Le suivi informe de l’avancement enregistré par l’équipe ; il ne vaut pas confirmation de couverture par l’assureur.",
    },
  ],
};
