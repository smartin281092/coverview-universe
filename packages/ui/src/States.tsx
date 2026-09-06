import type { ReactNode } from "react";
import { AlertCircle, FolderOpen, LockKeyhole, SearchX } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

type StateProps = { title: string; description: string; action?: ReactNode };

function StateContent({ title, description, action, icon }: StateProps & { icon: ReactNode }) {
  return (
    <div className="cv-state">
      <div className="cv-state__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="cv-state__title">{title}</h2>
      <p className="cv-state__description">{description}</p>
      {action && <div className="cv-state__action">{action}</div>}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="cv-loading">
      <span className="cv-visually-hidden">{label}</span>
      <Skeleton className="cv-loading__title" />
      <Skeleton />
      <Skeleton className="cv-loading__last" />
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateContent {...props} icon={<FolderOpen />} />;
}

export function ErrorState({
  retryLabel,
  pendingLabel,
  onRetry,
  isPending = false,
  ...props
}: Omit<StateProps, "action"> & {
  retryLabel: string;
  pendingLabel: string;
  onRetry: () => void;
  isPending?: boolean;
}) {
  return (
    <section role="alert">
      <StateContent
        {...props}
        icon={<AlertCircle />}
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
  return <StateContent {...props} icon={<LockKeyhole />} />;
}
export function NotFoundState(props: StateProps) {
  return <StateContent {...props} icon={<SearchX />} />;
}
export function SessionExpiredState(props: StateProps) {
  return <StateContent {...props} icon={<LockKeyhole />} />;
}
