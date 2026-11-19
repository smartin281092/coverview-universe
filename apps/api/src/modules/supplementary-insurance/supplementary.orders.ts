import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import type {
  SupplementaryCanton,
  SupplementaryOrderInput,
  SupplementaryOrderReceipt,
  SupplementaryPrice,
} from "@coverview/contracts/supplementary-insurance";
import type { Mailer } from "../../platform/mailer.js";
import { chf } from "./supplementary.format.js";
import { quoteYear } from "./supplementary.interpret.js";
import {
  supplementaryOrderMessage,
  supplementaryOrderTemplate,
} from "./supplementary.order-template.js";
import { SupplementaryError, type SupplementaryRepository } from "./supplementary.repository.js";

// Orders of a supplementary insurance product (user request of 19 November 2026: "Commander qui
// m'envoie un email … avec le produit en question"). The order is stored before it is confirmed,
// once per requestId; the table is the outbox of the internal notice, sent by the job (MAIL-01),
// as the horizon3 orders of partner.intake.ts.
const maxAttempts = 10;
// MAIL-07: the public form can never send more than this many notices an hour.
const hourlyNotices = 60;
const cantonNames: Record<SupplementaryCanton, string> = {
  VD: "Vaud",
  GE: "Genève",
  FR: "Fribourg",
  VS: "Valais",
  NE: "Neuchâtel",
  JU: "Jura",
};
const storedSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  birthYear: z.number().int(),
  sex: z.enum(["female", "male"]).nullable(),
  canton: z.enum(["VD", "GE", "FR", "VS", "NE", "JU"]),
  message: z.string().nullable(),
  insurer: z.string(),
  productName: z.string(),
  variant: z.string(),
  option: z.string(),
  price: z
    .object({ minMinor: z.number().int(), maxMinor: z.number().int(), from: z.boolean() })
    .nullable(),
  locality: z.string(),
});
type Stored = z.infer<typeof storedSchema>;
export type OrderSettings = { notifyEmail: string };

// Same reference for the same request, whether it is stored or not (honeypot).
const referenceOf = (requestId: string) =>
  `LCA-${createHash("sha256").update(requestId.toLowerCase()).digest("hex").slice(0, 10).toUpperCase()}`;
function priceText(price: Stored["price"], sex: Stored["sex"]) {
  if (!price) return "Prix sur demande (aucun prix relevé pour ce profil)";
  const value =
    price.minMinor === price.maxMinor
      ? chf(price.minMinor)
      : `${chf(price.minMinor)} à ${chf(price.maxMinor)}`;
  const detail = price.from
    ? " (dès, selon la variante)"
    : sex === null && price.minMinor !== price.maxMinor
      ? " (fourchette femme–homme)"
      : "";
  return `${price.from ? "dès " : ""}${value} par mois${detail}`;
}

// The order's product, variant and price for the client's profile, recomputed by the server.
async function describe(repository: SupplementaryRepository, input: SupplementaryOrderInput) {
  const { catalog, index } = await repository.current();
  const product = index.products.get(input.productKey);
  if (!product) throw new SupplementaryError("SUPPLEMENTARY_PRODUCT_UNKNOWN", 422);
  const quote = await repository.quote({
    year: quoteYear,
    birthYear: input.birthYear,
    sex: input.sex,
    canton: input.canton,
  });
  const own = quote.prices.filter((price) => price.productKey === product.key);
  const exact = own.find(
    (price) => price.variant === input.variant && price.option === input.option,
  );
  const catalogVariant = product.variants.find(
    (variant) => variant.key === input.variant || variant.name === input.variant,
  );
  let price: Stored["price"] = null;
  let variantLabel = [input.variant, input.option].filter(Boolean).join(" · ");
  if (exact) price = { minMinor: exact.minMinor, maxMinor: exact.maxMinor, from: false };
  else if (input.option === "" && (input.variant === "" || catalogVariant)) {
    // A catalogue variant (or none): the calculator's default prices that belong to it.
    const defaults = own.some((item) => item.option === "")
      ? own.filter((item) => item.option === "")
      : own;
    const matching: SupplementaryPrice[] = catalogVariant
      ? defaults.filter((item) =>
          index.matcher(product, item.variant, item.option).includes(catalogVariant.key),
        )
      : defaults;
    const cheapest = matching.toSorted((a, b) => a.minMinor - b.minMinor)[0];
    if (cheapest)
      price = {
        minMinor: cheapest.minMinor,
        maxMinor: cheapest.maxMinor,
        from: matching.length > 1,
      };
    if (catalogVariant) variantLabel = catalogVariant.name;
  } else throw new SupplementaryError("SUPPLEMENTARY_VARIANT_UNKNOWN", 422);
  return {
    catalogId: catalog.id,
    insurer: index.insurerNames.get(product.insurer) ?? product.insurer,
    productName: product.name,
    variantLabel: variantLabel || "Variante par défaut du calculateur",
    price,
    locality: `${quote.reference.postalCode} ${quote.reference.locality} (${quote.reference.canton})`,
  };
}

