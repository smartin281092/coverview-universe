/**
 * One list, newest first, from sources paginated separately but each ordered by the same date.
 * An item older than the oldest loaded item of a source with more pages could still be preceded
 * by one of that source's unloaded items: it waits for the next page.
 */
export function timeline<T extends { at: number }>(sources: { items: T[]; more: boolean }[]) {
  const floors = sources
    .filter((source) => source.more && source.items.length)
    .map((source) => Math.min(...source.items.map((item) => item.at)));
  const floor = floors.length ? Math.max(...floors) : -Infinity;
  return {
    items: sources
      .flatMap((source) => source.items)
      .filter((item) => item.at >= floor)
      .sort((a, b) => b.at - a.at),
    more: sources.some((source) => source.more),
  };
}
