import insuranceRequests from "./locales/fr/insurance-requests.json";
import offers from "./locales/fr/offers.json";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import common from "./locales/fr/common.json";
import profile from "./locales/fr/profile.json";
import documents from "./locales/fr/documents.json";
import authorizations from "./locales/fr/authorizations.json";
import insurance from "./locales/fr/insurance.json";
import identityPreview from "./locales/fr/identity-preview.json";
import actions from "./locales/fr/actions.json";

void i18next.use(initReactI18next).init({
  resources: {
    fr: { offers, insuranceRequests, common, profile, documents, authorizations, insurance, identityPreview, actions },
  },
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  initAsync: false,
});
