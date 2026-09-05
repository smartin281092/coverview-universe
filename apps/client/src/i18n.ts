import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import common from "./locales/fr/common.json";

void i18next.use(initReactI18next).init({
  resources: { fr: { common } },
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  initAsync: false,
});
