import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react";

export function AccountLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const details = [
    { key: "account", icon: UserRound },
    { key: "access", icon: ShieldCheck },
    { key: "devices", icon: MonitorSmartphone },
  ];
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-10">
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
        <p className="text-sm font-medium text-primary">{t("accountIntro.eyebrow")}</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("identity.accountTitle")}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("identity.accountDescription")}
        </p>
      </div>
      <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {children}
      </div>
      <div className="space-y-7 border-t border-border pt-7 lg:col-start-1 lg:row-start-2">
        <ul className="space-y-5">
          {details.map(({ key, icon: Icon }) => (
            <li key={key} className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">{t(`accountIntro.${key}.title`)}</h2>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {t(`accountIntro.${key}.description`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
