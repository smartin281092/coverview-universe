import { Badge } from "./Badge";
import { Button } from "./Button";

// Presentation shared by Partner and Wallet. Permissions, fetching and actions stay in each app.
export function NotificationList({
  items,
  pending,
  onRead,
}: {
  items: {
    id: string;
    title: string;
    kind: string;
    date: string;
    due: string | null;
    responsible: string;
    priority: string;
    unread: boolean;
    status: string;
    href: string;
    openLabel: string;
    readLabel: string;
  }[];
  pending: boolean;
  onRead: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-5 py-5">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.priority}</Badge>
              <span className="text-xs text-muted-foreground">{item.status}</span>
            </div>
            <h2
              className={`break-words text-base ${item.unread ? "font-semibold" : "font-medium"}`}
            >
              {item.kind}
            </h2>
            <p className="break-words text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {item.date}
              {item.responsible && ` · ${item.responsible}`}
            </p>
            {item.due && <p className="text-sm text-muted-foreground">{item.due}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <a href={item.href}>{item.openLabel}</a>
            </Button>
            {item.unread && (
              <Button variant="ghost" disabled={pending} onClick={() => onRead(item.id)}>
                {item.readLabel}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
