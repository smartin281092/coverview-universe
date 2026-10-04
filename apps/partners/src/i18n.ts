import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import partner from "./locales/fr/partner.json";
void i18next.use(initReactI18next).init({
  resources: { fr: { partner } },
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "partner",
  interpolation: { escapeValue: false },
  initAsync: false,
});
