import type { ComponentProps } from "react";
import { cn } from "cn";

export function TextLink({
  children,
  arrow = "right",
  className,
  ...props
}: ComponentProps<"a"> & { arrow?: "right" | "up" | false }) {
  return (
    <a className={cn("cv-text-link", className)} {...props}>
      {children}
      {arrow && (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d={arrow === "up" ? "M4 12 12 4M4 4h8v8" : "M3 8h10M8 3l5 5-5 5"}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </a>
  );
}
