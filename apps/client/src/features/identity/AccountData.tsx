import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import { walletDataAccess, walletDataCategorySchema } from "@coverview/contracts/partner-data";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";

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
            {walletDataCategorySchema.options.map((category) => (
              <li key={category} className="space-y-2 border-b border-border pb-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t(`register.categories.${category}.name`)}</h3>
                  <Badge
                    variant={walletDataAccess[category] === "on_request" ? "outline" : "secondary"}
                  >
                    {t(`register.access.${walletDataAccess[category]}`)}
                  </Badge>
                </div>
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
              {(["orientation", "matching", "reassignment"] as const).map((item) => (
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

// Rights of the people concerned (C7): the person's copy of their Partner data and what it covers.
export function AccountData({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("data");
  const client = useQueryClient();
  const queryKey = ["private", identity.user.id, identity.session.id, "partner-data"];
  const summary = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.walletData(signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const download = useMutation({
    mutationFn: () =>
      partnerApi.exportWalletData({
        csrfToken: identity.csrfToken,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async (copy) => {
      save(copy, `coverview-mes-donnees-${copy.manifest.generatedAt.slice(0, 10)}.json`);
      await client.invalidateQueries({ queryKey });
    },
    retry: false,
  });
  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeStyle: "short" });
  if (summary.isPending) return <LoadingState label={t("loading")} />;
  if (summary.isError)
    return (
      <ErrorState
        title={t("error.title")}
        description={t("error.description")}
        retryLabel={t("error.retry")}
        pendingLabel={t("error.retrying")}
        isPending={summary.isRefetching}
        onRetry={() => {
          void summary.refetch();
        }}
      />
    );
  const last = summary.data.exports[0];
  const copy = download.data;
  return (
    <div className="max-w-2xl space-y-8">
      <section aria-labelledby="account-data-copy" className="space-y-4">
        <h2 id="account-data-copy" className="text-lg font-semibold">
          {t("copy.title")}
        </h2>
        <p className="text-muted-foreground">{t("copy.description")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => download.mutate()} disabled={download.isPending}>
            {download.isPending ? t("copy.preparing") : t("copy.download")}
          </Button>
          <Register />
        </div>
        {copy && (
          <div role="status" className="space-y-1">
            <p>{t("copy.done", { count: copy.manifest.counts.requests ?? 0 })}</p>
            {(copy.manifest.unavailable.length > 0 || copy.manifest.truncated.length > 0) && (
              <p className="text-sm text-muted-foreground">{t("copy.partial")}</p>
            )}
          </div>
        )}
        {download.isError && (
          <p role="alert" className="text-destructive">
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
    </div>
  );
}
