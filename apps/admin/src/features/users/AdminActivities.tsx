import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, CheckSquare, FileText, Plus, Users } from "lucide-react";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import {
  clientActivityCreateInputSchema,
  type ClientActivity,
  type ClientActivityCreateInput,
} from "@coverview/contracts";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";
import { AdminClientActions } from "./AdminClientActions";

type Context = {
  identity: IdentityMe;
  userId: string;
  profileId: string;
  blocked: boolean;
  portalContainer: HTMLDivElement | null;
};
const kinds = ["task", "note", "event", "appointment"] as const;
const icons = { task: CheckSquare, note: FileText, event: Calendar, appointment: Users };
function localInstant(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function ActivityEditor({
  identity,
  userId,
  profileId,
  blocked,
  portalContainer,
  activity,
  onClose,
  onSaved,
}: Context & { activity: ClientActivity | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation("dossier");
  const [kind, setKind] = useState<ClientActivity["kind"]>(activity?.kind ?? "task");
  const [title, setTitle] = useState(activity?.title ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [state, setState] = useState<ClientActivity["state"]>(activity?.state ?? "open");
  const [start, setStart] = useState(localInstant(activity?.startsAt ?? null));
  const [end, setEnd] = useState(localInstant(activity?.endsAt ?? null));
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const command = useRef<{ signature: string; key: string } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const save = async () => {
    if (blocked || busy.current) return;
    const instant = (value: string) =>
      value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
    const parsed = clientActivityCreateInputSchema.safeParse({
      kind,
      title,
      description,
      state,
      startsAt: instant(start),
      endsAt: instant(end),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    const input: ClientActivityCreateInput = parsed.data;
    const signature = JSON.stringify(input);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    try {
      const options = {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      };
      if (activity)
        await api.updateAdminClientActivity(
          userId,
          profileId,
          activity.id,
          { ...input, revision: activity.revision },
          options,
        );
      else await api.createAdminClientActivity(userId, profileId, input, options);
      if (!active.signal.aborted) {
        onSaved();
        onClose();
      }
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      if (!active.signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const conflict = failure instanceof ApiError && failure.code === "CLIENT_ACTIVITY_CONFLICT";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        portalContainer={portalContainer}
        className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{t(activity ? "activities.edit" : "activities.create")}</DialogTitle>
          <DialogDescription>{t("activities.internal")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-kind">{t("activities.kind")}</Label>
              <Select
                value={kind}
                disabled={pending || blocked}
                onValueChange={(value) => {
                  const next = kinds.find((item) => item === value);
                  if (next) setKind(next);
                }}
              >
                <SelectTrigger id="activity-kind" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={portalContainer}>
                  {kinds.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`activities.kinds.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-state">{t("activities.state")}</Label>
              <Select
                value={state}
                disabled={pending || blocked}
                onValueChange={(value) => {
                  if (value === "open" || value === "completed" || value === "cancelled")
                    setState(value);
                }}
              >
                <SelectTrigger id="activity-state" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={portalContainer}>
                  {(["open", "completed", "cancelled"] as const).map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`activities.states.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-title">{t("activities.title")}</Label>
            <Input
              id="activity-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              disabled={pending || blocked}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-description">{t("activities.description")}</Label>
            <textarea
              id="activity-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={8000}
              rows={6}
              disabled={pending || blocked}
              className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-start">
                {t(kind === "task" ? "activities.due" : "activities.start")}
              </Label>
              <Input
                id="activity-start"
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required={kind === "event" || kind === "appointment"}
                disabled={pending || blocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-end">{t("activities.end")}</Label>
              <Input
                id="activity-end"
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                disabled={pending || blocked}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("activities.timezone", {
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })}
          </p>
          {invalid && (
            <p role="alert" className="text-sm text-destructive">
              {t("activities.invalid")}
            </p>
          )}
          {conflict ? (
            <p role="alert" className="text-sm text-destructive">
              {t("activities.conflict")}
            </p>
          ) : failure ? (
            <AdminFailure error={failure} onRetry={() => void save()} />
          ) : null}
          <DialogFooter>
            <Button variant="outline" type="button" disabled={pending} onClick={onClose}>
              {t("close")}
            </Button>
            <Button type="submit" disabled={pending || blocked || conflict}>
              {t(pending ? "saving" : "save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminActivities(context: Context) {
  const { identity, userId, profileId, blocked } = context;
  const { t, i18n } = useTranslation("dossier");
  const client = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();
  const [editing, setEditing] = useState<ClientActivity | null | undefined>();
  const key = [
    "private",
    identity.user.id,
    identity.session.id,
    "admin-user",
    userId,
    "activities",
    profileId,
  ];
  const query = useQuery({
    queryKey: [...key, cursor],
    queryFn: ({ signal }) =>
      api.adminClientActivities(userId, profileId, cursor ? { cursor } : {}, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (current) => (current.state.error ? false : 15000),
  });
  useEffect(() => {
    if (blocked) setEditing(undefined);
  }, [blocked]);
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{t("activities.heading")}</h2>
          <Button disabled={blocked} onClick={() => setEditing(null)}>
            <Plus className="size-4" aria-hidden="true" />
            {t("activities.create")}
          </Button>
        </div>
        {query.isError ? (
          <AdminFailure error={query.error} onRetry={() => void query.refetch()} />
        ) : !query.data ? (
          <LoadingState label={t("loading")} />
        ) : (
          <>
            {!query.data.activities.length ? (
              <EmptyState
                title={t("activities.empty")}
                description={t("activities.emptyDescription")}
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {query.data.activities.map((activity) => {
                  const Icon = icons[activity.kind];
                  return (
                    <li key={activity.id}>
                      <button
                        type="button"
                        className="flex h-full w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        disabled={blocked}
                        onClick={() => setEditing(activity)}
                      >
                        <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 space-y-2">
                          <span className="block break-words font-medium">{activity.title}</span>
                          <span className="flex flex-wrap gap-2">
                            <Badge variant="secondary">
                              {t(`activities.kinds.${activity.kind}`)}
                            </Badge>
                            <Badge variant="outline">
                              {t(`activities.states.${activity.state}`)}
                            </Badge>
                          </span>
                          {activity.startsAt && (
                            <span className="block text-sm text-muted-foreground">
                              {date.format(new Date(activity.startsAt))}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {(cursor || query.data.nextCursor) && (
              <nav className="flex justify-end gap-3" aria-label={t("pagination")}>
                <Button variant="outline" disabled={!cursor} onClick={() => setCursor(undefined)}>
                  {t("firstPage")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!query.data.nextCursor}
                  onClick={() => setCursor(query.data?.nextCursor ?? undefined)}
                >
                  {t("nextPage")}
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
      <AdminClientActions {...context} />
      {editing !== undefined && !blocked && (
        <ActivityEditor
          {...context}
          activity={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setCursor(undefined);
            void client.invalidateQueries({ queryKey: key });
          }}
        />
      )}
    </div>
  );
}
