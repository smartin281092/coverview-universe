/** Presentation only: the consumer supplies translated labels and server-derived values. */
export function AdvisorProfileCard({
  name,
  organization,
  presentation,
  facts,
  rating,
  ratingDetail,
  photoUrl = null,
  photoAlt = "",
  organizationProfile = null,
}: {
  name: string;
  organization: string;
  presentation: string;
  facts: { label: string; value: string }[];
  rating: string;
  ratingDetail: string;
  /** Object URL of the published photo, already fetched by the consumer. */
  photoUrl?: string | null;
  photoAlt?: string;
  /** The published profile of the organisation, with its logo and a translated heading. */
  organizationProfile?: {
    heading: string;
    presentation: string;
    logoUrl: string | null;
    logoAlt: string;
  } | null;
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
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={photoAlt}
            className="size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold"
          >
            {initials}
          </span>
        )}
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
      {organizationProfile && (
        <section className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <div className="flex items-center gap-3">
            {organizationProfile.logoUrl && (
              <img
                src={organizationProfile.logoUrl}
                alt={organizationProfile.logoAlt}
                className="h-8 w-auto max-w-24 object-contain"
              />
            )}
            <p className="font-medium">{organizationProfile.heading}</p>
          </div>
          <p className="whitespace-pre-wrap break-words text-muted-foreground">
            {organizationProfile.presentation}
          </p>
        </section>
      )}
    </article>
  );
}
