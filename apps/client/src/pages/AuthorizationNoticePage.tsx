import { useEffect, useRef } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import { Button } from "@coverview/ui";
import { api } from "../api";
import { authorizationTexts as texts } from "@coverview/contracts";
import { noticeKey } from "../features/authorizations/notice-query";
import { forgetIdentity, identityKey } from "../features/identity/session-state";

export function AuthorizationNoticePage({ identity }: { identity: IdentityMe }) {
  const { returnAction } = useSearch({ from: "/authorizations/$kind" });
  const { t } = useTranslation("authorizations");
  const client = useQueryClient();
  const article = useRef<HTMLElement>(null);
  const controller = useRef<AbortController | null>(null);
  const key = useRef(crypto.randomUUID());
  const isCurrent = () => {
    const current = client.getQueryData<IdentityMe | null>(identityKey);
    return (
      !controller.current?.signal.aborted &&
      current?.user.id === identity.user.id &&
      current.session.id === identity.session.id
    );
  };
  const opening = useMutation({
    mutationKey: noticeKey(identity),
    gcTime: 0,
    mutationFn: () =>
      api.openAuthorizationNotice({
        csrfToken: identity.csrfToken,
        idempotencyKey: key.current,
        ...(controller.current ? { signal: controller.current.signal } : {}),
      }),
    onSuccess: (receipt) => {
      if (isCurrent()) {
        client.setQueryData(noticeKey(identity), receipt);
        void client.invalidateQueries({
          queryKey: ["private", identity.user.id, identity.session.id, "action-center"],
        });
      }
    },
    onError: (error) => {
      if (isCurrent() && error instanceof ApiError && error.status === 401)
        void forgetIdentity(client);
    },
    retry: false,
  });
  const { mutate } = opening;
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    let started = false;
    const markVisible = () => {
      const element = article.current;
      if (
        started ||
        document.visibilityState !== "visible" ||
        !element ||
        element.closest("[hidden]")
      )
        return;
      const rect = element.getBoundingClientRect();
      if (!rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      started = true;
      mutate();
    };
    const observer = new IntersectionObserver(markVisible);
    if (article.current) observer.observe(article.current);
    document.addEventListener("visibilitychange", markVisible);
    return () => {
      abort.abort();
      observer.disconnect();
      document.removeEventListener("visibilitychange", markVisible);
    };
  }, [mutate]);
  return (
    <div className="space-y-8">
      {returnAction ? (
        <Button asChild variant="secondary">
          <Link to="/actions/$actionId" params={{ actionId: returnAction }}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("signing.backAction")}
          </Link>
        </Button>
      ) : (
        <Link
          to="/account"
          search={{ tab: "authorizations" }}
          className="wallet-back-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>
      )}
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("information.title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("information.description")}</p>
      </header>
      <article
        ref={article}
        className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-border bg-background p-5 sm:p-8"
        aria-label={t("informationTitle")}
      >
        <div className="space-y-2">
          <p className="font-medium">{t("legalEntity")}</p>
          <p className="text-xs text-muted-foreground">{t("informationEdition")}</p>
          <p
            role="status"
            className={`flex items-center gap-2 text-sm ${opening.isSuccess ? "text-green-700" : "text-muted-foreground"}`}
          >
            {opening.isSuccess && <CircleCheck className="size-4 shrink-0" aria-hidden="true" />}
            {t(
              opening.isSuccess
                ? "information.read"
                : opening.isError
                  ? "information.saveFailed"
                  : "information.recording",
            )}
          </p>
          {opening.isError && (
            <Button variant="outline" onClick={() => mutate()}>
              {t("information.retry")}
            </Button>
          )}
        </div>
        {texts.information.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="font-medium">{section.title}</h2>
            <p className="text-sm leading-7">{section.text}</p>
          </section>
        ))}
        <p className="border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
          {t("legalContact")}
        </p>
      </article>
    </div>
  );
}
