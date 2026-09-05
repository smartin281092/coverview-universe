/** Deterministic local examples. These are not authentication accounts or product roles. */
export const personas = [
  {
    id: "fixture_alpine",
    email: "alpine@coverview.test",
    org: "Espace fictif Alpin",
    role: "preview",
    state: "fixture",
    tests: ["empty-shell", "local-persona-selection"],
    access: "local-selector",
  },
  {
    id: "fixture_lake",
    email: "lake@coverview.test",
    org: "Espace fictif Lac",
    role: "preview",
    state: "fixture",
    tests: ["independent-fixture", "empty-shell"],
    access: "local-selector",
  },
];
