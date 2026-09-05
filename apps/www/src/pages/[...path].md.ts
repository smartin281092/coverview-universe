import type { APIRoute, GetStaticPaths } from "astro";
import { editorials, metadataMarkdown, type Editorial } from "../content/editorial";
import { editorialCopy as copy } from "../content/fr/editorial-interface";

export const getStaticPaths: GetStaticPaths = () =>
  editorials.map((entry) => ({
    params: { path: entry.data.slug },
    props: { entry },
  }));

export const GET: APIRoute = ({ props }) => {
  const { data, body } = (props as { entry: Editorial }).entry;
  const sources = data.sources
    .map((source) => `- [${source.label}](https://coverview.ch/sources#bible-v15)`)
    .join("\n");
  return new Response(
    `${metadataMarkdown(data)}\n\nURL canonique : https://coverview.ch/${data.slug}\n\n${body}\n\n${copy.sources}\n\n${sources}\n\n${copy.sourceNote}\n`,
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
};
