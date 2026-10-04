import { useEffect, useMemo, useState } from "react";
import type {
  createHealthClient,
  HealthCurrentComparison,
  HealthCurrentSelection,
} from "@coverview/api-client/health-insurance";

export function useCurrentInsurance(
  api: ReturnType<typeof createHealthClient>,
  selection: HealthCurrentSelection | null,
  birthYear: number,
  offerIds: string[],
) {
  const serializedIds = JSON.stringify([...new Set(offerIds)].sort());
  const input = useMemo(
    () =>
      selection && {
        current: selection,
        birthYear,
        offerIds: JSON.parse(serializedIds) as string[],
      },
    [selection, birthYear, serializedIds],
  );
  const key = JSON.stringify(input);
  const [response, setResponse] = useState<{
    key: string;
    value: HealthCurrentComparison | null;
    error: boolean;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!input || input.birthYear > 2026) return;
    const abort = new AbortController();
    void api
      .currentCompare(input, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setResponse({ key, value, error: false });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResponse({ key, value: null, error: true });
      });
    return () => abort.abort();
  }, [api, input, key, retry]);
  const fresh = response?.key === key ? response : null;
  return {
    value: fresh?.value ?? null,
    error: fresh?.error ?? false,
    busy: !!selection && birthYear <= 2026 && !fresh,
    retry: () => {
      setResponse(null);
      setRetry((value) => value + 1);
    },
  };
}
