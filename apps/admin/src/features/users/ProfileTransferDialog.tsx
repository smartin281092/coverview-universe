import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError, type IdentityMe } from "@coverview/api-client";
import type { ManagedProfile } from "@coverview/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";
import { api } from "../../api";
import { AdminFailure } from "./AdminFailure";

export function ProfileTransferDialog({
  identity,
  userId,
  profile,
  blocked,
  onTransferred,
  portalContainer,
}: {
  identity: IdentityMe;
  userId: string;
  profile: ManagedProfile;
  blocked: boolean;
  onTransferred: (destinationUserId: string) => void;
  portalContainer?: HTMLDivElement | null;
}) {
  const { t } = useTranslation("profileTransfer");
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const busy = useRef(false);
  const command = useRef<{ signature: string; key: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const accounts = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "admin-transfer-accounts", query],
    queryFn: ({ signal }) => api.adminUsers({ q: query, limit: 50 }, { signal }),
    enabled: open && !blocked && !profile.isSelf,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const transfer = async () => {
    if (busy.current || blocked || !destination || profile.isSelf) return;
    busy.current = true;
    setPending(true);
    setFailure(null);
    const active = new AbortController();
    controller.current = active;
    const input = { destinationUserId: destination, revision: profile.revision };
    const signature = JSON.stringify({ userId, profileId: profile.id, input });
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await api.transferAdminProfile(userId, profile.id, input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: command.current.key,
        signal: active.signal,
      });
      if (active.signal.aborted) return;
      command.current = null;
      setOpen(false);
      await client.cancelQueries({ queryKey: ["private", identity.user.id, identity.session.id] });
      client.removeQueries({
        predicate: (cached) => cached.queryKey[0] === "private" && cached.queryKey.includes(userId),
      });
      void client.invalidateQueries({
        queryKey: ["private", identity.user.id, identity.session.id],
      });
      onTransferred(result.destinationUserId);
    } catch (error) {
      if (!active.signal.aborted) setFailure(error);
    } finally {
      busy.current = false;
      if (!active.signal.aborted) setPending(false);
    }
  };
  const transferError =
    failure instanceof ApiError && failure.code.startsWith("PROFILE_TRANSFER_")
      ? failure.code
      : null;
  return (
    <>
      <Button variant="outline" disabled={blocked} onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) {
            setOpen(value);
            setFailure(null);
          }
        }}
      >
        <DialogContent portalContainer={portalContainer} className="p-6 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("title", { name: profile.displayName })}</DialogTitle>
            <DialogDescription>
              {t(profile.isSelf ? "selfUnavailable" : "description")}
            </DialogDescription>
          </DialogHeader>
          {!profile.isSelf && (
            <div className="space-y-5">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setQuery(search.trim());
                  setDestination("");
                }}
              >
                <Label htmlFor="transfer-account-search">{t("search")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="transfer-account-search"
                    type="search"
                    maxLength={160}
                    value={search}
                    placeholder={t("placeholder")}
                    disabled={pending || blocked}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <Button type="submit" variant="outline" disabled={pending || blocked}>
                    {t("searchAction")}
                  </Button>
                </div>
              </form>
              {accounts.isError ? (
                <AdminFailure error={accounts.error} onRetry={() => void accounts.refetch()} />
              ) : accounts.isPending ? (
                <LoadingState label={t("searchAction")} />
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="transfer-account-destination">{t("destination")}</Label>
                  <Select
                    value={destination}
                    onValueChange={setDestination}
                    disabled={pending || blocked}
                  >
                    <SelectTrigger id="transfer-account-destination" className="w-full">
                      <SelectValue placeholder={t("choose")} />
                    </SelectTrigger>
                    <SelectContent portalContainer={portalContainer}>
                      {accounts.data.users
                        .filter((account) => account.id !== userId)
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!accounts.data.users.some((account) => account.id !== userId) && (
                    <p className="text-sm text-muted-foreground">{t("empty")}</p>
                  )}
                  {accounts.data.nextCursor && (
                    <p className="text-sm text-muted-foreground">{t("more")}</p>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{t("signatures")}</p>
              {transferError ? (
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-destructive">{t(transferError)}</p>
                </div>
              ) : failure ? (
                <AdminFailure error={failure} onRetry={() => void transfer()} />
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            {!profile.isSelf && (
              <Button disabled={!destination || pending || blocked} onClick={() => void transfer()}>
                {t(pending ? "pending" : "transfer")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
