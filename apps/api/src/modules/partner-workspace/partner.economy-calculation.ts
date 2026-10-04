import type { CommercialTerms, EconomyEntryInput } from "@coverview/contracts/partner-economy";
import { fail } from "./partner.policy.js";

export type EconomyPosting = { id: string; entry: EconomyEntryInput; revision: number };
type Balance = {
  beneficiary: string;
  name: string;
  confirmedMinor: number | null;
  receivedMinor: number;
  reservedMinor: number;
  disputedMinor: number;
  paidMinor: number;
  recoveredMinor: number;
  clawbackMinor: number;
  availableMinor: number;
  recoveryDueMinor: number;
};
const bounded = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_000_000_000)
    fail("PARTNER_ACTION_REQUIRED");
  return value;
};
export function economyNet(
  gross: number,
  deductions: { code: string; amountMinor: number }[],
  terms: CommercialTerms,
  fixed: boolean,
) {
  if (
    (fixed && deductions.length) ||
    new Set(deductions.map((d) => d.code)).size !== deductions.length ||
    deductions.some((d) => !terms.deductions.some((t) => t.code === d.code))
  )
    fail("PARTNER_ACTION_REQUIRED");
  return bounded(gross - deductions.reduce((sum, d) => sum + d.amountMinor, 0));
}
// All shares use the same explicit net base. Floor each specified share in integer arithmetic;
// the receiver gets the residual cents. Allocate cumulative receipts, never each instalment.
function allocate(
  base: number,
  terms: CommercialTerms,
  supplier: string,
  receiver: string,
  fixed: boolean,
) {
  if (fixed) return new Map([[supplier, base]]);
  const shares = [
    ...(terms.supplier.model === "success"
      ? [{ userId: supplier, rateBps: terms.supplier.rateBps }]
      : []),
    { userId: "coverview", rateBps: terms.coverviewRateBps },
    ...terms.contributors,
  ];
  if (new Set([...shares.map((s) => s.userId), receiver]).size !== shares.length + 1)
    fail("PARTNER_ACTION_REQUIRED");
  const result = new Map<string, number>();
  let used = 0;
  for (const share of shares) {
    const amount = Number((BigInt(base) * BigInt(share.rateBps)) / 10_000n);
    result.set(share.userId, amount);
    used += amount;
  }
  result.set(receiver, bounded(base - used));
  return result;
}
export function calculateEconomy(
  terms: CommercialTerms,
  supplier: string,
  receiver: string,
  fixed: boolean,
  postings: EconomyPosting[],
  names: Map<string, string> = new Map(),
) {
  const reversed = new Set<string>();
  for (const posting of postings)
    if (posting.entry.kind === "reverse") {
      const targetId = posting.entry.entryId;
      const target = postings.find((p) => p.id === targetId);
      if (
        !target ||
        target.revision >= posting.revision ||
        target.entry.kind === "reverse" ||
        reversed.has(target.id)
      )
        fail("PARTNER_ACTION_REQUIRED");
      reversed.add(target.id);
    }
  const balances = new Map<string, Balance>();
  for (const beneficiary of allocate(0, terms, supplier, receiver, fixed).keys())
    balances.set(beneficiary, {
      beneficiary,
      name: names.get(beneficiary) ?? beneficiary,
      confirmedMinor: null,
      receivedMinor: 0,
      reservedMinor: 0,
      disputedMinor: 0,
      paidMinor: 0,
      recoveredMinor: 0,
      clawbackMinor: 0,
      availableMinor: 0,
      recoveryDueMinor: 0,
    });
  let confirmedMinor: number | null = null,
    receivedMinor = 0;
  let estimate: Extract<EconomyEntryInput, { kind: "estimate" }> | null = null;
  let reconciliation:
    (Extract<EconomyEntryInput, { kind: "reconcile" }> & { revision: number }) | null = null;
  let lastMoneyRevision = 0;
  const refresh = () => {
    const confirmations = allocate(confirmedMinor ?? 0, terms, supplier, receiver, fixed),
      receipts = allocate(receivedMinor, terms, supplier, receiver, fixed);
    for (const b of balances.values()) {
      b.confirmedMinor = confirmedMinor === null ? null : confirmations.get(b.beneficiary)!;
      b.receivedMinor = receipts.get(b.beneficiary)!;
      if (fixed) b.paidMinor = b.receivedMinor;
      const covered = Math.max(
        0,
        Math.min(b.confirmedMinor ?? 0, b.receivedMinor) - b.clawbackMinor,
      );
      const remaining = covered - b.paidMinor + b.recoveredMinor;
      b.availableMinor = bounded(Math.max(0, remaining - b.reservedMinor - b.disputedMinor));
      b.recoveryDueMinor = bounded(Math.max(0, -remaining));
    }
  };
  for (const posting of postings) {
    if (reversed.has(posting.id) || posting.entry.kind === "reverse") continue;
    const e = posting.entry;
    if (e.kind === "estimate") estimate = e;
    else if (e.kind === "confirm") {
      confirmedMinor = economyNet(e.grossMinor, e.deductions, terms, fixed);
      if (
        fixed &&
        (terms.supplier.model !== "fixed" || confirmedMinor !== terms.supplier.amountMinor)
      )
        fail("PARTNER_ACTION_REQUIRED");
      lastMoneyRevision = posting.revision;
    } else if (e.kind === "receive") {
      receivedMinor = bounded(receivedMinor + economyNet(e.grossMinor, e.deductions, terms, fixed));
      lastMoneyRevision = posting.revision;
    } else if (e.kind === "reconcile") reconciliation = { ...e, revision: posting.revision };
    else {
      const b = balances.get(e.beneficiary);
      if (!b) fail("PARTNER_ACTION_REQUIRED");
      const amount = e.amountMinor;
      if (e.kind === "reserve") b.reservedMinor = bounded(b.reservedMinor + amount);
      if (e.kind === "release") b.reservedMinor = bounded(b.reservedMinor - amount);
      if (e.kind === "dispute") b.disputedMinor = bounded(b.disputedMinor + amount);
      if (e.kind === "resolve_dispute") b.disputedMinor = bounded(b.disputedMinor - amount);
      if (e.kind === "pay") b.paidMinor = bounded(b.paidMinor + amount);
      if (e.kind === "recover") b.recoveredMinor = bounded(b.recoveredMinor + amount);
      if (e.kind === "clawback" || e.kind === "refund") {
        if (e.kind === "refund" && !fixed) fail("PARTNER_ACTION_REQUIRED");
        const held = Math.min(b.reservedMinor, amount);
        b.reservedMinor -= held;
        const disputed = Math.min(b.disputedMinor, amount - held);
        b.disputedMinor -= disputed;
        // A refund first settles any existing recovery debt (overpayment or an earlier
        // clawback). Only the excess refund reduces the remaining contractual right.
        const excess = fixed ? b.recoveryDueMinor : 0;
        b.clawbackMinor = bounded(
          b.clawbackMinor + (e.kind === "refund" ? Math.max(0, amount - excess) : amount),
        );
        if (e.kind === "refund") b.recoveredMinor = bounded(b.recoveredMinor + amount);
      }
      if (b.recoveredMinor > b.paidMinor) fail("PARTNER_ACTION_REQUIRED");
      lastMoneyRevision = posting.revision;
    }
    refresh();
  }
  refresh();
  return {
    confirmedMinor,
    receivedMinor,
    estimate: estimate
      ? {
          minimumMinor: estimate.minimumMinor,
          maximumMinor: estimate.maximumMinor,
          weightedMinimumMinor:
            estimate.probabilityBps === null
              ? null
              : Number((BigInt(estimate.minimumMinor) * BigInt(estimate.probabilityBps)) / 10000n),
          weightedMaximumMinor:
            estimate.probabilityBps === null
              ? null
              : Number((BigInt(estimate.maximumMinor) * BigInt(estimate.probabilityBps)) / 10000n),
          probabilityBps: estimate.probabilityBps,
          assumptions: estimate.assumptions,
        }
      : null,
    balances: [...balances.values()],
    reversed,
    reconciliation: reconciliation
      ? {
          expectedMinor: reconciliation.expectedMinor,
          observedMinor: reconciliation.observedMinor,
          differenceMinor: reconciliation.observedMinor - reconciliation.expectedMinor,
          current:
            reconciliation.revision > lastMoneyRevision &&
            !postings.some(
              (p) => p.entry.kind === "reverse" && p.revision > reconciliation.revision,
            ),
          explanation: reconciliation.explanation,
        }
      : null,
  };
}
