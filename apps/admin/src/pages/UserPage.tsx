import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Building2, Plus, UserRound } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { managedProfileIdSchema } from "@coverview/contracts";
import {
  Badge,
  Button,
  LoadingState,
  NotFoundState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@coverview/ui";
import { api } from "../api";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { AdminFailure } from "../features/users/AdminFailure";
import { AdminProfileEditor } from "../features/users/AdminProfileEditor";
import { CreateProfileDialog } from "../features/users/CreateProfileDialog";
import { AdminDocuments } from "../features/users/AdminDocuments";

const tabs = ["general", "finances", "health", "documents"] as const;
type Tab = (typeof tabs)[number];

function User({
  identity,
  userId,
  blocked,
}: {
  identity: IdentityMe;
  userId: string;
  blocked: boolean;
}) {
  const { t, i18n } = useTranslation("users");
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.searchStr);
  const profileId = managedProfileIdSchema.safeParse(params.get("profile")).data ?? "self";
  const requestedTab = params.get("tab");
  const tab: Tab = tabs.find((item) => item === requestedTab) ?? "general";
  const [adding, setAdding] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const key = ["private", identity.user.id, identity.session.id, "admin-user", userId];
  const user = useQuery({
    queryKey: [...key, "summary"],
    queryFn: ({ signal }) => api.adminUser(userId, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const profiles = useQuery({
    queryKey: [...key, "profiles"],
    queryFn: ({ signal }) => api.adminProfiles(userId, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const navigateProfile = (id: string, nextTab: Tab = "general") =>
    void navigate({
      to: "/users/$userId",
      params: { userId },
      search: { profile: id, tab: nextTab },
    });
  if (user.isError || profiles.isError)
    return (
      <AdminFailure
        error={user.error ?? profiles.error}
        onRetry={() => {
          void user.refetch();
          void profiles.refetch();
        }}
      />
    );
  if (!user.data || !profiles.data) return <LoadingState label={t("profile.loading")} />;
  const selected = profiles.data.profiles.find((profile) => profile.id === profileId);
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const Icon = selected?.kind === "legal_entity" ? Building2 : UserRound;
  return (
    <div className="space-y-7">
      <div ref={setPortalContainer} className="contents" />
      <Link to="/users" className="cv-text-link inline-flex min-h-11 items-center gap-2 text-sm">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <div className="cv-tabbed-page">
        <header className="space-y-3">
          <p className="cv-meta text-muted-foreground">{t("profile.eyebrow")}</p>
          <h1 className="cv-app-heading break-words">{user.data.displayName || user.data.email}</h1>
          <p className="break-words text-muted-foreground">{user.data.email}</p>
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="min-w-0 flex-1 space-y-2 sm:max-w-sm">
              <Label htmlFor="admin-selected-profile">{t("profile.choose")}</Label>
              <Select
                value={profileId}
                onValueChange={(value) => navigateProfile(value)}
                disabled={blocked}
              >
                <SelectTrigger id="admin-selected-profile" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={portalContainer}>
                  {profiles.data.profiles.map((profile) => (
                    <SelectItem value={profile.id} key={profile.id}>
                      {profile.isSelf ? t("profile.self") : profile.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={blocked || profiles.data.profiles.length >= 50}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t("profile.add")}
            </Button>
          </div>
        </header>
        {!selected ? (
          <NotFoundState
            title={t("missing.title")}
            description={t("missing.description")}
            action={
              <Button onClick={() => navigateProfile("self")}>{t("profile.returnSelf")}</Button>
            }
          />
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              const next = tabs.find((item) => item === value);
              if (next) navigateProfile(profileId, next);
            }}
            className="min-w-0 gap-6"
          >
            <TabsList
              className="h-auto min-h-14 w-full sm:w-auto"
              aria-label={t("profile.sections")}
            >
              {tabs.map((item) => (
                <TabsTrigger
                  key={item}
                  value={item}
                  className="min-h-11 min-w-0 flex-1 px-2 sm:px-5"
                >
                  <span className="flex flex-col items-center gap-1 text-sm">
                    <span>{t(`tabs.${item}`)}</span>
                    {item !== "documents" && (
                      <span className="text-xs font-normal opacity-75">
                        {selected.completion[item] === null
                          ? t("profile.notApplicable")
                          : percent.format((selected.completion[item] ?? 0) / 100)}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={tab} className="min-w-0 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <p className="break-words font-medium">
                  {selected.isSelf ? t("profile.self") : selected.displayName}
                </p>
                <Badge variant="secondary">
                  {t(selected.kind === "legal_entity" ? "profile.entity" : "profile.person")}
                </Badge>
              </div>
              {tab === "documents" ? (
                <AdminDocuments
                  key={`${userId}:${profileId}`}
                  identity={identity}
                  userId={userId}
                  profile={selected}
                  blocked={blocked}
                  portalContainer={portalContainer}
                />
              ) : tab === "health" && selected.kind === "legal_entity" ? (
                <p className="text-sm text-muted-foreground">{t("profile.entityHealth")}</p>
              ) : (
                <AdminProfileEditor
                  key={`${userId}:${profileId}:${tab}`}
                  identity={identity}
                  userId={userId}
                  profile={selected}
                  section={tab}
                  blocked={blocked}
                  portalContainer={portalContainer}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
      <CreateProfileDialog
        identity={identity}
        userId={userId}
        open={adding}
        blocked={blocked}
        onOpenChange={setAdding}
        portalContainer={portalContainer}
        onCreated={(profile) => {
          client.setQueryData(
            [...key, "profiles"],
            (current: Awaited<ReturnType<typeof api.adminProfiles>> | undefined) => ({
              profiles: [
                ...(current?.profiles.filter((item) => item.id !== profile.id) ?? []),
                profile,
              ],
            }),
          );
          navigateProfile(profile.id);
        }}
      />
    </div>
  );
}

export function UserPage() {
  const { userId } = useParams({ from: "/users/$userId" });
  return (
    <AdminBoundary>
      {(identity, blocked) => (
        <User key={userId} identity={identity} userId={userId} blocked={blocked} />
      )}
    </AdminBoundary>
  );
}
