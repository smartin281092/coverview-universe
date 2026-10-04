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
  return new Response(
    `${metadataMarkdown(data)}\n\nURL canonique : https://coverview.ch/${data.slug}\n\n${body}\n\n${copy.sources}\n\n- [${copy.start}](https://coverview.ch/#comprendre)\n- [${copy.approach}](https://coverview.ch/sources)\n- [${copy.markdown}](https://coverview.ch/${data.slug}.md)\n`,
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
};
