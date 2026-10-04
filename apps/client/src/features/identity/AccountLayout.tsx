import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react";
import { AccountLayout as SharedAccountLayout } from "@coverview/ui";
import { identityOptions } from "./session-state";

export function AccountLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const identity = useQuery({ ...identityOptions(client), enabled: false });
  const items = [
    { key: "account", icon: UserRound },
    { key: "access", icon: ShieldCheck },
    { key: "devices", icon: MonitorSmartphone },
  ];
  return (
    <SharedAccountLayout
      layout="tabs"
      title={t("identity.accountTitle")}
      eyebrow={t("accountIntro.eyebrow")}
      description={t("identity.accountDescription")}
      heading={
        <header className="space-y-3">
          <p className="wallet-page-eyebrow cv-meta text-muted-foreground">
            {t("accountIntro.eyebrow")}
          </p>
          <h1 className="cv-app-heading">{t("identity.accountTitle")}</h1>
          <p className="max-w-2xl text-muted-foreground">{t("identity.accountDescription")}</p>
        </header>
      }
      details={
        identity.data === null
          ? items.map(({ key, icon: Icon }) => ({
              title: t(`accountIntro.${key}.title`),
              description: t(`accountIntro.${key}.description`),
              icon: <Icon />,
            }))
          : []
      }
    >
      {children}
    </SharedAccountLayout>
  );
}
