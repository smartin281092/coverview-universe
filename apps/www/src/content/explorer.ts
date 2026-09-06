import { acquisition as copy, journeys, plannedPages } from "./fr/acquisition";
import { content } from "./fr/interface";
import { readableEditorialPaths } from "./editorial";

const status = (slug: string) =>
  readableEditorialPaths.has(slug) && !["contact", "retire", "miles"].includes(slug)
    ? copy.readable
    : copy.coming;

export const explorerGroups = [
  {
    ...copy.explorer.sections.understand,
    label: copy.explorer.understand,
    links: [
      { href: "/", label: content.home, status: copy.readable },
      { href: "/overview", label: copy.overview, status: copy.readable },
      { href: "/methode", label: copy.method, status: copy.readable },
      { href: "/sebastien-martin", label: copy.founder, status: copy.readable },
      ...plannedPages.filter((page) => page.group === "understand").map((page) => ({
        href: `/${page.slug}`,
        label: page.label,
        status: status(page.slug),
      })),
      ...copy.editorialLinks.map((link) => ({ ...link, status: copy.readable })),
    ],
  },
  {
    ...copy.explorer.sections.tools,
    label: copy.explorer.tools,
    links: [
      ...journeys.map((page) => ({ href: `/${page.slug}`, label: page.label, status: copy.coming })),
      ...plannedPages.filter((page) => page.group === "tools").map((page) => ({
        href: `/${page.slug}`,
        label: page.label,
        status: copy.coming,
      })),
    ],
  },
  {
    ...copy.explorer.sections.spaces,
    label: copy.explorer.spaces,
    links: [
      { href: "/account", label: copy.explorer.wallet, status: copy.explorer.accountStatus },
      ...plannedPages.filter((page) => page.group === "spaces").map((page) => ({
        href: `/${page.slug}`,
        label: page.label,
        status: copy.coming,
      })),
    ],
  },
];
