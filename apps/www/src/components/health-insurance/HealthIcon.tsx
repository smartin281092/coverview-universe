export function HealthIcon({
  name,
  size = 20,
}: {
  name:
    | "arrow"
    | "search"
    | "pin"
    | "close"
    | "sliders"
    | "shield"
    | "spark"
    | "question"
    | "pencil"
    | "check"
    | "bag"
    | "plus"
    | "minus"
    | "chevron";
  size?: number;
}) {
  const paths = {
    arrow: "M4 12h16m-6-6 6 6-6 6",
    search: "m16 16 5 5M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    close: "m6 6 12 12M6 18 18 6",
    sliders: "M4 7h5m5 0h6M4 17h10m5 0h1M9 4v6m5 4v6",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
    question:
      "M12 17h.01M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    pencil: "m4 16-1 5 5-1L21 7l-4-4L4 16Zm10-10 4 4",
    check: "m5 12 4 4L19 6",
    bag: "M5 7h14l1 14H4L5 7Zm3 1V6a4 4 0 0 1 8 0v2",
    plus: "M5 12h14M12 5v14",
    minus: "M5 12h14",
    chevron: "m9 5 7 7-7 7",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
