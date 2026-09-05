import type { APIRoute } from "astro";
import { discovery } from "../content/discovery";
export const GET: APIRoute = () =>
  new Response(discovery.sitemap, {
    headers: { "Content-Type": "application/xml", "X-Robots-Tag": "noindex" },
  });
