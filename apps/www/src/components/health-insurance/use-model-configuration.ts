import { useEffect, useRef, useState } from "react";
import type {
  createHealthClient,
  HealthCompareInput,
  HealthLocality,
  HealthOffer,
} from "@coverview/api-client/health-insurance";

type Configuration = Pick<HealthOffer, "regionId" | "deductible" | "accident">;

export function useModelConfiguration(
  api: ReturnType<typeof createHealthClient>,
  offer: HealthOffer,
  profile: HealthCompareInput,
  locality: HealthLocality | null,
  onConfigured: (offer: HealthOffer) => void,
) {
  const [draft, setDraft] = useState<Configuration>({
    regionId: offer.regionId,
    deductible: offer.deductible,
    accident: offer.accident,
  });
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<"unavailable" | "failed" | null>(null);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      pending.current?.abort();
    },
    [],
  );

  const change = (patch: Partial<Configuration>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setIssue(null);
    setBusy(true);
    pending.current?.abort();
    const abort = new AbortController();
    pending.current = abort;
    const version = ++generation.current;
    void api
      .modelOffer(
        {
          ...profile,
          ...next,
          municipalityId:
            locality?.regionId === next.regionId
              ? (locality.municipalityId ?? undefined)
              : undefined,
        },
        offer.modelId,
        offer.insurerId,
        abort.signal,
      )
      .then((value) => {
        if (abort.signal.aborted || version !== generation.current) return;
        setBusy(false);
        if (value) onConfigured(value);
        else setIssue("unavailable");
      })
      .catch(() => {
        if (abort.signal.aborted || version !== generation.current) return;
        setBusy(false);
        setIssue("failed");
      });
  };

  return {
    draft,
    change,
    busy,
    issue,
    ready:
      !busy &&
      !issue &&
      draft.regionId === offer.regionId &&
      draft.deductible === offer.deductible &&
      draft.accident === offer.accident,
  };
}
