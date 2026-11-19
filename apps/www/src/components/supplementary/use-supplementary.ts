import { useEffect, useMemo, useState } from "react";
import {
  createSupplementaryClient,
  supplementaryCantons,
  type SupplementaryCatalog,
  type SupplementaryQuote,
} from "@coverview/api-client/supplementary-insurance";
import {
  compareKey,
  effectiveProfile,
  indexCatalog,
  maxCompared,
  priceSummary,
  profileKey,
  readSession,
  writeSession,
  type PriceSummary,
  type Profile,
} from "./supplementary-model";

export type SupplementaryApi = ReturnType<typeof createSupplementaryClient>;

// The catalogue, loaded once (the server versions it with an ETag), with a retry.
export function useCatalog(api: SupplementaryApi) {
  const [catalog, setCatalog] = useState<SupplementaryCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setFailed(false);
    api
      .catalog(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setCatalog(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => abort.abort();
  }, [api, attempt]);
  const index = useMemo(() => (catalog ? indexCatalog(catalog) : null), [catalog]);
  return { index, failed, retry: () => setAttempt((value) => value + 1) };
}

// The profile's premiums, recalculated by the server at each change; the previous prices stay
// on screen while the next ones load.
export function useQuote(api: SupplementaryApi, profile: Profile, enabled: boolean) {
  const [quote, setQuote] = useState<SupplementaryQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const input = effectiveProfile(profile);
  const signature = JSON.stringify(input);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    setBusy(true);
    setFailed(false);
    const timer = setTimeout(() => {
      api
        .quote(JSON.parse(signature) as typeof input, abort.signal)
        .then((value) => {
          if (!abort.signal.aborted) setQuote(value);
        })
        .catch(() => {
          if (!abort.signal.aborted) setFailed(true);
        })
        .finally(() => {
          if (!abort.signal.aborted) setBusy(false);
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [api, signature, enabled, attempt]);
  const rows = useMemo(() => {
    const map = new Map<string, SupplementaryQuote["prices"]>();
    for (const price of quote?.prices ?? [])
      map.set(price.productKey, [...(map.get(price.productKey) ?? []), price]);
    return map;
  }, [quote]);
  return { quote, rows, busy, failed, retry: () => setAttempt((value) => value + 1) };
}

export function usePriceSummaries(
  index: ReturnType<typeof useCatalog>["index"],
  rows: ReturnType<typeof useQuote>["rows"],
) {
  return useMemo(() => {
    const map = new Map<string, PriceSummary>();
    for (const product of index?.catalog.products ?? [])
      map.set(product.key, priceSummary(product, rows.get(product.key)));
    return map;
  }, [index, rows]);
}

const isProfile = (value: unknown): Profile | null => {
  if (!value || typeof value !== "object") return null;
  const { birthYear, sex, canton } = value as Record<string, unknown>;
  return {
    birthYear:
      typeof birthYear === "number" &&
      Number.isInteger(birthYear) &&
      birthYear >= 1900 &&
      birthYear <= 2026
        ? birthYear
        : null,
    sex: sex === "female" || sex === "male" ? sex : null,
    canton: supplementaryCantons.find((item) => item === canton) ?? null,
  };
};
// The profile is shared by the list and the comparison for the tab's lifetime.
export function useProfile() {
  const [profile, setProfile] = useState<Profile>({ birthYear: null, sex: null, canton: null });
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const saved = readSession(profileKey, isProfile);
    if (saved) setProfile(saved);
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) writeSession(profileKey, profile);
  }, [profile, restored]);
  return { profile, setProfile, restored };
}

const isKeys = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, maxCompared)
    : null;
// Products to compare: the comparison's URL first, else the tab's choice.
export function useCompareSelection(fromUrl: boolean) {
  const [keys, setKeys] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const param = fromUrl ? new URL(window.location.href).searchParams.get("produits") : null;
    const fromAddress = param
      ? [
          ...new Set(
            param
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ].slice(0, maxCompared)
      : null;
    setKeys(fromAddress ?? readSession(compareKey, isKeys) ?? []);
    setRestored(true);
  }, [fromUrl]);
  useEffect(() => {
    if (restored) writeSession(compareKey, keys);
  }, [keys, restored]);
  return { keys, setKeys, restored };
}
