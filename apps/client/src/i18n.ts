import insuranceRequests from "./locales/fr/insurance-requests.json";
import offers from "./locales/fr/offers.json";
import activation from "./locales/fr/activation.json";
import conclusion from "./locales/fr/conclusion.json";
import quality from "./locales/fr/quality.json";
import communications from "./locales/fr/communications.json";
import leadNotifications from "./locales/fr/lead-notifications.json";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import common from "./locales/fr/common.json";
import profile from "./locales/fr/profile.json";
import documents from "./locales/fr/documents.json";
import authorizations from "./locales/fr/authorizations.json";
import insurance from "./locales/fr/insurance.json";
import identityPreview from "./locales/fr/identity-preview.json";
import actions from "./locales/fr/actions.json";
import lifecycle from "./locales/fr/lifecycle.json";
import relationships from "./locales/fr/relationships.json";
import data from "./locales/fr/data.json";
import complements from "./locales/fr/complements.json";
import consent from "./locales/fr/consent.json";

void i18next.use(initReactI18next).init({
  resources: {
    fr: {
      leadNotifications,
      consent,
      offers,
      activation,
      conclusion,
      lifecycle,
      relationships,
      quality,
      communications,
      insuranceRequests,
      common,
      profile,
      documents,
      authorizations,
      insurance,
      identityPreview,
      actions,
      data,
      complements,
    },
  },
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  initAsync: false,
});
