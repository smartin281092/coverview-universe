import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { managedProfileIdSchema } from "@coverview/contracts";
import {
  Button,
  LoadingState,
  NotFoundState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from "@coverview/ui";
import { api } from "../api";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { AdminFailure } from "../features/users/AdminFailure";
import { CreateProfileDialog } from "../features/users/CreateProfileDialog";
import { AdminDossierTabs } from "../features/users/AdminDossierTabs";
import { ProfileTransferDialog } from "../features/users/ProfileTransferDialog";

const tabs = ["general", "finances", "health", "documents", "contracts", "activities"] as const;
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
  const { t } = useTranslation("users");
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.searchStr);
  const profileId = managedProfileIdSchema.safeParse(params.get("profile")).data ?? "self";
  const requestedTab = tabs.find((item) => item === params.get("tab")) ?? "general";
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
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.error ? false : 15_000),
  });
  const profiles = useQuery({
    queryKey: [...key, "profiles"],
    queryFn: ({ signal }) => api.adminProfiles(userId, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.error ? false : 15_000),
  });
  const selected = profiles.data?.profiles.find((profile) => profile.id === profileId);
  const tab =
    selected?.kind === "legal_entity" && requestedTab === "health" ? "general" : requestedTab;
  useEffect(() => {
    if (!blocked && selected?.kind === "legal_entity" && requestedTab === "health")
      void navigate({
        to: "/users/$userId",
        params: { userId },
        search: { profile: profileId, tab: "general" },
        replace: true,
      });
  }, [blocked, selected?.kind, requestedTab, userId, profileId, navigate]);
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
                onValueChange={(value) => navigateProfile(value, tab)}
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
            {selected && (
              <ProfileTransferDialog
                identity={identity}
                userId={userId}
                profile={selected}
                blocked={blocked}
                portalContainer={portalContainer}
                onTransferred={(destinationUserId) => {
                  void navigate({
                    to: "/users/$userId",
                    params: { userId: destinationUserId },
                    search: { profile: profileId, tab },
                  });
                }}
              />
            )}
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
          <AdminDossierTabs
            key={`${userId}:${profileId}`}
            identity={identity}
            userId={userId}
            profile={selected}
            blocked={blocked}
            portalContainer={portalContainer}
            tab={tab}
            onTabChange={(value) => navigateProfile(profileId, value)}
          />
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
