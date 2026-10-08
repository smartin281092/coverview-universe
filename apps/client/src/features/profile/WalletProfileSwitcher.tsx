import { useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, Plus, UserRound, UsersRound } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
} from "@coverview/ui";
import { api } from "../../api";
import { usePassiveIdentity } from "../identity/session-state";
import { ProfileCreateDialog } from "./ProfileCreateDialog";
import { useWalletProfileScope } from "./use-wallet-profile-scope";

function ProfileSwitcher({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("profile");
  const { scope } = useWalletProfileScope();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const profiles = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "managed-profiles"],
    queryFn: ({ signal }) => api.profiles({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.error ? false : 15_000),
  });
  const selected = profiles.data?.profiles.find((profile) => profile.id === scope);
  const name =
    scope === "all"
      ? t("scope.all")
      : selected?.isSelf
        ? t("scope.self", { name: selected.displayName })
        : selected?.displayName;
  const choose = (profile: string) => {
    if (profile === "create") {
      setCreating(true);
      return;
    }
    const to = pathname.startsWith("/insurance-requests/")
      ? "/insurance-requests"
      : pathname.startsWith("/documents/")
        ? "/documents"
        : pathname.startsWith("/actions/")
          ? "/actions"
          : pathname.startsWith("/authorizations/")
            ? "/account"
            : pathname;
    void navigate({ to, search: { profile } });
  };
  return (
    <>
      <div className="min-w-0 max-w-60 sm:max-w-72">
        <Select
          value={scope}
          disabled={profiles.isPending || profiles.isError}
          onValueChange={choose}
        >
          <SelectTrigger
            ref={trigger}
            className="min-h-11 w-full min-w-0 text-sm"
            aria-label={t("scope.choose")}
          >
            <SelectValue
              className="min-w-0 flex-1"
              placeholder={t(profiles.isPending ? "loading" : "scope.unavailable")}
            >
              {name && <span className="truncate">{name}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">
              <UsersRound className="size-4" aria-hidden="true" />
              {t("scope.all")}
            </SelectItem>
            {profiles.data?.profiles.map((profile) => {
              const Icon = profile.kind === "legal_entity" ? Building2 : UserRound;
              return (
                <SelectItem key={profile.id} value={profile.id}>
                  <Icon className="size-4" aria-hidden="true" />
                  {profile.isSelf
                    ? t("scope.self", { name: profile.displayName })
                    : profile.displayName}
                </SelectItem>
              );
            })}
            <SelectItem value="create" disabled={(profiles.data?.profiles.length ?? 50) >= 50}>
              <Plus className="size-4" aria-hidden="true" />
              {t("scope.create")}
            </SelectItem>
          </SelectContent>
        </Select>
        {profiles.isError && (
          <Button
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => void profiles.refetch()}
          >
            {t("retry")}
          </Button>
        )}
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
    </>
  );
}

export function WalletProfileSwitcher() {
  const identity = usePassiveIdentity();
  if (!identity.data || identity.isFetching || identity.isError) return null;
  return (
    <ProfileSwitcher
      key={`${identity.data.user.id}:${identity.data.session.id}`}
      identity={identity.data}
    />
  );
}
