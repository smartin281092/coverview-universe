import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  InsuranceApiError,
  type InsuranceRequest,
  type InsuranceRequestState,
} from "@coverview/api-client/insurance-requests";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  RequestProgress,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@coverview/ui";
import { insuranceApi } from "../insurance-api";
import { AdminBoundary } from "../features/users/AdminBoundary";
const stages = ["submitted", "reviewing", "insurer_contacted", "offer_ready", "completed"] as const;
const amount = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    minor / 100,
  );
function Requests({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("insuranceRequests");
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
  const root = ["private", identity.user.id, identity.session.id, "insurance-requests"];
  const list = useQuery({
    queryKey: [...root, state, cursor],
    queryFn: ({ signal }) =>
      insuranceApi.list(
        {
          ...(state === "all" ? {} : { state: state as InsuranceRequestState }),
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
    queryFn: ({ signal }) => insuranceApi.get(selected!, signal, true),
    enabled: !!selected && !blocked,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => (pending || query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  async function transition(
    request: InsuranceRequest,
    next: Exclude<InsuranceRequestState, "draft" | "submitted">,
  ) {
    setPending(true);
    setError("");
    const op = `${request.id}:${request.revision}:${next}`;
    const key = keys.current.get(op) ?? crypto.randomUUID();
    keys.current.set(op, key);
    try {
      await insuranceApi.transition(
        request.id,
        { state: next, revision: request.revision },
        { csrfToken: identity.csrfToken, idempotencyKey: key, signal: abort.current.signal },
      );
      await client.invalidateQueries({ queryKey: root });
    } catch (cause) {
      setError(
        cause instanceof InsuranceApiError && cause.status === 409 ? t("conflict") : t("error"),
      );
    } finally {
      setPending(false);
    }
  }
  const request = detail.data;
  const next = request
    ? stages[stages.indexOf(request.state as (typeof stages)[number]) + 1]
    : undefined;
  return (
    <div ref={setPortal} className="space-y-8">
      <header>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="text-muted-foreground">{t("adminDescription")}</p>
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
          {[...stages, "cancelled"].map((value) => (
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
      ) : list.data.requests.length ? (
        <ul className="divide-y divide-border">
          {list.data.requests.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <p className="font-medium">
                  {item.items.map((person) => `${person.firstName} ${person.lastName}`).join(", ")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("emailStatus", { email: item.email, state: t(`states.${item.state}`) })}
                </p>
                <p className="mt-1 text-sm">
                  {amount(item.totalMonthlyMinor)} {t("amount")}
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
            ) : detail.isError ? (
              <ErrorState
                title={t("error")}
                description=""
                retryLabel={t("retry")}
                pendingLabel={t("loading")}
                onRetry={() => void detail.refetch()}
              />
            ) : (
              request && (
                <>
                  <p className="break-all text-sm">{request.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(request.emailVerified ? "verified" : "guest")}
                  </p>
                  <p>{t(`states.${request.state}`)}</p>
                  <RequestProgress
                    current={Math.max(
                      0,
                      ...request.history.map((event) =>
                        stages.indexOf(event.state as (typeof stages)[number]),
                      ),
                    )}
                    cancelled={request.state === "cancelled"}
                    complete={request.state === "completed"}
                    steps={stages.map((value) => ({
                      label: t(`states.${value}`),
                      description: t(`descriptions.${value}`),
                      at: request.history.find((event) => event.state === value)?.at,
                    }))}
                  />
                  <ul className="divide-y divide-border">
                    {request.items.map((item) => (
                      <li key={item.id} className="space-y-2 py-4">
                        <strong className="font-medium">
                          {item.firstName} {item.lastName}
                        </strong>
                        <p className="text-sm">
                          {t("product", {
                            insurer: item.offer.insurerBrand ?? item.offer.insurerName,
                            model: item.offer.name,
                          })}
                        </p>
                        <p className="text-sm">
                          {amount(item.offer.monthlyPremiumMinor)} {t("amount")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("configuration", {
                            year: item.birthYear,
                            postalCode: item.locality.postalCode,
                            locality: item.locality.locality,
                            deductible: item.deductible,
                            accident: t(item.accident ? "included" : "excluded"),
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("sexValue", { value: t(`sex.${item.sex}`) })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("currentInsurerValue", {
                            name:
                              item.currentInsurerBrand ??
                              item.currentInsurerName ??
                              t("notProvided"),
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  {!["completed", "cancelled", "draft"].includes(request.state) && (
                    <>
                      <p className="text-sm text-muted-foreground">{t("transitionHint")}</p>
                      <div className="flex flex-wrap gap-3">
                        {next && next !== "submitted" && (
                          <Button
                            disabled={pending || blocked}
                            onClick={() => void transition(request, next)}
                          >
                            {pending ? t("saving") : t(`states.${next}`)}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={pending || blocked}
                          onClick={() => void transition(request, "cancelled")}
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function InsuranceRequestsPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Requests identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
