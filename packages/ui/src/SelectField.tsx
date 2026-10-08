import * as React from "react";
import { cn } from "cn";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./Select";

export type SelectFieldOption = { value: string; label: string; disabled?: boolean | undefined };
export type SelectFieldGroup = { label: string; options: SelectFieldOption[] };

// Radix reserves the empty value for "nothing chosen": an explicit empty choice ("any",
// "unknown") travels under this stand-in and comes back as an empty string.
const empty = "__empty__";
const inner = (value: string) => (value === "" ? empty : value);
const outer = (value: string) => (value === empty ? "" : value);

/**
 * The menus' select for forms and dialogs: a controlled or uncontrolled value, an optional
 * empty choice, option groups, and a hidden input carrying `name` for native form data.
 */
export function SelectField({
  id,
  name,
  value,
  defaultValue = "",
  onValueChange,
  options,
  placeholder,
  disabled,
  required,
  autoFocus,
  className,
  portalContainer,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  "aria-label": label,
}: {
  id?: string | undefined;
  name?: string | undefined;
  value?: string | undefined;
  defaultValue?: string;
  onValueChange?: ((value: string) => void) | undefined;
  options: (SelectFieldOption | SelectFieldGroup)[];
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  autoFocus?: boolean | undefined;
  className?: string | undefined;
  portalContainer?: React.ComponentProps<typeof SelectContent>["portalContainer"] | undefined;
  "aria-invalid"?: boolean | undefined;
  "aria-describedby"?: string | undefined;
  "aria-label"?: string | undefined;
}) {
  const [own, setOwn] = React.useState(defaultValue);
  const current = value ?? own;
  const flat = options.flatMap((item) => ("options" in item ? item.options : [item]));
  const hasEmpty = flat.some((option) => option.value === "");
  const item = (option: SelectFieldOption) => (
    <SelectItem
      key={inner(option.value)}
      value={inner(option.value)}
      disabled={option.disabled ?? false}
    >
      {option.label}
    </SelectItem>
  );
  return (
    <>
      <Select
        value={current === "" && !hasEmpty ? "" : inner(current)}
        onValueChange={(next) => {
          const result = outer(next);
          if (value === undefined) setOwn(result);
          onValueChange?.(result);
        }}
        disabled={disabled ?? false}
      >
        <SelectTrigger
          id={id}
          autoFocus={autoFocus}
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-required={required}
          className={cn("min-h-11 w-full min-w-0 text-sm", className)}
        >
          <SelectValue className="min-w-0 flex-1 truncate" placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent portalContainer={portalContainer}>
          {options.map((entry) =>
            "options" in entry ? (
              <SelectGroup key={entry.label}>
                <SelectLabel>{entry.label}</SelectLabel>
                {entry.options.map(item)}
              </SelectGroup>
            ) : (
              item(entry)
            ),
          )}
        </SelectContent>
      </Select>
      {name !== undefined && <input type="hidden" name={name} value={current} />}
    </>
  );
}
