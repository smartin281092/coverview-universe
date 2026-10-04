/** Local civil time shown by date/time controls, independent of the browser's time zone. */
function zurichDateTime(iso: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
/** Refuse missing and ambiguous DST times; the user must choose an unambiguous deadline. */
export function parseZurichDateTime(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/u.test(value)) throw new Error("Invalid local time");
  const expected = Date.parse(`${value}:00Z`);
  let instant = expected;
  for (let step = 0; step < 3; step++)
    instant += expected - Date.parse(`${zurichDateTime(new Date(instant).toISOString())}:00Z`);
  const result = new Date(instant).toISOString();
  if (
    zurichDateTime(result) !== value ||
    [-3600000, 3600000].some(
      (delta) => zurichDateTime(new Date(instant + delta).toISOString()) === value,
    )
  )
    throw new Error("Invalid or ambiguous local time");
  return result;
}
