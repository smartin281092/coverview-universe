import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./Dialog";

// "details" replaces "cells" in the full view (sources, pages), when given.
type Row = { id: string; label: ReactNode; cells: ReactNode[]; details?: ReactNode[] };

function Matrix({
  criterionLabel,
  columns,
  rows,
}: {
  criterionLabel: string;
  columns: { id: string; title: ReactNode; subtitle?: ReactNode }[];
  rows: Row[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="p-4">
              {criterionLabel}
            </th>
            {columns.map((column) => (
              <th key={column.id} scope="col" className="max-w-72 p-4 align-top">
                <p>{column.title}</p>
                {column.subtitle && (
                  <p className="mt-1 font-normal text-muted-foreground">{column.subtitle}</p>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border align-top">
              <th scope="row" className="max-w-52 p-4 font-medium">
                {row.label}
              </th>
              {row.cells.map((cell, index) => (
                <td key={columns[index]?.id ?? index} className="max-w-80 break-words p-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Presentation only: columns, rows, classifications and wording come from the API consumer.
 * The synthetic view shows the summary rows and the rows that matter; the dialog shows them all.
 */
export function ComparisonMatrix({
  title,
  description,
  criterionLabel,
  detailsLabel,
  closeLabel,
  columns,
  summary,
  rows,
  primary,
  syntheticCount = 6,
}: {
  title: string;
  description: string;
  criterionLabel: string;
  detailsLabel: string;
  closeLabel: string;
  columns: { id: string; title: ReactNode; subtitle?: ReactNode }[];
  summary: Row[];
  rows: Row[];
  primary: string[];
  syntheticCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const important = rows.filter((row) => primary.includes(row.id));
  const synthetic = (important.length ? important : rows).slice(0, syntheticCount);
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Matrix criterionLabel={criterionLabel} columns={columns} rows={[...summary, ...synthetic]} />
      {/* The full view also carries each value's source, even when every row is shown. */}
      {rows.length > 0 && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {detailsLabel}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-6xl"
          closeLabel={closeLabel}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Matrix
            criterionLabel={criterionLabel}
            columns={columns}
            rows={[...summary, ...rows].map((row) => ({ ...row, cells: row.details ?? row.cells }))}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
