import { test, expect } from "@playwright/test";

// Ces scénarios UI simulent exclusivement le transport d'identité via Playwright.
// Ils ne créent aucune identité/session/habilitation WorkOS et ne prouvent pas l'intégration.
const makeIdentity = (id = "alice") => ({
  user: { id, email: `${id}@example.test` },
  session: { id: `session_${id}`, expiresAt: "2026-12-01T00:00:00.000Z" },
  csrfToken: `csrf_${id}`,
  permissions: ["identity:admin"],
});
const makeSession = (index) => ({
  id: index === 0 ? "session_alice" : `device_${index}`,
  device: `Navigateur de test ${index}`,
  createdAt: "2026-09-05T00:00:00.000Z",
  lastSeenAt: "2026-09-05T12:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
  isCurrent: index === 0,
});

async function expectNoIdentityStorage(page) {
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
  }));
  expect(storage.local).toEqual([]);
  // Le routeur préexistant conserve uniquement ses positions de défilement.
  expect(storage.session.filter(([key]) => !key.startsWith("tsr-scroll-restoration-"))).toEqual([]);
  expect(JSON.stringify(storage.session)).not.toMatch(
    /csrf_alice|session_alice|alice@example\.test/,
  );
}

async function identityTransport(page, overrides = {}) {
  const state = {
    identity: makeIdentity(),
    access: "denied",
    sessions: Array.from({ length: 21 }, (_, index) => makeSession(index)),
    logoutRequests: [],
    challengeCount: 0,
    verificationCount: 0,
    ...overrides,
  };
  await page.route("http://127.0.0.1:4100/identity/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": request.headers().origin ?? "http://127.0.0.1:4101",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "Content-Type,X-CSRF-Token,Idempotency-Key,X-Request-Id",
      "cache-control": "no-store",
    };
    const reply = (body, status = 200) => route.fulfill({ json: body, status, headers });
    const deny = (code, status = 403) =>
      reply({ error: { code, message: code, requestId: "test_transport" } }, status);
    if (request.method() === "OPTIONS") return reply({});
    if (url.pathname === "/identity/config") return reply({ enabled: true });
    if (url.pathname === "/identity/logout") {
      state.logoutRequests.push({ body: request.postDataJSON(), headers: request.headers() });
      state.identity = null;
      if (state.loseLogoutResponse && state.logoutRequests.length === 1)
        return route.abort("connectionreset");
      return reply({
        success: true,
        remoteRevocation: state.logoutRequests.length === 1 ? "pending" : "complete",
      });
    }
    if (!state.identity) return deny("IDENTITY_UNAUTHENTICATED", 401);
    if (url.pathname === "/identity/me") return reply(state.identity);
    if (url.pathname.startsWith("/identity/workspace/")) {
      if (decodeURIComponent(url.pathname.split("/").at(-1)) !== state.identity.user.id)
        return deny("IDENTITY_ACCESS_DENIED");
      return reply({ ownerId: state.identity.user.id, email: state.identity.user.email });
    }
    if (url.pathname === "/identity/admin") {
      if (state.access === "denied") return deny("IDENTITY_ACCESS_DENIED");
      if (state.access === "mfa") return deny("IDENTITY_MFA_REQUIRED");
      return reply({ userId: state.identity.user.id });
    }
    if (url.pathname === "/identity/mfa/challenge") {
      state.challengeCount++;
      return reply({ expiresAt: "2026-12-01T00:00:00.000Z" });
    }
    if (url.pathname === "/identity/mfa/verify") {
      state.verificationCount++;
      if (request.postDataJSON().code !== "123456") return deny("IDENTITY_MFA_INVALID");
      state.access = "allowed";
      state.identity = {
        ...state.identity,
        session: { ...state.identity.session, id: "session_rotated" },
        csrfToken: "csrf_rotated",
      };
      return reply({ success: true });
    }
    if (url.pathname.endsWith("/revoke")) {
      const id = url.pathname.split("/").at(-2);
      state.sessions = state.sessions.filter((session) => session.id !== id);
      if (id === state.identity.session.id) state.identity = null;
      return reply({ success: true });
    }
    if (url.pathname === "/identity/sessions") {
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      return reply({
        sessions: state.sessions.slice(offset, offset + 20),
        nextCursor: state.sessions.length > offset + 20 ? String(offset + 20) : null,
      });
    }
    return deny("IDENTITY_NOT_FOUND", 404);
  });
  return state;
}

