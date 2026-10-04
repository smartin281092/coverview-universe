import type { ReactNode } from "react";

/** Presentation only: amounts, eligibility and review outcomes are supplied by the server consumer. */
export function PolicyEvidence({
  status,
  notice,
  facts,
  calculation,
  checks,
  children,
}: {
  status: string;
  notice: string;
  calculation: string;
  facts: { label: string; value: string }[];
  checks: { label: string; result: string; note: string; citations: string[] }[];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <p className="font-medium">{status}</p>
      <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{notice}</p>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="break-words font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">{calculation}</p>
      <ul className="divide-y divide-border">
        {checks.map((check) => (
          <li key={check.label} className="space-y-2 py-4 text-sm">
            <p className="font-medium">{check.label}</p>
            <p>{check.result}</p>
            <p className="whitespace-pre-wrap break-words">{check.note}</p>
            {check.citations.map((citation, index) => (
              <blockquote
                key={index}
                className="whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-muted-foreground"
              >
                {citation}
              </blockquote>
            ))}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
