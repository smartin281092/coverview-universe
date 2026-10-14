import { z } from "zod";

// Template horizon3-request-v1 (MAIL-03): the internal notice of an order received from
// horizon3.finance. Minimal personal data (MAIL-06): never the client's name, email or phone,
// which are read in Partner by the account that follows the order.
export const horizon3RequestTemplate = "horizon3-request-v1";
const variablesSchema = z
  .object({
    locale: z.enum(["fr"]),
    product: z.string().trim().min(1).max(120),
    company: z.string().trim().min(1).max(120),
    strategy: z.string().trim().min(1).max(60),
    investment: z.string().trim().min(1).max(120),
    capital: z.string().trim().min(1).max(60),
    reference: z.guid(),
    receivedAt: z.date(),
    link: z.url({ protocol: /^https?$/u }).nullable(),
  })
  .strict();
const copy = {
  fr: {
    dateLocale: "fr-CH",
    subject: "Nouvelle commande 3e pilier reçue de horizon3.finance",
    greeting: "Bonjour,",
    intro: "Une commande de solution 3e pilier a été reçue de horizon3.finance le {{date}}.",
    product: "Produit : {{product}} ({{company}})",
    strategy: "Stratégie : {{strategy}}",
    investment: "Versement : {{investment}}",
    capital: "Capital initial : {{capital}}",
    reference: "Référence horizon3 : {{reference}}",
    action: "Suivre la commande dans CoverView Partner :",
    button: "Ouvrir la demande",
    pending:
      "La demande sera ouverte dans CoverView Partner dès que le compte qui suit ces commandes y sera disponible.",
    privacy:
      "Les coordonnées du client ne figurent pas dans ce message : elles se consultent dans CoverView Partner.",
    signature: "CoverView",
  },
} as const;
const facts = "{{product}}\n{{strategy}}\n{{investment}}\n{{capital}}\n{{reference}}";
const textLayouts = {
  link: `{{greeting}}\n\n{{intro}}\n\n${facts}\n\n{{action}}\n{{link}}\n\n{{privacy}}\n\n{{signature}}\n({{version}})\n`,
  pending: `{{greeting}}\n\n{{intro}}\n\n${facts}\n\n{{pending}}\n\n{{privacy}}\n\n{{signature}}\n({{version}})\n`,
};
const htmlFacts =
  "<p>{{product}}<br>{{strategy}}<br>{{investment}}<br>{{capital}}<br>{{reference}}</p>";
const htmlLayouts = {
  link: `<!doctype html><html lang="{{locale}}"><body><p>{{greeting}}</p><p>{{intro}}</p>${htmlFacts}<p>{{action}}</p><p><a href="{{link}}">{{button}}</a></p><p>{{privacy}}</p><p>{{signature}}</p><p style="color:#666;font-size:12px">{{version}}</p></body></html>`,
  pending: `<!doctype html><html lang="{{locale}}"><body><p>{{greeting}}</p><p>{{intro}}</p>${htmlFacts}<p>{{pending}}</p><p>{{privacy}}</p><p>{{signature}}</p><p style="color:#666;font-size:12px">{{version}}</p></body></html>`,
};
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
function fill(
  layout: string,
  values: Record<string, string>,
  transform = (value: string) => value,
) {
  return layout.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`EMAIL_TEMPLATE_VARIABLE_MISSING_${name}`);
    return transform(value);
  });
}

export function horizon3RequestMessage(raw: z.input<typeof variablesSchema>) {
  const v = variablesSchema.parse(raw),
    c = copy[v.locale];
  const variables = {
    product: v.product,
    company: v.company,
    strategy: v.strategy,
    investment: v.investment,
    capital: v.capital,
    reference: v.reference,
    date: new Intl.DateTimeFormat(c.dateLocale, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(v.receivedAt),
  };
  const values = {
    locale: v.locale,
    link: v.link ?? "",
    version: horizon3RequestTemplate,
    greeting: c.greeting,
    intro: fill(c.intro, variables),
    product: fill(c.product, variables),
    strategy: fill(c.strategy, variables),
    investment: fill(c.investment, variables),
    capital: fill(c.capital, variables),
    reference: fill(c.reference, variables),
    action: c.action,
    button: c.button,
    pending: c.pending,
    privacy: c.privacy,
    signature: c.signature,
  };
  const layout = v.link ? "link" : "pending";
  return {
    subject: c.subject,
    text: fill(textLayouts[layout], values),
    html: fill(htmlLayouts[layout], values, escape),
  };
}