test("identité désactivée : les trois surfaces reflètent la configuration API réelle", async ({
  page,
  request,
}) => {
  const config = await request.get("http://127.0.0.1:4100/identity/config");
  expect(await config.json()).toEqual({ enabled: false });
  for (const port of [4101, 4102]) {
    await page.goto(`http://127.0.0.1:${port}/account`);
    await expect(
      page.getByRole("heading", { name: "Connexion indisponible pour le moment" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Se connecter", exact: true })).toHaveCount(0);
  }
  await page.goto("http://127.0.0.1:4103/account");
  await expect(page.getByRole("status")).toHaveText(
    "La connexion n’est pas encore disponible dans cette préversion.",
  );
  await expect(page.getByRole("link", { name: "Se connecter", exact: true })).toBeHidden();
});

test("transport simulé : compte Wallet, espace propriétaire et refus d’un autre espace", async ({
  page,
}) => {
  await identityTransport(page);
  await page.goto("http://127.0.0.1:4101/account");
  await expect(page.getByText("alice@example.test", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Ouvrir mon espace privé" }).click();
  await expect(page).toHaveURL(/\/workspace\/alice$/);
  await expect(page.getByText("Espace de alice@example.test", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "roadmap/evidence/S-000b-wallet-private-simulated.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:4101/workspace/bob");
  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
  await expect(page.getByText("Espace de alice@example.test", { exact: true })).toHaveCount(0);
  await expectNoIdentityStorage(page);
});

test("transport simulé : changement de compte et expiration au retour de focus", async ({
  page,
}) => {
  const state = await identityTransport(page);
  await page.goto("http://127.0.0.1:4101/account");
  await expect(page.getByText("alice@example.test", { exact: true })).toBeVisible();
  state.identity = makeIdentity("bob");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.getByText("bob@example.test", { exact: true })).toBeVisible();
  await expect(page.getByText("alice@example.test", { exact: true })).toHaveCount(0);
  state.identity = null;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.getByRole("heading", { name: "Connectez-vous pour continuer" })).toBeVisible();
  await expect(page.getByText("bob@example.test", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Se connecter", exact: true })).toHaveAttribute(
    "href",
    "http://127.0.0.1:4100/auth/login?surface=wallet",
  );
});

test("transport simulé : appareils paginés, révocation distante puis de l’appareil courant", async ({
  page,
}) => {
  await identityTransport(page);
  await page.goto("http://127.0.0.1:4101/devices");
  await expect(page.getByRole("button", { name: /^Fermer l’accès de Navigateur/ })).toHaveCount(20);
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Fermer l’accès de Navigateur/ })).toHaveCount(1);
  await expect(page.getByText("Navigateur de test 0", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fermer l’accès de Navigateur de test 20", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Aucun appareil sur cette page" })).toBeVisible();
  await page.getByRole("button", { name: "Précédent", exact: true }).click();
  await expect(page.getByText("Cet appareil", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Fermer l’accès de Navigateur de test 0", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Connectez-vous pour continuer" })).toBeVisible();
});

test("transport simulé : le refus admin du serveur prévaut sur les permissions du navigateur", async ({
  page,
}) => {
  await identityTransport(page);
  await page.goto("http://127.0.0.1:4102/account");
  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
  await expect(page.getByText("Votre accès équipe est confirmé", { exact: true })).toHaveCount(0);
});

