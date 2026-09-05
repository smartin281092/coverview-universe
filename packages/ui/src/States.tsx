import type { ReactNode } from "react";
import { AlertCircle, FolderOpen, LockKeyhole, SearchX } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

type StateProps = { title: string; description: string; action?: ReactNode };

function StatePanel({ title, description, action, icon }: StateProps & { icon: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center sm:p-12">
      <div className="rounded-xl bg-accent p-4 text-primary" aria-hidden="true">
        {icon}
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-3 rounded-xl border border-border bg-card p-6"
    >
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StatePanel {...props} icon={<FolderOpen className="size-6" />} />;
}

export function ErrorState({
  title,
  description,
  retryLabel,
  pendingLabel,
  onRetry,
  isPending = false,
}: Omit<StateProps, "action"> & {
  retryLabel: string;
  pendingLabel: string;
  onRetry: () => void;
  isPending?: boolean;
}) {
  return (
    <section role="alert">
      <StatePanel
        title={title}
        description={description}
        icon={<AlertCircle className="size-6" />}
        action={
          <Button onClick={onRetry} disabled={isPending}>
            {isPending ? pendingLabel : retryLabel}
          </Button>
        }
      />
    </section>
  );
}

export function AccessDeniedState(props: StateProps) {
  return <StatePanel {...props} icon={<LockKeyhole className="size-6" />} />;
}

export function NotFoundState(props: StateProps) {
  return <StatePanel {...props} icon={<SearchX className="size-6" />} />;
}

export function SessionExpiredState(props: StateProps) {
  return <StatePanel {...props} icon={<LockKeyhole className="size-6" />} />;
}
