import { useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@coverview/ui";

/** Shared Wallet primitive; keep the portal inside native modal dialogs. */
export function HealthSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div ref={host} className="hi-select-host">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="hi-select-trigger">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent portalContainer={host.current} position="popper">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
