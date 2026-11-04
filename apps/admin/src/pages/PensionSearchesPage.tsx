import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  PensionSearchApiError,
  pensionSearchStages,
  type PensionSearch,
  type PensionSearchState,
} from "@coverview/api-client/pension-searches";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  RequestProgress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@coverview/ui";
import { pensionApi } from "../pension-api";
import { AdminBoundary } from "../features/users/AdminBoundary";

const date = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );
const stageIndex = (state: string) => (pensionSearchStages as readonly string[]).indexOf(state);

// LPP searches ordered from the public site (4 November 2026): the team records each step really
// done, one at a time, with MFA; the client sees it in Wallet.
function Searches({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("pensionSearches");
  const client = useQueryClient();
  const [state, setState] = useState("all");
  const [cursor, setCursor] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const keys = useRef(new Map<string, string>());
  const abort = useRef(new AbortController());
  useEffect(() => {
    const active = new AbortController();
    abort.current = active;
    return () => active.abort();
  }, []);
  const root = ["private", identity.user.id, identity.session.id, "pension-searches"];
  const list = useQuery({
    queryKey: [...root, state, cursor],
    queryFn: ({ signal }) =>
      pensionApi.list(
        {
          ...(state === "all" ? {} : { state: state as PensionSearchState }),
          ...(cursor ? { cursor } : {}),
        },
        signal,
        true,
      ),
    enabled: !blocked,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => (query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  const detail = useQuery({
    queryKey: [...root, "detail", selected],
    queryFn: ({ signal }) => pensionApi.get(selected!, signal, true),
    enabled: !!selected && !blocked,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => (pending || query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  async function transition(search: PensionSearch, next: Exclude<PensionSearchState, "submitted">) {
    setPending(true);
    setError("");
    const operation = `${search.id}:${search.revision}:${next}`;
    const key = keys.current.get(operation) ?? crypto.randomUUID();
    keys.current.set(operation, key);
    try {
      await pensionApi.transition(
        search.id,
        { state: next, revision: search.revision },
        { csrfToken: identity.csrfToken, idempotencyKey: key, signal: abort.current.signal },
      );
      await client.invalidateQueries({ queryKey: root });
    } catch (cause) {
      setError(
        cause instanceof PensionSearchApiError && cause.status === 409
          ? t("conflict")
          : t("transitionError"),
      );
    } finally {
      setPending(false);
    }
  }
  const search = detail.data;
  const next = search ? pensionSearchStages[stageIndex(search.state) + 1] : undefined;
  return (
    <div ref={setPortal} className="space-y-8">
      <header>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      <Select
        value={state}
        onValueChange={(value) => {
          setState(value);
          setCursor(undefined);
        }}
      >
        <SelectTrigger className="min-h-11" aria-label={t("filter")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent portalContainer={portal}>
          <SelectItem value="all">{t("all")}</SelectItem>
          {[...pensionSearchStages, "cancelled"].map((value) => (
            <SelectItem key={value} value={value}>
              {t(`states.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {list.isPending ? (
        <LoadingState label={t("loading")} />
      ) : list.isError ? (
        <ErrorState
          title={t("error")}
          description=""
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.searches.length ? (
        <ul className="divide-y divide-border">
          {list.data.searches.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <p className="font-medium">
                  {item.details.firstName} {item.details.lastName}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("line", {
                    email: item.email,
                    state: t(`states.${item.state}`),
                    date: date(item.createdAt),
                  })}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={blocked || pending}
                onClick={() => {
                  setSelected(item.id);
                  setError("");
                }}
              >
                {t("details")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("empty")} description="" />
      )}
      {(cursor || list.data?.nextCursor) && (
        <nav className="flex gap-3">
          <Button
            variant="outline"
            disabled={!cursor || list.isFetching}
            onClick={() => setCursor(undefined)}
          >
            {t("previous")}
          </Button>
          <Button
            disabled={!list.data?.nextCursor || list.isFetching}
            onClick={() => setCursor(list.data?.nextCursor ?? undefined)}
          >
            {t("next")}
          </Button>
        </nav>
      )}
      <Sheet
        open={!!selected && !blocked}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <SheetContent
          portalContainer={portal}
          className="overflow-y-auto sm:max-w-xl"
          closeLabel={t("back")}
        >
          <SheetHeader>
            <SheetTitle>{t("details")}</SheetTitle>
            <SheetDescription>{selected}</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 p-6">
            {detail.isPending ? (
              <LoadingState label={t("loading")} />
            ) : detail.isError || !search ? (
              <ErrorState
                title={t("error")}
                description=""
                retryLabel={t("retry")}
                pendingLabel={t("loading")}
                onRetry={() => void detail.refetch()}
              />
            ) : (
              <>
                <RequestProgress
                  current={Math.max(0, ...search.history.map((event) => stageIndex(event.state)))}
                  cancelled={search.state === "cancelled"}
                  complete={search.state === "completed"}
                  steps={pensionSearchStages.map((value) => ({
                    label: t(`states.${value}`),
                    description: t(`descriptions.${value}`),
                    at: search.history.find((event) => event.state === value)?.at,
                  }))}
                />
                <dl className="space-y-5 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">{t("identity")}</dt>
                    <dd className="font-medium">
                      {search.details.firstName} {search.details.lastName}
                    </dd>
                    {search.details.previousNames && (
                      <dd>{t("previousNames", { value: search.details.previousNames })}</dd>
                    )}
                    <dd>
                      {t("born", {
                        date: search.details.birthDate.split("-").reverse().join("."),
                        sex: t(`sex.${search.details.sex}`),
                        nationality: search.details.nationality,
                      })}
                    </dd>
                    <dd>{t("avs", { value: search.details.avsNumber })}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">{t("address")}</dt>
                    <dd>{search.details.street}</dd>
                    <dd>
                      {t("locality", {
                        postalCode: search.details.postalCode,
                        city: search.details.city,
                        country: search.details.country,
                      })}
                    </dd>
                    <dd className="break-all">{search.email}</dd>
                    {search.details.phone && <dd>{search.details.phone}</dd>}
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">{t("path")}</dt>
                    <dd>{t(`situations.${search.details.situation}`)}</dd>
                    {search.details.employers.length ? (
                      search.details.employers.map((employer, index) => (
                        <dd key={index}>
                          {[
                            employer.name,
                            employer.city,
                            [employer.fromYear, employer.toYear].filter(Boolean).join(" – "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </dd>
                      ))
                    ) : (
                      <dd className="text-muted-foreground">{t("noEmployer")}</dd>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("mandate", { version: search.mandateVersion })}
                  </p>
                </dl>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {search.state !== "completed" && search.state !== "cancelled" && (
                  <>
                    <p className="text-sm text-muted-foreground">{t("transitionHint")}</p>
                    <div className="flex flex-wrap gap-3">
                      {next && next !== "submitted" && (
                        <Button
                          disabled={pending || blocked}
                          onClick={() => void transition(search, next)}
                        >
                          {pending ? t("saving") : t("nextStep", { state: t(`states.${next}`) })}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={pending || blocked}
                        onClick={() => void transition(search, "cancelled")}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function PensionSearchesPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Searches identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
