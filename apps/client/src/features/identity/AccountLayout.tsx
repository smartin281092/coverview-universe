import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react";
import { AccountLayout as SharedAccountLayout } from "@coverview/ui";

export function AccountLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const items = [
    { key: "account", icon: UserRound },
    { key: "access", icon: ShieldCheck },
    { key: "devices", icon: MonitorSmartphone },
  ];
  return (
    <SharedAccountLayout
      title={t("identity.accountTitle")}
      eyebrow={t("accountIntro.eyebrow")}
      description={t("identity.accountDescription")}
      details={items.map(({ key, icon: Icon }) => ({
        title: t(`accountIntro.${key}.title`),
        description: t(`accountIntro.${key}.description`),
        icon: <Icon />,
      }))}
    >
      {children}
    </SharedAccountLayout>
  );
}
