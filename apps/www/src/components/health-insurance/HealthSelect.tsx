import { useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@coverview/ui";

/**
 * Shared Wallet primitive; keep the portal inside native modal dialogs. The host is held in
 * state: a ref read during render is still null on first render, and the list then opened in
 * the body, behind the modal dialog (top layer, rest of the page inert).
 */
export function HealthSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // An option with an icon shows the icon alone; its label stays for screen readers and as a
  // tooltip.
  options: { value: string; label: string; icon?: ReactNode }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setHost} className="hi-select-host">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={label} className="hi-select-trigger">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent portalContainer={host} position="popper">
          {options.map((option) =>
            option.icon ? (
              <SelectItem
                key={option.value}
                value={option.value}
                title={option.label}
                className="hi-select-icon-item"
              >
                {option.icon}
                <span className="hi-sr-only">{option.label}</span>
              </SelectItem>
            ) : (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
