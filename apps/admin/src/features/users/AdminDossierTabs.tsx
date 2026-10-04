import { Building2, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import type { ManagedProfile } from "@coverview/contracts";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@coverview/ui";
import { AdminProfileEditor } from "./AdminProfileEditor";
import { AdminDocuments } from "./AdminDocuments";
import { AdminContracts } from "./AdminContracts";
import { AdminActivities } from "./AdminActivities";

const sections = ["general", "finances", "health"] as const;
const dossierTabs = ["profile", "documents", "contracts", "activities"] as const;
type Tab = (typeof sections)[number] | "documents" | "contracts" | "activities";
export function AdminDossierTabs({
  identity,
  userId,
  profile,
  blocked,
  portalContainer,
  tab,
  onTabChange,
}: {
  identity: IdentityMe;
  userId: string;
  profile: ManagedProfile;
  blocked: boolean;
  portalContainer: HTMLDivElement | null;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const { t, i18n } = useTranslation("users");
  const { t: dossier } = useTranslation("dossier");
  const selectedSection = sections.find((item) => item === tab);
  const rootTab = selectedSection ? "profile" : tab;
  const visibleSections = sections.filter(
    (item) => item !== "health" || profile.kind !== "legal_entity",
  );
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const Icon = profile.kind === "legal_entity" ? Building2 : UserRound;
  const context = { identity, userId, profileId: profile.id, blocked, portalContainer };
  return (
    <Tabs
      value={rootTab}
      onValueChange={(value) => {
        const next = dossierTabs.find((item) => item === value);
        if (next) onTabChange(next === "profile" ? "general" : next);
      }}
      className="min-w-0 gap-6"
    >
      <TabsList className="h-auto min-h-12 w-full sm:w-auto" aria-label={dossier("navigation")}>
        {dossierTabs.map((item) => (
          <TabsTrigger key={item} value={item} className="min-h-11 min-w-0 flex-1 px-2 sm:px-5">
            {dossier(`tabs.${item}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={rootTab} className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="break-words font-medium">
            {profile.isSelf ? t("profile.self") : profile.displayName}
          </p>
          <Badge variant="secondary">
            {t(profile.kind === "legal_entity" ? "profile.entity" : "profile.person")}
          </Badge>
        </div>
        {selectedSection ? (
          <Tabs
            value={selectedSection}
            onValueChange={(value) => {
              const next = visibleSections.find((item) => item === value);
              if (next) onTabChange(next);
            }}
            className="min-w-0 gap-6"
          >
            <TabsList
              className="h-auto min-h-14 w-full sm:w-auto"
              aria-label={t("profile.sections")}
            >
              {visibleSections.map((item) => (
                <TabsTrigger
                  key={item}
                  value={item}
                  className="min-h-11 min-w-0 flex-1 px-2 sm:px-5"
                >
                  <span className="flex flex-col items-center gap-1 text-sm">
                    <span>{t(`tabs.${item}`)}</span>
                    <span className="text-xs font-normal opacity-75">
                      {profile.completion[item] === null
                        ? t("profile.notApplicable")
                        : percent.format((profile.completion[item] ?? 0) / 100)}
                    </span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={selectedSection}>
              <AdminProfileEditor
                key={selectedSection}
                identity={identity}
                userId={userId}
                profile={profile}
                section={selectedSection}
                blocked={blocked}
                portalContainer={portalContainer}
              />
            </TabsContent>
          </Tabs>
        ) : tab === "documents" ? (
          <AdminDocuments
            identity={identity}
            userId={userId}
            profile={profile}
            blocked={blocked}
            portalContainer={portalContainer}
          />
        ) : tab === "contracts" ? (
          <AdminContracts {...context} />
        ) : (
          <AdminActivities {...context} />
        )}
      </TabsContent>
    </Tabs>
  );
}
