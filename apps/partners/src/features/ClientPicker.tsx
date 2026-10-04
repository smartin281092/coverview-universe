import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Input, Label, LoadingState } from "@coverview/ui";
import { api } from "../api";
import { usePartner } from "./PartnerSession";

export function ClientPicker({
  onSelect,
}: {
  onSelect: (client: {
    userId: string;
    profileId: string | null;
    name: string;
    email: string;
  }) => void;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState<string>();
  const result = useQuery({
    queryKey: [...session.queryKey, "client-picker", query],
    queryFn: ({ signal }) => api.adminProfileDirectory({ q: query ?? "", limit: 20 }, { signal }),
    enabled: session.context.administrator && query !== undefined,
    gcTime: 0,
    retry: false,
  });
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <Label htmlFor="client-picker">{t("create.chooseClient")}</Label>
      <div className="flex gap-2">
        <Input
          id="client-picker"
          value={search}
          maxLength={120}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => setQuery(search.trim())}>
          {t("search")}
        </Button>
      </div>
      {result.isFetching ? (
        <LoadingState label={t("loading")} />
      ) : result.isError ? (
        <p role="alert">{t("error")}</p>
      ) : (
        result.data && (
          <ul className="max-h-52 overflow-y-auto">
            {result.data.profiles.map((profile) => (
              <li key={profile.profileId}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start py-3 text-left"
                  onClick={() =>
                    onSelect({
                      userId: profile.userId,
                      profileId: profile.isSelf ? null : profile.profileId,
                      name: profile.displayName,
                      email: profile.accountEmail,
                    })
                  }
                >
                  <span>
                    <span className="block">{profile.displayName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {profile.accountEmail}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
            {!result.data.profiles.length && (
              <li className="py-2 text-sm text-muted-foreground">{t("empty")}</li>
            )}
          </ul>
        )
      )}
    </section>
  );
}
