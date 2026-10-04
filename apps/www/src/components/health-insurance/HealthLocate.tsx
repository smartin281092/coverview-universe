import { useEffect, useRef, useState } from "react";
import type { createHealthClient, HealthLocality } from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthDialog } from "./HealthDialog";
import { HealthIcon } from "./HealthIcon";
import { regionName } from "./health-format";

export function HealthLocate({
  api,
  onSelect,
}: {
  api: ReturnType<typeof createHealthClient>;
  onSelect: (locality: HealthLocality) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [items, setItems] = useState<HealthLocality[]>([]);
  const pending = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      pending.current?.abort();
    },
    [],
  );
  const locate = () => {
    if (!navigator.geolocation) {
      setMessage(copy.locationUnsupported);
      return;
    }
    const current = ++generation.current;
    pending.current?.abort();
    const abort = new AbortController();
    pending.current = abort;
    setBusy(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (current !== generation.current) return;
        void api
          .locate(
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
            abort.signal,
          )
          .then((result) => {
            if (current === generation.current) {
              setItems(result.items);
              if (!result.items.length) setMessage(copy.locationFailed);
            }
          })
          .catch(() => {
            if (!abort.signal.aborted) setMessage(copy.locationFailed);
          })
          .finally(() => {
            if (current === generation.current) setBusy(false);
          });
      },
      (error) => {
        if (current === generation.current) {
          setBusy(false);
          setMessage(error.code === 1 ? copy.locationDenied : copy.locationFailed);
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  };
  return (
    <div className="hi-locate">
      <button
        type="button"
        className="hi-locate-button"
        aria-label={busy ? copy.locating : copy.locate}
        aria-busy={busy}
        disabled={busy}
        onClick={locate}
        title={copy.locationConsent}
      >
        <HealthIcon name="locate" size={22} />
      </button>
      {message && (
        <p className="hi-location-feedback" role="status">
          {message}
        </p>
      )}
      <HealthDialog open={!!items.length} title={copy.locationConfirm} onClose={() => setItems([])}>
        <p className="hi-small">{copy.locationHint}</p>
        <div className="hi-location-suggestions">
          {items.map((item) => (
            <button
              className="hi-secondary"
              key={item.id}
              onClick={() => {
                onSelect(item);
                setItems([]);
              }}
            >
              {item.postalCode} {item.locality} · {regionName(item.regionId)}
            </button>
          ))}
        </div>
      </HealthDialog>
    </div>
  );
}
