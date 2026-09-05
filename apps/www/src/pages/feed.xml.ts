import type { APIRoute } from "astro";
import { discovery } from "../content/discovery";
export const GET: APIRoute = () =>
  new Response(discovery.feed, {
    headers: { "Content-Type": "application/rss+xml", "X-Robots-Tag": "noindex" },
  });
