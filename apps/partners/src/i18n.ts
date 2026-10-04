import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import partner from "./locales/fr/partner.json";
import economy from "./locales/fr/economy.json";
import quality from "./locales/fr/quality.json";
import communications from "./locales/fr/communications.json";
import pilotage from "./locales/fr/pilotage.json";
import conclusion from "./locales/fr/conclusion.json";
import navigation from "./locales/fr/navigation.json";
import lifecycle from "./locales/fr/lifecycle.json";
import relationships from "./locales/fr/relationships.json";
import matching from "./locales/fr/matching.json";
import profiles from "./locales/fr/profiles.json";
void i18next.use(initReactI18next).init({
  resources: {
    fr: {
      partner,
      economy,
      quality,
      communications,
      pilotage,
      conclusion,
      navigation,
      lifecycle,
      relationships,
      matching,
      profiles,
    },
  },
  lng: "fr",
  fallbackLng: "fr",
  defaultNS: "partner",
  interpolation: { escapeValue: false },
  initAsync: false,
});
