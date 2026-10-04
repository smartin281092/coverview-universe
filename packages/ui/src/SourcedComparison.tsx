import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";

/** Presentation only: classifications, amounts and provenance are supplied by the API consumer. */
export function SourcedComparison({
  title,
  description,
  detailsLabel,
  closeLabel,
  currentLabel,
  proposedLabel,
  offers,
}: {
  title: string;
  description: string;
  detailsLabel: string;
  closeLabel: string;
  currentLabel: string;
  proposedLabel: string;
  offers: {
    id: string;
    title: string;
    summary: ReactNode;
    rows: { id: string; label: string; change: string; current: ReactNode; proposed: ReactNode }[];
  }[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const offer = offers.find((item) => item.id === selected);
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((item) => (
          <article key={item.id} className="space-y-3 rounded-xl border border-border p-4">
            <h4 className="font-medium">{item.title}</h4>
            {item.summary}
            <Button variant="outline" size="sm" onClick={() => setSelected(item.id)}>
              {detailsLabel}
            </Button>
          </article>
        ))}
      </div>
      <Dialog
        open={!!offer}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-5xl"
          closeLabel={closeLabel}
        >
          <DialogHeader>
            <DialogTitle>{offer?.title ?? title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {offer?.summary}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">{title}</th>
                  <th className="p-3">{currentLabel}</th>
                  <th className="p-3">{proposedLabel}</th>
                </tr>
              </thead>
              <tbody>
                {offer?.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <th className="min-w-32 p-3 font-medium">
                      {row.label}
                      <p className="mt-2 text-xs">{row.change}</p>
                    </th>
                    <td className="min-w-48 max-w-80 whitespace-pre-wrap break-words p-3">
                      {row.current}
                    </td>
                    <td className="min-w-48 max-w-80 whitespace-pre-wrap break-words p-3">
                      {row.proposed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
