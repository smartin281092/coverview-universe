// Local demonstration data for one Wallet account (requested on 8 October 2026): a fictitious
// advisor publishes offers with their PDF, and contracts sit in the account's documents. The
// offers themselves carry no "fictive" mention (asked the same day); the context of each request
// and the advisor still say so. It runs only against the local database; each request once.
import { createHash, randomUUID } from "node:crypto";
import {
  leadCreateInputSchema,
  leadOfferInputSchema,
  partnerApplicationInputSchema,
  type leadCategorySchema,
} from "@coverview/contracts/partner";
import type { BenefitCategory } from "@coverview/contracts/partner-benefits";
import type { z } from "zod";

type LeadCategory = z.infer<typeof leadCategorySchema>;
import { assertLocalDatabase, loadEnvironment } from "../config.js";
import { createS3Storage } from "../file-storage.js";
import { documentConfig } from "../../modules/document-intelligence/document.config.js";
import { createPartnerRepository } from "../../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../../modules/partner-workspace/partner.policy.js";
import { createDatabase } from "./database.js";

type Feature = { label: string; value: string; category?: BenefitCategory; chf?: number };
type Offer = {
  company: string;
  product: string;
  premium: number;
  features: Feature[];
  // The 2027 comparator model whose facts the client reads with the offer (health only).
  healthModelId?: string;
};
type Request = { title: string; category: LeadCategory; object: string; offers: Offer[] };
type Contract = {
  name: string;
  companyId: "axa" | "allianz" | "generali" | "baloise";
  domain: "motor" | "pension_3a" | "household";
  subject: string;
  premiumMinor: number;
};

// An approved advisor keeps the categories of their application: health has its own advisor.
const advisors = {
  general: {
    email: "demo-conseiller@coverview.test",
    name: "Camille Exemple",
    categories: ["vehicle", "pension", "household"],
  },
  health: {
    email: "demo-conseiller-sante@coverview.test",
    name: "Alex Exemple",
    categories: ["health"],
  },
} as const;
const advisorOf = (request: Request) =>
  request.category === "health" ? advisors.health : advisors.general;
const marker = "Données fictives de démonstration locale CoverView.";
const requests: Request[] = [
  {
    title: "Assurance véhicule",
    category: "vehicle",
    object: "Volkswagen Golf 2021",
    offers: [
      {
        company: "AXA",
        product: "Auto Confort",
        premium: 128000,
        features: [
          { label: "Parking", value: "CHF 2000", category: "parking", chf: 2000 },
          { label: "Collision", value: "Incluse", category: "collision" },
          { label: "Franchise collision", value: "CHF 500", category: "deductible", chf: 500 },
        ],
      },
      {
        company: "Allianz",
        product: "Auto Plus",
        premium: 119000,
        features: [
          { label: "Parking", value: "CHF 1000", category: "parking", chf: 1000 },
          { label: "Collision", value: "Incluse", category: "collision" },
          { label: "Franchise collision", value: "CHF 1000", category: "deductible", chf: 1000 },
        ],
      },
      {
        company: "Generali",
        product: "Auto Essentiel",
        premium: 98000,
        features: [
          { label: "Parking", value: "CHF 500", category: "parking", chf: 500 },
          { label: "Franchise collision", value: "CHF 1500", category: "deductible", chf: 1500 },
        ],
      },
    ],
  },
  {
    title: "3ème pilier",
    category: "pension",
    object: "Prévoyance liée 3a",
    offers: [
      {
        company: "Bâloise",
        product: "Plan 3a Horizon",
        premium: 705600,
        features: [
          { label: "Capital projeté à la retraite", value: "CHF 185000", category: "maturity" },
          { label: "Prime", value: "CHF 588 par mois", category: "contribution" },
          { label: "Capital décès", value: "CHF 100000", category: "death", chf: 100000 },
          {
            label: "Libération du paiement des primes",
            value: "Incluse",
            category: "premium_waiver",
          },
        ],
      },
      {
        company: "AXA",
        product: "Prévoyance 3a Flex",
        premium: 600000,
        features: [
          { label: "Capital projeté à la retraite", value: "CHF 162000", category: "maturity" },
          { label: "Prime", value: "CHF 6000 par an", category: "contribution" },
          { label: "Capital décès", value: "CHF 50000", category: "death", chf: 50000 },
        ],
      },
    ],
  },
  {
    title: "Ménage et responsabilité civile",
    category: "household",
    object: "Appartement à Lausanne",
    offers: [
      {
        company: "Generali",
        product: "Ménage Duo",
        premium: 42000,
        features: [
          { label: "Inventaire du ménage", value: "CHF 60000", category: "contents", chf: 60000 },
          {
            label: "Responsabilité civile",
            value: "CHF 5000000",
            category: "liability",
            chf: 5000000,
          },
        ],
      },
    ],
  },
];
requests.push({
  title: "Assurance maladie de base",
  category: "health",
  object: "Assurance obligatoire des soins",
  offers: [
    {
      company: "Helsana",
      product: "Modèle médecin de famille",
      premium: 487800,
      healthModelId: "hm_5c98985a5a50ef98063296193008",
      features: [
        { label: "Franchise", value: "CHF 2500", category: "deductible", chf: 2500 },
        { label: "Couverture accident", value: "Exclue", category: "other" },
      ],
    },
    {
      company: "CSS",
      product: "Modèle Telmed",
      premium: 472320,
      healthModelId: "hm_367fe664e913ca628ec200aa5c93",
      features: [
        { label: "Franchise", value: "CHF 2500", category: "deductible", chf: 2500 },
        { label: "Couverture accident", value: "Exclue", category: "other" },
      ],
    },
    {
      company: "Groupe Mutuel",
      product: "Modèle standard",
      premium: 559200,
      healthModelId: "hm_b97d799899bd9126a92178cb7a0d",
      features: [
        { label: "Franchise", value: "CHF 300", category: "deductible", chf: 300 },
        { label: "Couverture accident", value: "Incluse", category: "other" },
      ],
    },
  ],
});
const contracts: Contract[] = [
  {
    name: "Police auto actuelle (fictive).pdf",
    companyId: "baloise",
    domain: "motor",
    subject: "Volkswagen Golf 2021",
    premiumMinor: 11500,
  },
  {
    name: "Police ménage actuelle (fictive).pdf",
    companyId: "axa",
    domain: "household",
    subject: "Appartement à Lausanne",
    premiumMinor: 3900,
  },
  {
    name: "Contrat 3a actuel (fictif).pdf",
    companyId: "allianz",
    domain: "pension_3a",
    subject: "Prévoyance liée 3a",
    premiumMinor: 50000,
  },
];

