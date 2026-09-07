import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function DocumentLoadingMessage({
  phase,
  confirmedAt,
  connectionPaused = false,
}: {
  phase: "preparing" | "uploading" | "queued" | "scanning" | "reading";
  confirmedAt?: number;
  connectionPaused?: boolean;
}) {
  const { t } = useTranslation("documents");
  const [clock, setClock] = useState(() => ({ step: 0, now: Date.now() }));
  useEffect(() => {
    const timer = setInterval(() => {
      setClock(({ step }) => ({ step: (step + 1) % 3, now: Date.now() }));
    }, 8000);
    return () => clearInterval(timer);
  }, []);
  // A stale server response must not turn into an endless claim of live activity.
  const awaitingStatus =
    connectionPaused || (confirmedAt !== undefined && clock.now - confirmedAt > 20000);
  const message = awaitingStatus
    ? "loadingMessages.awaitingStatus"
    : clock.step === 2
      ? "loadingMessages.noRefresh"
      : `loadingMessages.${phase}.${clock.step === 0 ? "initial" : "long"}`;
  return (
    <p className="min-h-10 max-w-xl text-sm text-muted-foreground" role="status" aria-atomic="true">
      {t(message)}
    </p>
  );
}
