import raw from "../../assets/hyperion/logo.svg?raw";

// The Hyperion mark (assets/hyperion/README.md), inlined so that CSS colours it: black beside the
// title, white on the box of the illustration.
const viewBox = /viewBox="([^"]+)"/u.exec(raw)?.[1];
const d = /\sd="([^"]+)"/u.exec(raw)?.[1];
if (!viewBox || !d) throw new Error("HYPERION_LOGO_UNREADABLE");
export const hyperionLogo = { viewBox, d };
