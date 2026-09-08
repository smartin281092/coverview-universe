import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Search, UserRound } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { Button, EmptyState, Input, Label, LoadingState } from "@coverview/ui";
import { api } from "../api";
import { AdminBoundary } from "../features/users/AdminBoundary";
import { AdminFailure } from "../features/users/AdminFailure";

function Users({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t, i18n } = useTranslation("users");
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.searchStr);
  const q = params.get("q") ?? "";
  const cursor = params.get("cursor") ?? undefined;
  const [search, setSearch] = useState(q);
  const users = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "admin-users", q, cursor],
    queryFn: ({ signal }) =>
      api.adminUsers({ ...(q ? { q } : {}), ...(cursor ? { cursor } : {}), limit: 20 }, { signal }),
    enabled: !blocked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="cv-meta text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <form
        role="search"
        className="max-w-2xl space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ to: "/users", search: { q: search.trim() || undefined } });
        }}
      >
        <Label htmlFor="users-search">{t("search.label")}</Label>
        <div className="flex gap-3">
          <Input
            id="users-search"
            type="search"
            maxLength={120}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search.placeholder")}
            className="min-h-11"
          />
          <Button type="submit" variant="outline" className="min-h-11" disabled={blocked}>
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("search.action")}</span>
            <span className="sr-only sm:hidden">{t("search.action")}</span>
          </Button>
        </div>
      </form>
      {users.isError ? (
        <AdminFailure error={users.error} onRetry={() => void users.refetch()} />
      ) : users.isPending ? (
        <LoadingState label={t("loading")} />
      ) : users.data.users.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t(q ? "empty.search" : "empty.description")}
        />
      ) : (
        <ul className="divide-y divide-border" aria-label={t("title")}>
          {users.data.users.map((user) => (
            <li key={user.id}>
              <Link
                to="/users/$userId"
                params={{ userId: user.id }}
                className="group flex min-h-20 items-center gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-muted/50 motion-reduce:transition-none"
              >
                <UserRound className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-medium">
                    {user.displayName || user.email}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{user.email}</span>
                </span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {t("created", { date: date.format(new Date(user.createdAt)) })}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(cursor || users.data?.nextCursor) && (
        <nav className="flex flex-wrap gap-3" aria-label={t("pagination")}>
          {cursor && (
            <Button
              variant="outline"
              onClick={() => void navigate({ to: "/users", search: { q: q || undefined } })}
            >
              {t("firstPage")}
            </Button>
          )}
          {users.data?.nextCursor && (
            <Button
              variant="outline"
              onClick={() =>
                void navigate({
                  to: "/users",
                  search: { q: q || undefined, cursor: users.data.nextCursor ?? undefined },
                })
              }
            >
              {t("nextPage")}
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}

export function UsersPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Users identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
