import { test, expect } from "@playwright/test";

// UI transport only: every API request is intercepted in a fresh browser context.
// No account, upload, OCR call or mutation reaches the real API. SQL is tested separately.
const wallet = process.env.E2E_WALLET_URL ?? "http://127.0.0.1:4101";
const id = "doc_00000000-0000-4000-8000-000000000010";
const personId = "prf_00000000-0000-4000-8000-000000000020";
const timestamp = "2026-09-10T12:00:00.000Z";
const identity = {
  user: { id: "ui-assignment-fixture", email: "assignment@example.test" },
  session: { id: "ui-assignment-session", expiresAt: "2027-01-01T00:00:00.000Z" },
  csrfToken: "ui-only-csrf",
  permissions: [],
};
const profile = (id, displayName, isSelf) => ({
  id,
  displayName,
  isSelf,
  kind: "person",
  revision: 1,
  completion: { general: 10, finances: 0, health: 0 },
});
const document = () => ({
  id,
  profileId: "self",
  profileAssignment: "ambiguous",
  profileAssignedAt: null,
  name: "Identité — fixture UI.pdf",
  title: "Identité — fixture UI",
  mime: "application/pdf",
  size: 15,
  checksum: "0".repeat(64),
  state: "ready",
  category: "identity",
  revision: 3,
  createdAt: timestamp,
  updatedAt: timestamp,
  analysisRequested: true,
  failure: null,
  canRetry: false,
  canDownload: false,
  analysis: {
    category: "identity",
    evidence: null,
    pages: [],
    fields: [
      {
        id: "00000000-0000-4000-8000-000000000030",
        field: "firstName",
        value: "Alex",
        source: {
          page: 1,
          text: "Alex",
          method: "ui-fixture",
          version: "1",
          confidence: null,
          box: null,
        },
      },
    ],
  },
  profileComparisons: [],
  changeRequests: [],
  decisions: [],
  reviewedValues: [],
  reviewGroups: [
    {
      id: "firstName",
      labelKey: "firstName",
      fields: [
        {
          extractionId: "00000000-0000-4000-8000-000000000030",
          field: "firstName",
          value: "Alex",
          currentValue: null,
        },
      ],
      different: false,
      canSync: false,
      profileRevision: 0,
    },
  ],
});

test("chooses a profile explicitly before exposing review and shows the assigned profile", async ({
  page,
}) => {
  let item = document();
  const writes = [];
  await page.route("http://127.0.0.1:4100/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": new URL(wallet).origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "Content-Type,X-CSRF-Token,Idempotency-Key,X-Request-Id",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "cache-control": "no-store",
    };
    const reply = (body, status = 200) => route.fulfill({ status, json: body, headers });
    if (request.method() === "OPTIONS") return reply({});
    if (url.pathname === "/identity/config") return reply({ enabled: true });
    if (url.pathname === "/identity/me") return reply(identity);
    if (url.pathname === "/action-center/summary")
      return reply({
        pending: 1,
        inProgress: 0,
        completed: 0,
        total: 1,
        optimizationPercent: 0,
        completionPercent: 0,
        incomplete: false,
      });
    if (url.pathname === "/profiles")
      return reply({
        profiles: [profile("self", "Alex Martin", true), profile(personId, "Alex Dupont", false)],
      });
    if (url.pathname === `/documents/${id}/profile`) {
      writes.push({ body: request.postDataJSON(), headers: request.headers() });
      item = {
        ...item,
        profileId: personId,
        profileAssignment: "manual",
        profileAssignedAt: timestamp,
        revision: 4,
      };
      return reply(item);
    }
    if (url.pathname === `/documents/${id}`) return reply(item);
    return reply(
      { error: { code: "UI_UNEXPECTED_REQUEST", message: "UI fixture only", requestId: "ui" } },
      500,
    );
  });
  await page.goto(`${wallet}/documents/${id}`);
  await expect(
    page.getByRole("heading", { name: "À quel profil appartient ce document ?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Associer au profil", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Vérifier", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Alex Dupont", exact: true }).check();
  await page.screenshot({
    path: ".planning-local/document-assignment-question.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Associer au profil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "À quel profil appartient ce document ?" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Alex Dupont", exact: true })).toHaveAttribute(
    "href",
    new RegExp(`person=${personId}`),
  );
  await expect(page.getByRole("button", { name: "Vérifier", exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ revision: 3, profileId: personId });
  expect(writes[0].headers["x-csrf-token"]).toBe(identity.csrfToken);
  expect(writes[0].headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".planning-local/document-assignment-mobile.png", fullPage: true });
});
