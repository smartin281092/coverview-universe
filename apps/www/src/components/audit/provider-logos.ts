// Logos locaux des prestataires (provenance dans `src/assets/companies/provenance.json`).
import axa from "../../assets/companies/axa.svg?url";
import pax from "../../assets/companies/pax.svg?url";
import finpension from "../../assets/companies/finpension.svg?url";
import helvetia from "../../assets/companies/helvetia.svg?url";
import ubs from "../../assets/companies/ubs.svg?url";
import swisslife from "../../assets/companies/swisslife.jpg?url";
import viac from "../../assets/companies/viac.svg?url";
import generali from "../../assets/companies/generali.svg?url";
import swissquote from "../../assets/companies/swissquote.svg?url";
import mobiliere from "../../assets/companies/mobiliere.svg?url";
import raiffeisen from "../../assets/companies/raiffeisen.png?url";
import groupeMutuel from "../../assets/companies/groupe-mutuel.svg?url";
import zurich from "../../assets/companies/zurich.png?url";
import liechtensteinLife from "../../assets/companies/liechtenstein-life.svg?url";
import allianz from "../../assets/companies/allianz.png?url";
import retraitesPopulaires from "../../assets/companies/retraites-populaires.svg?url";

/** Fond et contraintes de rendu propres à certains logos (comme la couronne de l’accueil). */
export type ProviderLogo = { src: string; background?: string; tall?: boolean };
export const providerLogos: Record<string, ProviderLogo> = {
  axa: { src: axa },
  pax: { src: pax, background: "#17372d" },
  finpension: { src: finpension },
  helvetia: { src: helvetia },
  ubs: { src: ubs },
  swisslife: { src: swisslife, tall: true },
  viac: { src: viac },
  generali: { src: generali, background: "#c4182a" },
  swissquote: { src: swissquote },
  mobiliere: { src: mobiliere, background: "#e30613" },
  raiffeisen: { src: raiffeisen },
  "groupe-mutuel": { src: groupeMutuel },
  zurich: { src: zurich, tall: true },
  "liechtenstein-life": { src: liechtensteinLife },
  allianz: { src: allianz },
  "retraites-populaires": { src: retraitesPopulaires, tall: true },
};
