import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { logoutCommandKey, type LogoutCommand } from "./LogoutFeedback";

export function LogoutActions({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const start = (scope: "current" | "all") => {
    if (client.getQueryData(logoutCommandKey)) return;
    client.setQueryData<LogoutCommand>(logoutCommandKey, {
      scope,
      csrfToken: identity.csrfToken,
      idempotencyKey: crypto.randomUUID(),
      status: "requested",
    });
  };
  return (
    <section aria-label={t("identity.logoutTitle")} className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() => {
          start("current");
        }}
      >
        {t("identity.logoutCurrent")}
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          start("all");
        }}
      >
        {t("identity.logoutAll")}
      </Button>
    </section>
  );
}
