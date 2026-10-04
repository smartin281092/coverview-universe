/** Presentation only: the consumer supplies translated labels and server-derived values. */
export function AdvisorProfileCard({
  name,
  organization,
  presentation,
  facts,
  rating,
  ratingDetail,
}: {
  name: string;
  organization: string;
  presentation: string;
  facts: { label: string; value: string }[];
  rating: string;
  ratingDetail: string;
}) {
  const initials = name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return (
    <article className="space-y-4">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{organization}</p>
        </div>
      </header>
      <p className="whitespace-pre-wrap break-words text-sm">{presentation}</p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="break-words font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p className="font-medium">{rating}</p>
        <p className="mt-1 text-muted-foreground">{ratingDetail}</p>
      </div>
    </article>
  );
}
