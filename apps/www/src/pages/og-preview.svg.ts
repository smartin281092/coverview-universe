import { socialSvg } from "../content/social";

export function GET() {
  return new Response(socialSvg(), { headers: { "Content-Type": "image/svg+xml" } });
}