// Stores the order once per request id. The same order again changes nothing; another content
// under the same id is refused (API-04). A filled honeypot gets the same receipt, nothing stored.
export async function receiveSupplementaryOrder(
  pool: Pool,
  repository: SupplementaryRepository,
  input: SupplementaryOrderInput,
): Promise<SupplementaryOrderReceipt> {
  const requestId = input.requestId.toLowerCase();
  const receipt = {
    success: true as const,
    requestId: input.requestId,
    reference: referenceOf(requestId),
  };
  if (input.website) return receipt;
  const content = { ...input, website: undefined, requestId: undefined };
  const fingerprint = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  const existing = async () =>
    (
      await pool.query<{ fingerprint: string }>(
        "select fingerprint from supplementary_orders where request_id=$1",
        [requestId],
      )
    ).rows[0];
  const before = await existing();
  if (before) {
    if (before.fingerprint !== fingerprint)
      throw new SupplementaryError("SUPPLEMENTARY_IDEMPOTENCY_REUSED", 422);
    return receipt;
  }
  const described = await describe(repository, input);
  const data: Stored = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    birthYear: input.birthYear,
    sex: input.sex,
    canton: input.canton,
    message: input.message || null,
    insurer: described.insurer,
    productName: described.productName,
    variant: described.variantLabel,
    option: input.option,
    price: described.price,
    locality: described.locality,
  };
  const created = await pool.query(
    `insert into supplementary_orders(id,request_id,reference,fingerprint,catalog_id,product_key,data)
     values($1,$2,$3,$4,$5,$6,$7::jsonb) on conflict (request_id) do nothing`,
    [
      `slo_${randomUUID()}`,
      requestId,
      receipt.reference,
      fingerprint,
      described.catalogId,
      input.productKey,
      JSON.stringify(data),
    ],
  );
  if (!created.rowCount && (await existing())?.fingerprint !== fingerprint)
    throw new SupplementaryError("SUPPLEMENTARY_IDEMPOTENCY_REUSED", 422);
  return receipt;
}

// Job: sends the queued notices, retried 5 minutes per attempt already made, 10 attempts at most.
// Without a mail adapter the notices stay queued without using a try.
export async function processSupplementaryOrders(
  pool: Pool,
  mailer: Mailer | null,
  settings: OrderSettings,
) {
  // An interrupted send is sent again: a notice may arrive twice, never not at all (G-10).
  await pool.query(
    "update supplementary_orders set notification='queued' where notification='sending' and claimed_at<now()-interval '10 minutes'",
  );
  if (!mailer) return { sent: 0, failed: 0 };
  const recent = (
    await pool.query<{ count: number }>(
      "select count(*)::int count from supplementary_orders where notified_at>now()-interval '1 hour'",
    )
  ).rows[0]!.count;
  let sent = 0,
    failed = 0;
  for (let i = 0; i < Math.min(20, hourlyNotices - recent); i += 1) {
    const claimed = (
      await pool.query<{ id: string; reference: string; data: unknown; created_at: Date }>(
        `update supplementary_orders set notification='sending',claimed_at=now(),attempts=attempts+1
         where id=(select id from supplementary_orders where notification='queued'
           and (claimed_at is null or claimed_at<now()-attempts*interval '5 minutes')
           order by created_at,id for update skip locked limit 1)
         returning id,reference,data,created_at`,
      )
    ).rows[0];
    if (!claimed) break;
    try {
      const data = storedSchema.parse(claimed.data);
      const message = supplementaryOrderMessage({
        locale: "fr",
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        profile: profileText(data),
        insurer: data.insurer,
        product: data.productName,
        variant: data.variant,
        price: priceText(data.price, data.sex),
        locality: data.locality,
        message: data.message ?? "aucun",
        reference: claimed.reference,
        receivedAt: claimed.created_at,
      });
      await mailer.send({
        to: settings.notifyEmail,
        ...message,
        tag: supplementaryOrderTemplate,
        reference: claimed.id,
      });
    } catch {
      await pool.query(
        `update supplementary_orders set notification=case when attempts>=${maxAttempts} then 'failed' else 'queued' end
         where id=$1 and notification='sending'`,
        [claimed.id],
      );
      failed += 1;
      continue;
    }
    await pool.query(
      "update supplementary_orders set notification='sent',notified_at=now() where id=$1 and notification='sending'",
      [claimed.id],
    );
    sent += 1;
  }
  return { sent, failed };
}

function profileText(data: Pick<Stored, "birthYear" | "sex" | "canton">) {
  const sex = data.sex === "female" ? "femme" : data.sex === "male" ? "homme" : "sexe non précisé";
  return `né·e en ${data.birthYear} (${quoteYear - data.birthYear} ans en ${quoteYear}), ${sex}, canton de ${cantonNames[data.canton]}`;
}

// MAIL-03 preview: fictitious values only.
export function supplementaryOrderPreview() {
  return supplementaryOrderMessage({
    locale: "fr",
    name: "Camille Exemple",
    email: "camille@example.test",
    phone: "+41 79 000 00 00",
    profile: profileText({ birthYear: 1990, sex: null, canton: "VD" }),
    insurer: "Compagnie exemple",
    product: "Produit exemple",
    variant: "Variante exemple",
    price: priceText({ minMinor: 3130, maxMinor: 3450, from: false }, null),
    locality: "1003 Lausanne (VD)",
    message: "Merci de me rappeler en fin de journée.",
    reference: referenceOf("00000000-0000-4000-8000-000000000000"),
    receivedAt: new Date(),
  });
}
