import { afterEach, expect, it, vi } from "vitest";
import { createHealthClient, type HealthOffer } from "./health-insurance.js";

afterEach(() => vi.unstubAllGlobals());
const input = {
  year: 2027 as const,
  birthYear: 1990,
  accident: false,
  deductible: 300,
  regionId: "VD-1",
};
const offer: HealthOffer = {
  id: "premium-selected",
  modelId: "model-selected",
  insurerId: 8,
  insurerName: "Test",
  name: "Test modèle",
  category: "TEL_DIG",
  regionId: "VD-1",
  monthlyPremiumMinor: 52000,
  deductible: 300,
  accident: false,
  ageGroup: "adult",
  restricted: false,
  eligibility: "region",
};
const page = (offers: HealthOffer[], nextOffset: number | null) =>
  new Response(
    JSON.stringify({
      year: 2027,
      ageGroup: "adult",
      regions: [],
      offers,
      total: nextOffset ? 16 : offers.length,
      nextOffset,
    }),
    { status: 200 },
  );

it("finds the same model beyond the first page, preserving the requested tariff settings", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      page(
        [{ ...offer, id: "cheapest", modelId: "another-model", monthlyPremiumMinor: 10000 }],
        15,
      ),
    )
    .mockResolvedValueOnce(page([offer], null));
  vi.stubGlobal("fetch", fetcher);
  const actual = await createHealthClient("http://localhost").modelOffer(input, offer.modelId, 8);
  expect(actual?.id).toBe(offer.id);
  expect(actual?.monthlyPremiumMinor).toBe(52000);
  const body = fetcher.mock.calls[1]?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected a JSON request body");
  expect(JSON.parse(body)).toMatchObject({
    ...input,
    offset: 15,
    insurerIds: [8],
    categories: [],
    benefitKeys: [],
  });
});

it("does not substitute a different model or insurer when the selected offer is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      page(
        [
          { ...offer, modelId: "other" },
          { ...offer, insurerId: 9 },
        ],
        null,
      ),
    ),
  );
  expect(
    await createHealthClient("http://localhost").modelOffer(input, offer.modelId, 8),
  ).toBeNull();
});

it("stops before a request when cancelled and rejects non-progressing pagination", async () => {
  const fetcher = vi.fn().mockResolvedValue(page([], 0));
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  controller.abort();
  const client = createHealthClient("http://localhost");
  await expect(client.modelOffer(input, offer.modelId, 8, controller.signal)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(client.modelOffer(input, offer.modelId, 8)).rejects.toThrow(
    "HEALTH_MODEL_LOOKUP_PAGINATION",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
