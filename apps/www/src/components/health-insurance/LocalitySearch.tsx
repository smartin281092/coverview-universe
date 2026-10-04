import { useEffect, useId, useRef, useState } from "react";
import type { createHealthClient, HealthLocality } from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { regionName } from "./health-format";
export function LocalitySearch({
  api,
  selected,
  onSelect,
}: {
  api: Pick<ReturnType<typeof createHealthClient>, "localities">;
  selected: HealthLocality | null;
  onSelect: (value: HealthLocality | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<HealthLocality[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (query.trim().length < 2 || selected) {
      setItems([]);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setItems([]);
    setActive(0);
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      void api
        .localities(query, abort.signal)
        .then((data) => {
          if (!abort.signal.aborted) {
            setItems(data.items);
            setActive(0);
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) setError(true);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 220);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [api, query, selected]);
  useEffect(() => {
    const listener = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target)) setExpanded(false);
    };
    document.addEventListener("pointerdown", listener);
    return () => document.removeEventListener("pointerdown", listener);
  }, []);
  const choose = (item: HealthLocality) => {
    onSelect(item);
    setQuery("");
    setExpanded(false);
  };
  const value = selected
    ? selected.country && selected.country !== "CH"
      ? `${selected.locality} · ${copy.crossBorder}`
      : `${selected.postalCode} ${selected.locality} · ${selected.municipality}`
    : query;
  return (
    <div className="hi-search-wrap" ref={box}>
      <div className="hi-search-island">
        <HealthIcon name="pin" />
        <input
          aria-label={copy.searchLabel}
          placeholder={copy.searchPlaceholder}
          role="combobox"
          aria-expanded={expanded && !selected && query.length >= 2}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            expanded && !loading && !error && items[active] ? `${listId}-${active}` : undefined
          }
          value={value}
          onFocus={() => setExpanded(true)}
          onChange={(event) => {
            setItems([]);
            setActive(0);
            setLoading(event.target.value.trim().length >= 2);
            if (selected) onSelect(null);
            setQuery(event.target.value);
            setExpanded(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setExpanded(false);
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setExpanded(true);
              setActive((x) => Math.max(0, Math.min(items.length - 1, x + 1)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((x) => Math.max(0, x - 1));
            }
            if (event.key === "Enter" && expanded && !loading && !error && items[active]) {
              event.preventDefault();
              choose(items[active]);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            className="hi-icon-button"
            aria-label={copy.clearLocality}
            onClick={() => {
              onSelect(null);
              setQuery("");
              setItems([]);
            }}
          >
            <HealthIcon name="close" size={16} />
          </button>
        ) : (
          <span className="hi-search-key">
            <HealthIcon name="search" size={16} />
          </span>
        )}
      </div>
      {expanded && !selected && query.trim().length >= 2 && (
        <div className="hi-search-results">
          {loading ? (
            <p role="status">{copy.loading}</p>
          ) : error ? (
            <p role="alert">{copy.localityError}</p>
          ) : items.length === 0 ? (
            <p>{copy.noLocality}</p>
          ) : (
            <ul id={listId} role="listbox" aria-label={copy.searchLabel}>
              {items.map((item, index) => (
                <li
                  key={item.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={active === index}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(item)}
                  >
                    <span>
                      <strong>
                        {item.postalCode} {item.locality}
                      </strong>
                      <small>
                        {item.municipality} · {regionName(item.regionId)}
                      </small>
                    </span>
                    <HealthIcon name="arrow" size={17} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
