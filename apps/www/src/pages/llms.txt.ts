import type { APIRoute } from "astro";
import { discovery } from "../content/discovery";
export const GET: APIRoute = () =>
  new Response(discovery.llms, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