test("transport simulé : MFA invalide, nouveau challenge, rotation et accès admin", async ({
  page,
}) => {
  const state = await identityTransport(page, { access: "mfa" });
  await page.goto("http://127.0.0.1:4102/account");
  await page.getByRole("link", { name: "Vérifier mon identité" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  await page.getByRole("button", { name: "Commencer la vérification" }).click();
  const code = page.getByRole("textbox", { name: "Code de votre application d’authentification" });
  await expect(code).toBeFocused();
  await code.fill("000000");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await expect(code).toBeVisible();
  await expect(code).toHaveValue("000000");
  expect(state.challengeCount).toBe(1);
  await page.getByRole("button", { name: "Confirmer mon identité" }).click();
  await expect(page.getByRole("alert")).toContainText("Commencez une nouvelle vérification");
  await expect(code).toHaveCount(0);
  await page.getByRole("button", { name: "Commencer la vérification" }).click();
  await code.fill("123456");
  await page.screenshot({ path: "roadmap/evidence/S-000b-mfa-simulated.png", fullPage: true });
  await page.getByRole("button", { name: "Confirmer mon identité" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("heading", { name: "Votre accès équipe est confirmé" }),
  ).toBeVisible();
  expect(state.challengeCount).toBe(2);
  expect(state.verificationCount).toBe(2);
});

for (const port of [4101, 4102]) {
  test(`transport simulé : logout ${port}, cache effacé et reprise exacte de la commande en attente`, async ({
    page,
  }) => {
    const state = await identityTransport(page, { access: "allowed" });
    await page.goto(`http://127.0.0.1:${port}/account`);
    await page
      .getByRole("button", { name: "Se déconnecter de tous les appareils", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Votre accès à CoverView est fermé" }),
    ).toBeVisible();
    await expect(page.getByText(/alice@example\.test/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ouvrir mon espace privé" })).toHaveCount(0);
    await page.getByRole("button", { name: "Terminer la déconnexion" }).click();
    await expect(page.getByRole("status")).toHaveText("La déconnexion est terminée.");
    expect(state.logoutRequests).toHaveLength(2);
    expect(state.logoutRequests[1].body).toEqual(state.logoutRequests[0].body);
    for (const header of ["x-csrf-token", "idempotency-key"]) {
      expect(state.logoutRequests[1].headers[header]).toBe(state.logoutRequests[0].headers[header]);
    }
    await page.getByRole("button", { name: "Revenir à mon compte" }).click();
    await expect(
      page.getByRole("heading", { name: "Connectez-vous pour continuer" }),
    ).toBeVisible();
  });
}

test("transport simulé : www et Wallet retrouvent la même identité sans stockage d’identité", async ({
  page,
}) => {
  const state = await identityTransport(page);
  await page.goto("http://127.0.0.1:4103/account");
  await expect(page.getByRole("status")).toHaveText("Vous êtes connecté à CoverView.");
  await expect(page.getByText("alice@example.test", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: /Retrouver mon compte dans Wallet/ }).click();
  await expect(page.getByText("alice@example.test", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Mon compte sur le site" }).click();
  await expect(page.getByRole("status")).toHaveText("Vous êtes connecté à CoverView.");
  state.identity = null;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.getByRole("status")).toHaveText(
    "Connectez-vous pour retrouver votre espace personnel.",
  );
  await expectNoIdentityStorage(page);
});

test("transport simulé : une réponse logout perdue conserve la reprise après expiration serveur", async ({
  page,
}) => {
  const state = await identityTransport(page, { loseLogoutResponse: true });
  await page.goto("http://127.0.0.1:4101/account");
  await page.getByRole("button", { name: "Se déconnecter de tous les appareils" }).click();
  await expect(page.getByRole("status")).toContainText("n’a pas pu être confirmé");
  await expect(
    page.getByRole("heading", { name: "Votre accès à CoverView est fermé" }),
  ).toHaveCount(0);
  await expect(page.getByText(/alice@example\.test/)).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByRole("button", { name: "Terminer la déconnexion" }).click();
  await expect(page.getByRole("status")).toHaveText("La déconnexion est terminée.");
  expect(state.logoutRequests).toHaveLength(2);
  for (const header of ["x-csrf-token", "idempotency-key"])
    expect(state.logoutRequests[1].headers[header]).toBe(state.logoutRequests[0].headers[header]);
});
