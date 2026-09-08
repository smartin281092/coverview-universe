import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, CircleCheck, CircleDashed } from "lucide-react";
import { Button } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { noticeQuery } from "./notice-query";

export function NoticeSummary({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("authorizations");
  const notice = useQuery(noticeQuery(identity));
  const read = !notice.isError && Boolean(notice.data?.firstOpenedAt);
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-5">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-medium">{t("information.title")}</h2>
        <p className="max-w-xl text-sm text-muted-foreground">{t("information.description")}</p>
        <p
          role="status"
          className={`flex items-center gap-2 text-sm ${read ? "text-green-700" : "text-muted-foreground"}`}
        >
          {read ? (
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleDashed className="size-4 shrink-0" aria-hidden="true" />
          )}
          {t(
            notice.isPending
              ? "information.loading"
              : notice.isError
                ? "information.unavailable"
                : read
                  ? "information.read"
                  : "information.unread",
          )}
        </p>
        {notice.isError && (
          <Button variant="outline" onClick={() => void notice.refetch()}>
            {t("information.retry")}
          </Button>
        )}
      </div>
      <Button asChild variant="outline">
        <Link to="/authorizations/$kind" params={{ kind: "lsa45" }}>
          {t("view")}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}
