import { insuranceLeadCandidates } from "../insurance-requests/index.js";
import { insuranceLeadLinksSchema, insuranceLeadSourceSchema } from "@coverview/contracts/partner";
import { insuranceItemSchema } from "@coverview/contracts/insurance-requests";
import { event, newId } from "./partner.audit.js";
import { syncLeadNotifications } from "./partner.notifications.js";
import { date, fail, type Executor, type PartnerActor } from "./partner.policy.js";
import copy from "./partner.insurance.fr.json" with { type: "json" };

// Caller holds the current actor/membership and Lead locks. Never read the family request here.
export async function readInsuranceSource(db: Executor, actor: PartnerActor, leadId: string) {
  const row = (
    await db.query<{
      request_id: string;
      person_id: string;
      profile_id: string;
      consent_version: string;
      request_revision: number;
      snapshot: unknown;
      created_at: Date;
    }>(
      `select s.request_id,s.person_id,s.profile_id,s.consent_version,s.request_revision,s.snapshot,s.created_at
       from partner_insurance_sources s join partner_leads l on l.id=s.lead_id and l.client_profile_id=s.profile_id
       where s.lead_id=$1`,
      [leadId],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  const parsed = insuranceItemSchema.safeParse(row.snapshot);
  const item = parsed.success ? parsed.data : null;
  const consistent =
    item &&
    item.id === row.person_id &&
    item.profileId === row.profile_id &&
    item.modelId === item.offer.modelId &&
    item.localityId === item.locality.id &&
    item.deductible === item.offer.deductible &&
    item.accident === item.offer.accident &&
    item.locality.regionId === item.offer.regionId;
  const result = insuranceLeadSourceSchema.parse({
    leadId,
    requestId: row.request_id,
    personId: row.person_id,
    profileId: row.profile_id,
    requestRevision: row.request_revision,
    consentVersion: row.consent_version,
    transmittedAt: date(row.created_at),
    status: consistent ? "available" : "unavailable",
    item: consistent ? item : null,
  });
  const recent = await db.query(
    `select id from partner_events where lead_id=$1 and actor_id=$2 and subject_id=$3
     and kind='lead.insurance_request_viewed' and created_at>now()-interval '30 minutes' limit 1`,
    [leadId, actor.userId, row.person_id],
  );
  if (!recent.rowCount)
    await event(db, actor, leadId, "lead.insurance_request_viewed", "", "assigned", row.person_id);
  return result;
}

export async function insuranceLinks(db: Executor, actor: PartnerActor, requestId: string) {
  if (!actor.wallet || actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
  const candidates = await insuranceLeadCandidates(db, actor.userId, requestId);
  const links = await db.query<{ person_id: string; profile_id: string; lead_id: string }>(
    `select s.person_id,s.profile_id,s.lead_id from partner_insurance_sources s
     join managed_profiles p on p.id=s.profile_id and p.user_id=$2 where s.request_id=$1 limit 12`,
    [requestId, actor.userId],
  );
  return insuranceLeadLinksSchema.parse({
    requestId,
    people: candidates.map((source) => {
      const link = links.rows.find(
        (row) => row.person_id === source.item.id && row.profile_id === source.item.profileId,
      );
      return {
        personId: source.item.id,
        profileId: source.item.profileId,
        status: link
          ? "linked"
          : ["completed", "cancelled"].includes(source.state)
            ? "closed"
            : "consent_required",
        leadId: link?.lead_id ?? null,
      };
    }),
  });
}

export async function createInsuranceLead(
  db: Executor,
  actor: PartnerActor,
  requestId: string,
  personId: string,
) {
  if (!actor.wallet || actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
  const candidates = await insuranceLeadCandidates(db, actor.userId, requestId, true);
  const source = candidates.find((candidate) => candidate.item.id === personId);
  if (!source?.item.profileId) fail("PARTNER_NOT_FOUND", 404);
  const linked = await db.query<{ lead_id: string; profile_id: string }>(
    "select lead_id,profile_id from partner_insurance_sources where request_id=$1 and person_id=$2",
    [requestId, personId],
  );
  if (linked.rows[0]) {
    if (linked.rows[0].profile_id !== source.item.profileId) fail("PARTNER_INVALID_CLIENT");
    return linked.rows[0].lead_id;
  }
  if (["completed", "cancelled"].includes(source.state)) fail("PARTNER_INVALID_TRANSITION");
  const id = newId("lead");
  // This is the requested configuration, never a received/published offer or a contract.
  const item = source.item;
  const title = copy.title.replace("{name}", source.clientName).slice(0, 160);
  const money = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });
  const values: Record<string, string> = {
    date: new Intl.DateTimeFormat("fr-CH", {
      dateStyle: "medium",
      timeZone: "Europe/Zurich",
    }).format(new Date(source.submittedAt)),
    insurer: item.offer.insurerName,
    model: item.offer.name,
    premium: money.format(item.offer.monthlyPremiumMinor / 100),
    deductible: money.format(item.deductible),
    accident: item.accident ? copy.included : copy.excluded,
    locality: item.locality.locality,
    year: String(item.birthYear),
    currentInsurer: item.currentInsurerName ?? copy.missing,
  };
  await db.query(
    `insert into partner_leads(id,creator_id,client_user_id,client_profile_id,title,category,object,client_name,details,stage,assignment,priority,next_action,due_at)
     values($1,$2,$2,$3,$4,'health',$5,$6,$7,'new','unassigned','normal',$8,now()+interval '24 hours')`,
    [
      id,
      actor.userId,
      item.profileId,
      title,
      item.offer.name.slice(0, 200),
      source.clientName,
      JSON.stringify({
        context: copy.context.replace(/\{(\w+)\}/gu, (_, key: string) => values[key] ?? ""),
        email: "",
        phone: "",
        language: "fr",
        source: `insurance-request:${requestId}:${personId}`,
        transmissionAuthorized: true,
      }),
      copy.nextAction,
    ],
  );
  await db.query(
    `insert into partner_insurance_sources(lead_id,request_id,person_id,profile_id,consent_user_id,consent_version,request_revision,snapshot)
     values($1,$2,$3,$4,$5,'insurance-partner-v1',$6,$7)`,
    [id, requestId, personId, item.profileId, actor.userId, source.revision, JSON.stringify(item)],
  );
  await event(db, actor, id, "lead.insurance_request_linked", copy.event, "client");
  await syncLeadNotifications(db, id);
  return id;
}
