import { z } from "zod";

// Template horizon3-request-v2 (MAIL-03): the internal notice of an order received from
// horizon3.finance. It names the client with their email and phone, at the user's explicit
// choice of 16 October 2026 (plan S-042a, Q-3 b, beyond MAIL-06): one internal address only.
export const horizon3RequestTemplate = "horizon3-request-v2";
const variablesSchema = z
  .object({
    locale: z.enum(["fr"]),
    name: z.string().trim().min(1).max(161),
    email: z.email().max(254),
    phone: z.string().trim().min(1).max(40),
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
    client: "Client : {{name}}",
    email: "Email : {{email}}",
    phone: "Téléphone : {{phone}}",
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
      "Message interne : les coordonnées du client servent au suivi de sa commande et ne se transfèrent pas.",
    signature: "CoverView",
  },
} as const;
const facts =
  "{{client}}\n{{email}}\n{{phone}}\n\n{{product}}\n{{strategy}}\n{{investment}}\n{{capital}}\n{{reference}}";
const textLayouts = {
  link: `{{greeting}}\n\n{{intro}}\n\n${facts}\n\n{{action}}\n{{link}}\n\n{{privacy}}\n\n{{signature}}\n({{version}})\n`,
  pending: `{{greeting}}\n\n{{intro}}\n\n${facts}\n\n{{pending}}\n\n{{privacy}}\n\n{{signature}}\n({{version}})\n`,
};
const htmlFacts =
  "<p>{{client}}<br>{{email}}<br>{{phone}}</p><p>{{product}}<br>{{strategy}}<br>{{investment}}<br>{{capital}}<br>{{reference}}</p>";
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
    name: v.name,
    email: v.email,
    phone: v.phone,
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
    client: fill(c.client, variables),
    email: fill(c.email, variables),
    phone: fill(c.phone, variables),
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
