import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { LoadingState, EmptyState, ErrorState } from "./States";

/** Paginated, read-only presentation. Source authorization and version eligibility stay in the API. */
export function VersionHistoryDialog({
  title,
  description,
  labels,
  items,
  loading,
  error,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  onRetry,
  onClose,
  actions,
}: {
  title: string;
  description: string;
  labels: {
    close: string;
    loading: string;
    error: string;
    retry: string;
    empty: string;
    next: string;
    previous: string;
    details: string;
  };
  items: { id: string; title: string; caption: string; body: ReactNode }[];
  loading: boolean;
  error: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onRetry: () => void;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = items.find((item) => item.id === selected);
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
          closeLabel={labels.close}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {actions}
          {loading ? (
            <LoadingState label={labels.loading} />
          ) : error ? (
            <ErrorState
              title={labels.error}
              description={labels.error}
              retryLabel={labels.retry}
              pendingLabel={labels.loading}
              onRetry={onRetry}
            />
          ) : !items.length ? (
            <EmptyState title={labels.empty} description={description} />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.caption}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelected(item.id)}>
                    {labels.details}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between gap-3">
            <Button variant="outline" disabled={!hasPrevious || loading} onClick={onPrevious}>
              {labels.previous}
            </Button>
            <Button variant="outline" disabled={!hasNext || loading} onClick={onNext}>
              {labels.next}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!current && !error}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
          closeLabel={labels.close}
        >
          <DialogHeader>
            <DialogTitle>{current?.title}</DialogTitle>
            <DialogDescription>{current?.caption}</DialogDescription>
          </DialogHeader>
          {current?.body}
        </DialogContent>
      </Dialog>
    </>
  );
}
