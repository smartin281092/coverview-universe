import { describe, it, expect } from "vitest";
import {
  surveyResponseInputSchema,
  qualityActionInputSchema,
  qualitySettingsInputSchema,
} from "@coverview/contracts/partner-quality";
import {
  recordingRequestInputSchema,
  transcriptInputSchema,
} from "@coverview/contracts/partner-communications";
import {
  pilotageScopeSchema,
  pilotageSourceQuerySchema,
  goalInputSchema,
} from "@coverview/contracts/partner-pilotage";
import {
  metricValue,
  pilotageMetrics,
} from "../modules/partner-workspace/partner.pilotage-metrics.js";

describe("quality and pilotage boundary invariants", () => {
  const response = {
    rating: 5,
    experience: "advisor",
    positives: ["clarity"],
    improvements: [],
    comment: "",
    callbackRequested: false,
    confirmed: true,
  };
  it("keeps the five-star and improvement branches mutually exclusive", () => {
    expect(surveyResponseInputSchema.safeParse(response).success).toBe(true);
    expect(
      surveyResponseInputSchema.safeParse({ ...response, callbackRequested: true }).success,
    ).toBe(false);
    expect(surveyResponseInputSchema.safeParse({ ...response, rating: 4 }).success).toBe(false);
    expect(
      surveyResponseInputSchema.safeParse({
        ...response,
        rating: 4,
        positives: [],
        improvements: ["follow_up"],
        callbackRequested: true,
      }).success,
    ).toBe(true);
    expect(
      surveyResponseInputSchema.safeParse({ ...response, positives: ["clarity", "clarity"] })
        .success,
    ).toBe(false);
    expect(surveyResponseInputSchema.safeParse({ ...response, confirmed: false }).success).toBe(
      false,
    );
  });
  it("requires a verified, motivated closure with no outstanding action", () => {
    const action = {
      expectedRevision: 1,
      action: "close",
      note: "Résultat vérifié avec le client",
      nextAction: "",
      dueAt: null,
      sharedWithClient: false,
      sharedWithAuthor: false,
      verified: true,
    };
    expect(qualityActionInputSchema.safeParse(action).success).toBe(true);
    for (const change of [
      { verified: false },
      { note: "" },
      { nextAction: "Une action reste à effectuer" },
      { dueAt: "2026-10-05T12:00:00Z" },
    ])
      expect(qualityActionInputSchema.safeParse({ ...action, ...change }).success).toBe(false);
  });
  it("does not accept credentialed, unsafe or unverified review URLs", () => {
    const config = {
      expectedRevision: 0,
      googleReviewUrl: null,
      sourceReference: "Référence de la configuration vérifiée",
      reviewed: true,
    };
    expect(qualitySettingsInputSchema.safeParse(config).success).toBe(true);
    for (const googleReviewUrl of [
      "http://g.page/abc",
      "https://g.page.evil.test/abc",
      "https://user:password@g.page/abc",
      "javascript:alert(1)",
      "https://www.google.com/url?q=https://evil.test",
    ])
      expect(qualitySettingsInputSchema.safeParse({ ...config, googleReviewUrl }).success).toBe(
        false,
      );
  });
  it("requires explicit purposes and a later retention deadline", () => {
    const request = {
      expectedLeadRevision: 1,
      channel: "phone",
      purposes: ["minutes"],
      notice: "Notice donnée avant tout enregistrement",
      sourceReference: "Document remis au client pour information",
      validUntil: "2026-10-05T12:00:00Z",
      retainUntil: "2026-10-06T12:00:00Z",
      confirmed: true,
    };
    expect(recordingRequestInputSchema.safeParse(request).success).toBe(true);
    for (const change of [
      { purposes: [] },
      { purposes: ["minutes", "minutes"] },
      { retainUntil: request.validUntil },
      { confirmed: false },
    ])
      expect(recordingRequestInputSchema.safeParse({ ...request, ...change }).success).toBe(false);
  });
  it("requires human source review, participants agreement and correction reason", () => {
    const transcript = {
      expectedRevision: 0,
      occurredAt: "2026-10-04T12:00:00Z",
      sourceReference: "Source externe de test uniquement",
      correctionReason: "",
      segments: [
        { speaker: "Participant de test", locator: "00:30", text: "Passage de test vérifié" },
      ],
      allParticipantsAgreed: true,
      sourceReviewed: true,
    };
    expect(transcriptInputSchema.safeParse(transcript).success).toBe(true);
    for (const change of [
      { sourceReviewed: false },
      { allParticipantsAgreed: false },
      { expectedRevision: 1 },
      { segments: [] },
    ])
      expect(transcriptInputSchema.safeParse({ ...transcript, ...change }).success).toBe(false);
  });
  it("rejects ambiguous populations and reversed periods even in source queries", () => {
    expect(
      pilotageScopeSchema.safeParse({
        kind: "team",
        organizationId: "org_test",
        userIds: ["one", "one"],
      }).success,
    ).toBe(false);
    expect(
      pilotageScopeSchema.safeParse({ kind: "individual", organizationId: null, userIds: [] })
        .success,
    ).toBe(false);
    expect(
      pilotageSourceQuerySchema.safeParse({
        metric: "contacts",
        from: "2026-10-05T00:00:00Z",
        to: "2026-10-04T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      goalInputSchema.safeParse({
        expectedRevision: 0,
        title: "Objectif de test",
        metric: "contact_rate",
        scope: { kind: "self", organizationId: null, userIds: [] },
        filters: {},
        from: "2026-10-01T00:00:00Z",
        to: "2026-11-01T00:00:00Z",
        target: 101,
        direction: "at_least",
        state: "active",
        reason: "Cible définie pour le test",
        confirmed: true,
      }).success,
    ).toBe(false);
  });
  it("separates empty counts from absent averages and uses the real denominator", () => {
    expect(metricValue(pilotageMetrics.new_leads, null, null, 0)).toBe(0);
    expect(metricValue(pilotageMetrics.offers_per_lead, null, null, 0)).toBeNull();
    expect(metricValue(pilotageMetrics.satisfaction, null, null, 0)).toBeNull();
    expect(metricValue(pilotageMetrics.contact_rate, 2, 8, 8)).toBe(25);
    expect(metricValue(pilotageMetrics.first_contact_days, 6, 2, 2)).toBe(3);
    expect(pilotageMetrics.verified_signatures.sql).toBeNull();
  });
});
