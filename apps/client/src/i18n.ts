import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import common from "./locales/fr/common.json";
import profile from "./locales/fr/profile.json";

void i18next.use(initReactI18next).init({
  resources: { fr: { common, profile } },
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  initAsync: false,
});
