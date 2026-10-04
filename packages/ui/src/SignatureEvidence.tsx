import type { ReactNode } from "react";
export function SignatureEvidence({
  title,
  caption,
  facts,
  drawing,
  drawingLabel,
  children,
}: {
  title: string;
  caption: string;
  facts: { label: string; value: string }[];
  drawing?: [number, number][][];
  drawingLabel: string;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
      {drawing && (
        <svg
          viewBox="0 0 600 200"
          role="img"
          aria-label={drawingLabel}
          className="w-full rounded-lg border border-border bg-background text-foreground"
        >
          {drawing.map((stroke, i) => (
            <polyline
              key={i}
              points={stroke.map(([x, y]) => `${x * 600},${y * 200}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}
      {children}
    </section>
  );
}
