import insuranceRequests from "./locales/fr/insurance-requests.json";
import partner from "./locales/fr/partner.json";
import profiles from "./locales/fr/profiles.json";
import healthRecommendation from "./locales/fr/health-recommendation.json";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import common from "./locales/fr/common.json";
import users from "./locales/fr/users.json";
import serviceRequests from "./locales/fr/service-requests.json";
import dossier from "./locales/fr/dossier.json";
import profileTransfer from "./locales/fr/profile-transfer.json";
import notifications from "./locales/fr/notifications.json";

void i18next.use(initReactI18next).init({
  resources: {
    fr: {
      partner,
      profiles,
      healthRecommendation,
      insuranceRequests,
      common,
      users,
      serviceRequests,
      dossier,
      profileTransfer,
      notifications,
    },
  },
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  initAsync: false,
});
