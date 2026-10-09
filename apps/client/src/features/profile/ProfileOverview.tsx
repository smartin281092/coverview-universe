import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Building2, Plus, UserRound } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { ManagedProfile } from "@coverview/contracts";
import { Button, Card } from "@coverview/ui";
import { ProfileCreateDialog } from "./ProfileCreateDialog";
import { numberFormat } from "@coverview/ui/number-format";

export function ProfileOverview({
  identity,
  profiles,
}: {
  identity: IdentityMe;
  profiles: ManagedProfile[];
}) {
  const { t, i18n } = useTranslation("profile");
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const percent = (value: number) =>
    numberFormat(i18n.language, { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("scope.all")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("scope.overview")}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => {
          const Icon = profile.kind === "legal_entity" ? Building2 : UserRound;
          return (
            <Card key={profile.id} className="gap-4 p-5">
              <h2 className="flex items-center gap-3 font-medium">
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {profile.displayName}
              </h2>
              <dl className="space-y-2 text-sm">
                {(["general", "finances", "health"] as const)
                  .filter((section) => profile.completion[section] !== null)
                  .map((section) => (
                    <div key={section} className="flex justify-between gap-3">
                      <dt>{t(`workspace.tabs.${section}`)}</dt>
                      <dd>{percent(profile.completion[section] ?? 0)}</dd>
                    </div>
                  ))}
              </dl>
              <Button asChild variant="outline" className="mt-auto bg-background">
                <Link to="/profile" search={{ profile: profile.id, person: profile.id }}>
                  <span>{t("scope.open")}</span>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </Card>
          );
        })}
        <Button
          ref={trigger}
          type="button"
          variant="outline"
          className="h-full min-h-48 w-full cursor-pointer whitespace-normal rounded-xl border-dashed bg-transparent p-5 text-center hover:bg-transparent"
          disabled={profiles.length >= 50}
          onClick={() => setCreating(true)}
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          {t("scope.create")}
        </Button>
      </div>
      {creating && (
        <ProfileCreateDialog
          identity={identity}
          returnFocus={trigger}
          open
          onOpenChange={setCreating}
          onCreated={(profile) =>
            void navigate({ to: "/profile", search: { profile, person: profile } })
          }
        />
      )}
    </div>
  );
}
