import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  professionalDataCategorySchema,
  type MatchingAppearance,
  type ProfessionalData,
} from "@coverview/contracts/partner-data";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ErrorState,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";

const PAGE = 10;

// The file is built from the response and handed to the browser: CoverView keeps no copy of it.
function save(content: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Register() {
  const { t } = useTranslation("data");
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">{t("register.open")}</Button>
      </SheetTrigger>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-lg"
        showCloseButton
        closeLabel={t("register.close")}
      >
        <SheetHeader>
          <SheetTitle>{t("register.title")}</SheetTitle>
          <SheetDescription>{t("register.description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6 text-sm">
          <ul className="space-y-5">
            {professionalDataCategorySchema.options.map((category) => (
              <li key={category} className="space-y-2 border-b border-border pb-5">
                <h3 className="font-medium">{t(`register.categories.${category}.name`)}</h3>
                <dl className="space-y-1">
                  {(["purpose", "recipients", "origin"] as const).map((field) => (
                    <div key={field}>
                      <dt className="text-muted-foreground">{t(`register.labels.${field}`)}</dt>
                      <dd>{t(`register.categories.${category}.${field}`)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <section className="space-y-1">
            <h3 className="font-medium">{t("register.retentionTitle")}</h3>
            <p>{t("register.retention")}</p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">{t("register.automatedTitle")}</h3>
            <ul className="list-disc space-y-1 pl-5">
              {(["matching", "reassignment"] as const).map((item) => (
                <li key={item}>{t(`register.automated.${item}`)}</li>
              ))}
            </ul>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">{t("register.controllerTitle")}</h3>
            <p>{t("register.controller")}</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Criteria({ item }: { item: MatchingAppearance }) {
  const { t } = useTranslation("data");
  const value = (raw: string | boolean | number) =>
    typeof raw === "number"
      ? String(raw)
      : typeof raw === "boolean"
        ? t(`scores.values.${raw ? "yes" : "no"}`)
        : t(`scores.values.${raw}`);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("scores.criteriaOpen")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("scores.criteriaTitle")}</DialogTitle>
          <DialogDescription>{t(`partner:category.${item.category}`)}</DialogDescription>
        </DialogHeader>
        {item.criteria ? (
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
            {(
              Object.keys(item.criteria) as (keyof NonNullable<MatchingAppearance["criteria"]>)[]
            ).map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{t(`scores.criteria.${key}`)}</dt>
                <dd className="text-right font-medium">{value(item.criteria![key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm">{t("scores.criteriaNone")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Scores({ data }: { data: ProfessionalData }) {
  const { t, i18n } = useTranslation("data");
  const [page, setPage] = useState(0);
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  const items = data.matching.items,
    pages = Math.max(1, Math.ceil(items.length / PAGE)),
    shown = items.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <section aria-labelledby="data-scores" className="space-y-6">
      <div className="space-y-1">
        <h2 id="data-scores" className="text-lg font-semibold">
          {t("scores.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("scores.description")}</p>
        <Link
          to="/profile/public"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("scores.evaluationLink")}
        </Link>
      </div>
      <div className="space-y-3">
        <h3 className="font-medium">{t("scores.matchingTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("scores.matchingDescription")}</p>
        {items.length === 0 ? (
          <p className="text-sm">{t("scores.empty")}</p>
        ) : (
          <>
            <ul className="divide-y divide-border border-y border-border">
              {shown.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {t("scores.heading", {
                        category: t(`partner:category.${item.category}`),
                        rank: item.rank
                          ? t("scores.rank", { rank: item.rank })
                          : t("scores.outside"),
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t(item.first ? "scores.metaFirst" : "scores.meta", {
                        date: day.format(new Date(item.createdAt)),
                        kind: t(`scores.kind.${item.kind}`),
                        decision: item.chosen ? t("scores.chosen") : t("scores.notChosen"),
                      })}
                    </p>
                  </div>
                  <Criteria item={item} />
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  {t("scores.previous")}
                </Button>
                <span aria-live="polite">{t("scores.page", { page: page + 1, pages })}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  {t("scores.next")}
                </Button>
              </div>
            )}
            {data.matching.truncated && (
              <p className="text-sm text-muted-foreground">{t("scores.truncated")}</p>
            )}
          </>
        )}
      </div>
      {data.referrer && (
        <div className="space-y-3">
          <h3 className="font-medium">{t("scores.referrerTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("scores.referrerPeriod", {
              from: day.format(new Date(data.referrer.periodFrom)),
              to: day.format(new Date(data.referrer.periodTo)),
            })}
          </p>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm sm:max-w-md">
            {(["created", "authorized", "duplicates", "invalid", "categoryChanged"] as const).map(
              (key) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{t(`scores.referrer.${key}`)}</dt>
                  <dd className="text-right font-medium">{data.referrer![key]}</dd>
                </div>
              ),
            )}
          </dl>
        </div>
      )}
    </section>
  );
}

// Rights of the people concerned (C7): what CoverView holds about this professional, their
// internal scores (R5) and their copy. Open to every Partner session, operational or not.
export function DataPage() {
  const { t, i18n } = useTranslation("data"),
    session = usePartner(),
    client = useQueryClient(),
    queryKey = [...session.queryKey, "data"];
  const summary = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.professionalData(signal),
    gcTime: 0,
    retry: false,
  });
  const download = useMutation({
    mutationFn: () =>
      partnerApi.exportProfessionalData({
        csrfToken: session.identity.csrfToken,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async (copy) => {
      save(copy, `coverview-mes-donnees-partner-${copy.manifest.generatedAt.slice(0, 10)}.json`);
      await client.invalidateQueries({ queryKey });
    },
    retry: false,
  });
  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeStyle: "short" });
  const copy = download.data,
    last = summary.data?.exports[0];
  return (
    <section className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>
      {summary.isPending ? (
        <LoadingState label={t("loading")} />
      ) : summary.isError ? (
        <ErrorState
          title={t("error.title")}
          description={t("error.description")}
          retryLabel={t("error.retry")}
          pendingLabel={t("error.retrying")}
          isPending={summary.isRefetching}
          onRetry={() => void summary.refetch()}
        />
      ) : (
        <>
          <section aria-labelledby="data-copy" className="space-y-4">
            <h2 id="data-copy" className="text-lg font-semibold">
              {t("copy.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("copy.description")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => download.mutate()} disabled={download.isPending}>
                {download.isPending ? t("copy.preparing") : t("copy.download")}
              </Button>
              <Register />
            </div>
            {copy && (
              <div role="status" className="space-y-1 text-sm">
                <p>{t("copy.done")}</p>
                {(copy.manifest.unavailable.length > 0 || copy.manifest.truncated.length > 0) && (
                  <p className="text-muted-foreground">{t("copy.partial")}</p>
                )}
              </div>
            )}
            {download.isError && (
              <p role="alert" className="text-sm text-destructive">
                {download.error instanceof PartnerApiError && download.error.status === 429
                  ? t("copy.tooMany")
                  : t("copy.failed")}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {last
                ? t("copy.last", { date: format.format(new Date(last.createdAt)) })
                : t("copy.never")}
            </p>
          </section>
          <Scores data={summary.data} />
        </>
      )}
    </section>
  );
}
