/** Local civil time shown by date/time controls, independent of the browser's time zone. */
export function formatZurichDateTime(iso: string, seconds = false) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" as const } : {}),
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}${seconds ? `:${part("second")}` : ""}`;
}
/** Refuse missing and ambiguous DST times; the user must choose an unambiguous deadline. */
export function parseZurichDateTime(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/u.test(value)) throw new Error("Invalid local time");
  const seconds = value.length === 19;
  const utc = (civil: string) => Date.parse(`${civil}${seconds ? "" : ":00"}Z`);
  const expected = utc(value);
  let instant = expected;
  for (let step = 0; step < 3; step++)
    instant += expected - utc(formatZurichDateTime(new Date(instant).toISOString(), seconds));
  const result = new Date(instant).toISOString();
  if (
    formatZurichDateTime(result, seconds) !== value ||
    [-3600000, 3600000].some(
      (delta) => formatZurichDateTime(new Date(instant + delta).toISOString(), seconds) === value,
    )
  )
    throw new Error("Invalid or ambiguous local time");
  return result;
}