const key = () => randomUUID();
const later = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

// A one-page PDF with Helvetica text, enough for the original to be downloaded and read.
function pdf(lines: string[]) {
  const escape = (text: string) => text.replace(/[\\()]/gu, (c) => `\\${c}`);
  const stream = `BT /F1 13 Tf 56 780 Td 18 TL ${lines.map((line) => `(${escape(line)}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

async function main() {
  const email = process.argv[process.argv.indexOf("--email") + 1]?.trim().toLowerCase();
  if (!process.argv.includes("--email") || !email) throw new Error("Usage: --email <adresse>");
  const config = loadEnvironment();
  assertLocalDatabase(config);
  const documents = await documentConfig(config);
  if (!documents.enabled)
    throw new Error("Documents are disabled locally: originals cannot be stored");
  const storage = createS3Storage(documents);
  const database = createDatabase(config);
  const repository = createPartnerRepository(database.pool);
  const sessions: string[] = [];
  let administrator: string | null = null;
  try {
    // Offers published before an offer could name its model (9 October 2026) get it, once.
    for (const request of requests)
      for (const offer of request.offers)
        if (offer.healthModelId) {
          const linked = await database.pool.query(
            `update partner_offers o set data=o.data || jsonb_build_object('healthModelId', $1::text)
             from partner_leads l
             where o.lead_id=l.id and l.title=$2 and l.details->>'context'=$3
               and o.data->>'company'=$4 and o.data->>'product'=$5 and not (o.data ? 'healthModelId')`,
            [offer.healthModelId, request.title, marker, offer.company, offer.product],
          );
          if (linked.rowCount)
            process.stdout.write(
              `${offer.company} · ${offer.product} : modèle du comparateur relié (${linked.rowCount}).\n`,
            );
        }
    const client = (
      await database.pool.query<{ id: string }>(
        "select id from identity_users where lower(email)=$1",
        [email],
      )
    ).rows[0];
    if (!client)
      throw new Error("Sign in once to Wallet with this address before the demonstration");
    // Each request is added once; contracts only on the first run.
    const present = new Set(
      (
        await database.pool.query<{ title: string }>(
          "select l.title from partner_leads l join identity_users u on u.id=l.responsible_id where l.client_user_id=$1 and u.email=any($2)",
          [client.id, Object.values(advisors).map((advisor) => advisor.email)],
        )
      ).rows.map((row) => row.title),
    );
    const missing = requests.filter((request) => !present.has(request.title));
    if (!missing.length) {
      process.stdout.write("Demonstration data already present for this account; nothing added.\n");
      return;
    }
    // A short-lived session per actor, revoked at the end: nobody can sign in with it.
    async function session(userId: string, mfa: boolean) {
      const id = `session_demo_${key()}`;
      await database.pool.query(
        "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Démonstration locale',now()+interval '1 hour',$5)",
        [id, userId, `demo_${key()}`, sha256(key()), mfa ? new Date(Date.now() - 1000) : null],
      );
      sessions.push(id);
      return id;
    }
    async function account(address: string) {
      const found = (
        await database.pool.query<{ id: string }>("select id from identity_users where email=$1", [
          address,
        ])
      ).rows[0];
      if (found) return found.id;
      const id = `user_${key()}`;
      await database.pool.query(
        "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
        [id, `demo_${key()}`, address],
      );
      await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
        key(),
        id,
      ]);
      return id;
    }
    const adminId = await account(`demo-admin-${key()}@coverview.test`);
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Démonstration locale, révoquée après création')",
      [key(), adminId],
    );
    administrator = adminId;
    const admin: PartnerActor = {
      userId: adminId,
      id: await session(adminId, true),
      administrator: true,
    };
    // Each demonstration advisor is created and approved once, with a session for this run only.
    const ready = new Map<string, { advisorId: string; advisor: PartnerActor }>();
    async function advisorFor(spec: (typeof advisors)[keyof typeof advisors]) {
      const known = ready.get(spec.email);
      if (known) return known;
      const advisorId = await account(spec.email);
      const advisor: PartnerActor = {
        userId: advisorId,
        id: await session(advisorId, false),
        administrator: false,
      };
      if (!(await repository.context(advisor)).application) {
        await repository.apply(
          advisor,
          partnerApplicationInputSchema.parse({
            name: spec.name,
            organization: "Cabinet Exemple (fictif)",
            phone: "",
            roles: ["advisor"],
            categories: spec.categories,
            languages: "fr",
            regions: "VD, GE",
            qualifications: "Conseiller fictif pour la démonstration locale",
          }),
          key(),
        );
        const member = (await repository.context(advisor)).application!;
        await repository.review(
          admin,
          advisorId,
          {
            revision: member.revision,
            state: "approved",
            roles: ["advisor"],
            reason: "Conseiller fictif de démonstration locale",
            reviewDueAt: null,
            organizationState: "approved",
          },
          key(),
        );
      }
      const entry = { advisorId, advisor };
      ready.set(spec.email, entry);
      return entry;
    }
    const owner: PartnerActor = {
      userId: client.id,
      id: await session(client.id, false),
      administrator: false,
      wallet: true,
    };
    async function store(
      id: string,
      userId: string,
      name: string,
      bytes: Buffer,
      purpose: string | null,
      analysis: unknown,
    ) {
      const objectKey = `demo/${id}.pdf`;
      await storage.put(objectKey, bytes);
      await database.pool.query(
        `insert into files(id,user_id,name,mime,declared_mime,size,checksum,object_key,state,category,purpose,scan_version,analysis)
         values($1,$2,$3,'application/pdf','application/pdf',$4,$5,$6,'ready','insurance',$7,'demo-local',$8)`,
        [
          id,
          userId,
          name,
          bytes.length,
          sha256(bytes),
          objectKey,
          purpose,
          JSON.stringify(analysis),
        ],
      );
    }
    for (const request of missing) {
      const { advisorId, advisor } = await advisorFor(advisorOf(request));
      // A request an interrupted run left without advisor is resumed, not created twice.
      const leftover = (
        await database.pool.query<{ id: string }>(
          "select id from partner_leads where client_user_id=$1 and creator_id=$1 and title=$2 and responsible_id is null order by created_at limit 1",
          [client.id, request.title],
        )
      ).rows[0];
      const created = leftover
        ? await repository.detail(admin, leftover.id)
        : await repository.create(
            owner,
            leadCreateInputSchema.parse({
              title: request.title,
              category: request.category,
              object: request.object,
              context: marker,
              clientUserId: client.id,
              clientProfileId: null,
              clientName: "Client Wallet",
              email,
              phone: "",
              language: "fr",
              source: "Démonstration locale",
              transmissionAuthorized: true,
              priority: "normal",
              draft: false,
              nextAction: "Comparer les offres",
              dueAt: later(30),
            }),
            key(),
          );
      const routed = await repository.command(
        admin,
        created.id,
        {
          action: "assign",
          revision: created.revision,
          responsibleId: advisorId,
          reason: "Démonstration locale",
        },
        key(),
      );
      const accepted = await repository.command(
        advisor,
        created.id,
        { action: "accept", revision: routed.revision },
        key(),
      );
      // A first useful contact keeps the continuity worker from handing the request back.
      await repository.command(
        advisor,
        created.id,
        {
          action: "contact",
          revision: accepted.revision,
          outcome: "reached",
          note: "Premier échange fictif de démonstration",
          nextAction: "Présenter les offres",
          dueAt: later(30),
        },
        key(),
      );
      for (const offer of request.offers) {
        const documentId = `doc_${key()}`;
        const lines = [
          `${offer.company} - ${offer.product}`,
          `Objet : ${request.object}`,
          `Prime annuelle : CHF ${(offer.premium / 100).toFixed(2)}`,
          ...offer.features.map((feature) => `${feature.label} : ${feature.value}`),
        ];
        await store(
          documentId,
          advisorId,
          `Offre ${offer.company} - ${offer.product}.pdf`,
          pdf(lines),
          "lead_offer",
          {
            category: "insurance",
            evidence: null,
            fields: [],
            pages: [{ page: 1, text: lines.join("\n"), method: "demo", version: "demo-local" }],
          },
        );
        const revision = (await repository.detail(advisor, created.id)).revision;
        const withOffer = await repository.command(
          advisor,
          created.id,
          {
            action: "offer",
            revision,
            offer: leadOfferInputSchema.parse({
              documentId,
              sourceFingerprint: (await repository.extraction(advisor, created.id, documentId))
                .sourceFingerprint,
              company: offer.company,
              product: offer.product,
              reference: "",
              annualPremiumMinor: offer.premium,
              currency: "CHF",
              validUntil: later(60),
              effectiveDate: null,
              features: offer.features.map((feature, index) => ({
                key: `${feature.category ?? "other"}-${index}`,
                label: feature.label,
                value: feature.value,
                conditions: "",
                coverage: feature.value === "Incluse" ? "included" : "unknown",
                origin: "extracted",
                verification: "verified",
                source: `${feature.label} : ${feature.value}`,
                sourcePage: 1,
                ...(feature.category ? { category: feature.category } : {}),
                ...(feature.chf !== undefined
                  ? { limit: { value: feature.chf * 100, unit: "chf", period: "event" } }
                  : {}),
              })),
              summary: "",
              limitations: "",
              replacesId: null,
              ...(offer.healthModelId ? { healthModelId: offer.healthModelId } : {}),
            }),
          },
          key(),
        );
        const offerId = withOffer.offers.find(
          (item) => item.company === offer.company && item.product === offer.product && item.active,
        )!.id;
        for (const action of ["offer_review", "offer_publish"] as const)
          await repository.command(
            advisor,
            created.id,
            { action, revision: (await repository.detail(advisor, created.id)).revision, offerId },
            key(),
          );
      }
      process.stdout.write(
        `Demande « ${request.title} » : ${request.offers.length} offre(s) publiée(s).\n`,
      );
    }
    // The client's current contracts, in their own documents, ready to be chosen as reference.
    for (const contract of present.size ? [] : contracts) {
      const documentId = `doc_${key()}`;
      const text = [
        contract.name.replace(/\.pdf$/u, ""),
        "Contrat fictif de démonstration, sans valeur contractuelle.",
        `Objet assuré : ${contract.subject}`,
        `Prime : CHF ${(contract.premiumMinor / 100).toFixed(2)} par mois`,
      ];
      const source = {
        page: 1,
        text: text.join("\n"),
        method: "demo",
        version: "demo-local",
        confidence: 1,
        box: null,
      };
      await store(documentId, client.id, contract.name, pdf(text), null, {
        category: "insurance",
        title: contract.name.replace(/\.pdf$/u, ""),
        classification: "insurance_policy",
        evidence: null,
        fields: [],
        pages: [{ page: 1, text: text.join("\n"), method: "demo", version: "demo-local" }],
        insurance: {
          companyId: contract.companyId,
          companySource: source,
          domain: contract.domain,
          domainSource: source,
          policyNumber: { value: `DEMO-${key().slice(0, 8).toUpperCase()}`, source },
          insuredSubject: { value: contract.subject, source },
          startsOn: { value: "2026-01-01", source },
          endsOn: { value: "2026-12-31", source },
          premium: { amountMinor: contract.premiumMinor, currency: "CHF", period: "month", source },
        },
      });
    }
    if (!present.size)
      process.stdout.write(
        `${contracts.length} contrats fictifs ajoutés aux documents du compte.\n`,
      );
  } finally {
    // Nothing usable remains: demonstration sessions and the temporary administrator end here.
    if (sessions.length)
      await database.pool.query(
        "update identity_sessions set revoked_at=now() where id = any($1)",
        [sessions],
      );
    if (administrator)
      await database.pool.query(
        "update identity_admin_permissions set revoked_at=now() where user_id=$1 and revoked_at is null",
        [administrator],
      );
    await database.pool.end();
  }
}

await main();
