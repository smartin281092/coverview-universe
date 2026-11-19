import { z } from "zod";

// Template supplementary-order-v1 (MAIL-03): the internal notice of a supplementary insurance
// product ordered on coverview.ch (19 November 2026). It names the client with their contact
// details at the user's explicit request ("Commander qui m'envoie un email … avec le produit"),
// beyond MAIL-06's minimum: it only goes to the one internal address configured.
export const supplementaryOrderTemplate = "supplementary-order-v1";
const variablesSchema = z
  .object({
    locale: z.enum(["fr"]),
    name: z.string().trim().min(1).max(161),
    email: z.email().max(254),
    phone: z.string().trim().min(1).max(40),
    profile: z.string().trim().min(1).max(200),
    insurer: z.string().trim().min(1).max(120),
    product: z.string().trim().min(1).max(300),
    variant: z.string().trim().min(1).max(420),
    price: z.string().trim().min(1).max(200),
    locality: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(1000),
    reference: z.string().trim().min(1).max(40),
    receivedAt: z.date(),
  })
  .strict();
const copy = {
  fr: {
    dateLocale: "fr-CH",
    subject: "Nouvelle commande de complémentaire : {{product}} ({{insurer}})",
    greeting: "Bonjour,",
    intro: "Une commande de complémentaire santé a été reçue de coverview.ch le {{date}}.",
    product: "Produit : {{product}} ({{insurer}})",
    variant: "Variante : {{variant}}",
    price: "Prix mensuel indicatif : {{price}}",
    locality: "Localité de référence du prix : {{locality}}",
    client: "Client : {{name}}",
    email: "Email : {{email}}",
    phone: "Téléphone : {{phone}}",
    profile: "Profil : {{profile}}",
    message: "Message du client : {{message}}",
    reference: "Référence : {{reference}}",
    privacy:
      "Message interne : les coordonnées du client servent au suivi de sa commande et ne se transfèrent pas.",
    signature: "CoverView",
  },
} as const;
const text = `{{greeting}}\n\n{{intro}}\n\n{{product}}\n{{variant}}\n{{price}}\n{{locality}}\n\n{{client}}\n{{email}}\n{{phone}}\n{{profile}}\n\n{{message}}\n\n{{reference}}\n\n{{privacy}}\n\n{{signature}}\n({{version}})\n`;
const html = `<!doctype html><html lang="{{locale}}"><body><p>{{greeting}}</p><p>{{intro}}</p><p>{{product}}<br>{{variant}}<br>{{price}}<br>{{locality}}</p><p>{{client}}<br>{{email}}<br>{{phone}}<br>{{profile}}</p><p style="white-space:pre-line">{{message}}</p><p>{{reference}}</p><p>{{privacy}}</p><p>{{signature}}</p><p style="color:#666;font-size:12px">{{version}}</p></body></html>`;
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

export function supplementaryOrderMessage(raw: z.input<typeof variablesSchema>) {
  const v = variablesSchema.parse(raw),
    c = copy[v.locale];
  const variables = {
    name: v.name,
    email: v.email,
    phone: v.phone,
    profile: v.profile,
    insurer: v.insurer,
    product: v.product,
    variant: v.variant,
    price: v.price,
    locality: v.locality,
    message: v.message,
    reference: v.reference,
    date: new Intl.DateTimeFormat(c.dateLocale, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(v.receivedAt),
  };
  const values = {
    locale: v.locale,
    version: supplementaryOrderTemplate,
    greeting: c.greeting,
    intro: fill(c.intro, variables),
    product: fill(c.product, variables),
    variant: fill(c.variant, variables),
    price: fill(c.price, variables),
    locality: fill(c.locality, variables),
    client: fill(c.client, variables),
    email: fill(c.email, variables),
    phone: fill(c.phone, variables),
    profile: fill(c.profile, variables),
    message: fill(c.message, variables),
    reference: fill(c.reference, variables),
    privacy: c.privacy,
    signature: c.signature,
  };
  return {
    subject: fill(c.subject, variables).slice(0, 250),
    text: fill(text, values),
    html: fill(html, values, escape),
  };
}
