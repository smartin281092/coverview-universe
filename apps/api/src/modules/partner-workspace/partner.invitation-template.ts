import { z } from "zod";
import { clientInvitationNoticeVersion } from "@coverview/contracts/partner-invitations";

// Template client-invitation-v1 (MAIL-03): copy per locale, fixed layouts, validated variables and
// escaped values. Minimal personal data (MAIL-06): the category only, never the request title.
export const clientInvitationTemplate = "client-invitation-v1";
const variablesSchema = z
  .object({
    locale: z.enum(["fr"]),
    requester: z.string().trim().min(1).max(330),
    category: z.enum(["health", "vehicle", "pension", "household", "legal", "business", "other"]),
    link: z.url({ protocol: /^https?$/u }),
    expiresAt: z.date(),
  })
  .strict();
const copy = {
  fr: {
    dateLocale: "fr-CH",
    subject: "Une demande de conseil à votre nom sur CoverView",
    greeting: "Bonjour,",
    intro:
      "{{requester}} a enregistré, via CoverView, une demande de conseil en {{category}} qui vous concerne.",
    action:
      "Pour la suivre et partager vos préférences, ouvrez votre espace CoverView Wallet avec cette adresse email :",
    button: "Ouvrir mon espace CoverView",
    validity:
      "Ce lien est personnel et valable jusqu’au {{until}}. Il ne vaut ni mandat, ni consentement à recevoir des offres commerciales.",
    notice:
      "Vos coordonnées ont été transmises par l’intervenant cité ci-dessus. Elles servent uniquement au traitement de cette demande et sont accessibles aux professionnels qui en sont chargés et à CoverView. Vous pouvez consulter et faire rectifier ces informations depuis votre espace CoverView.",
    ignore:
      "Si cette demande ne vous concerne pas, ignorez ce message : aucun espace ne sera ouvert à votre nom.",
    signature: "CoverView",
    categories: {
      health: "assurance maladie",
      vehicle: "assurance véhicule",
      pension: "prévoyance",
      household: "assurance ménage et responsabilité civile",
      legal: "protection juridique",
      business: "assurance d’entreprise",
      other: "assurance",
    },
  },
} as const;
const textLayout =
  "{{greeting}}\n\n{{intro}}\n\n{{action}}\n{{link}}\n\n{{validity}}\n\n{{notice}}\n\n{{ignore}}\n\n{{signature}}\n({{version}})\n";
const htmlLayout =
  '<!doctype html><html lang="{{locale}}"><body><p>{{greeting}}</p><p>{{intro}}</p><p>{{action}}</p><p><a href="{{link}}">{{button}}</a></p><p>{{validity}}</p><p>{{notice}}</p><p>{{ignore}}</p><p>{{signature}}</p><p style="color:#666;font-size:12px">{{version}}</p></body></html>';
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

export function clientInvitationMessage(raw: z.input<typeof variablesSchema>) {
  const v = variablesSchema.parse(raw),
    c = copy[v.locale];
  const variables = {
    requester: v.requester,
    category: c.categories[v.category],
    until: new Intl.DateTimeFormat(c.dateLocale, {
      dateStyle: "long",
      timeZone: "Europe/Zurich",
    }).format(v.expiresAt),
  };
  const values = {
    locale: v.locale,
    link: v.link,
    version: clientInvitationNoticeVersion,
    greeting: c.greeting,
    intro: fill(c.intro, variables),
    action: c.action,
    button: c.button,
    validity: fill(c.validity, variables),
    notice: c.notice,
    ignore: c.ignore,
    signature: c.signature,
  };
  return {
    subject: c.subject,
    text: fill(textLayout, values),
    html: fill(htmlLayout, values, escape),
  };
}
