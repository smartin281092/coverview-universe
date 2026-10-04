import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  AppointmentLinksConfirm,
  AppointmentLinksPreview,
  AppointmentUnlink,
} from "@coverview/contracts/partner";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from "@coverview/ui";
import { usePartner } from "./PartnerSession";
import { formatDate } from "./Field";
import { partnerApi } from "../api";

export function AppointmentLinksDialog({
  leadId,
  appointmentId,
  onClose,
}: {
  leadId: string;
  appointmentId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState<AppointmentLinksPreview | null>(null);
  const [withdraw, setWithdraw] = useState<{ id: string; revision: number; title: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false),
    [denied, setDenied] = useState(false);
  const attempt = useRef<{
    key: string;
    input: AppointmentLinksConfirm | AppointmentUnlink;
  } | null>(null);
  const queryKey = [...session.queryKey, "appointment-links", leadId, appointmentId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => partnerApi.appointmentLinks(leadId, appointmentId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const options = () => ({
    csrfToken: session.identity.csrfToken,
    idempotencyKey: attempt.current?.key ?? crypto.randomUUID(),
  });
  async function submit(input?: AppointmentLinksConfirm | AppointmentUnlink) {
    if (pending) return;
    if (input && !attempt.current) attempt.current = { key: crypto.randomUUID(), input };
    if (!attempt.current) return;
    setPending(true);
    setError("");
    try {
      const saved =
        "leadId" in attempt.current.input
          ? await partnerApi.unlinkAppointment(
              leadId,
              appointmentId,
              attempt.current.input,
              options(),
            )
          : await partnerApi.confirmAppointmentLinks(
              leadId,
              appointmentId,
              attempt.current.input,
              options(),
            );
      client.setQueryData(queryKey, saved);
      attempt.current = null;
      setUncertain(false);
      setPreview(null);
      setWithdraw(null);
      setSelected([]);
      await client.invalidateQueries({ queryKey: session.queryKey });
      onClose();
    } catch (cause) {
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setPreview(null);
      setWithdraw(null);
      setDenied(true);
      setUncertain(!definitive);
      if (definitive) attempt.current = null;
      setError(t(definitive ? "appointmentLinks.failed" : "appointmentLinks.uncertain"));
    } finally {
      setPending(false);
    }
  }
  const blocked = denied || query.isError;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending && !attempt.current) onClose();
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        showCloseButton={!pending && !attempt.current}
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{t("appointmentLinks.manage")}</DialogTitle>
          <DialogDescription>{t("appointmentLinks.description")}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {uncertain ? (
          <Button disabled={pending} onClick={() => void submit()}>
            {t("retry")}
          </Button>
        ) : blocked ? (
          <div className="space-y-3">
            <p role="alert">{t("appointmentLinks.failed")}</p>
            <Button
              onClick={() => {
                setDenied(false);
                setPreview(null);
                setSelected([]);
                setError("");
                void query.refetch();
              }}
            >
              {t("retry")}
            </Button>
          </div>
        ) : query.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : preview || withdraw ? (
          <form
            key={preview?.basis ?? withdraw?.id}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              if (withdraw)
                void submit({ leadId: withdraw.id, revision: withdraw.revision, confirmed: true });
              else if (preview?.canConfirm)
                void submit({
                  leadIds: preview.targets.map((r) => r.id),
                  basis: preview.basis,
                  clientAgreementConfirmed: true,
                  sharedTermsConfirmed: true,
                });
            }}
          >
            <p className="font-medium">
              {withdraw
                ? t("appointmentLinks.withdrawTitle", { title: withdraw.title })
                : t("appointmentLinks.review")}
            </p>
            {preview && (
              <>
                <p>
                  {t("appointmentLinks.terms", {
                    date: formatDate(preview.appointment.startsAt),
                    mode: t(`appointment.${preview.appointment.mode}`),
                    location: preview.appointment.location,
                  })}
                </p>
                <p>
                  {t("appointmentLinks.duration", { count: preview.appointment.durationMinutes })}
                </p>
                <ul className="space-y-2">
                  {preview.targets.map((item) => (
                    <li key={item.id}>
                      {t("appointmentLinks.target", {
                        title: item.title,
                        assessment: t(`appointmentLinks.assessment.${item.assessment}`),
                      })}
                    </li>
                  ))}
                </ul>
                {!preview.canConfirm && <p role="alert">{t("appointmentLinks.notReady")}</p>}
              </>
            )}
            {(withdraw
              ? ["withdrawConfirmed"]
              : ["clientAgreementConfirmed", "sharedTermsConfirmed"]
            ).map((name) => (
              <label className="flex items-start gap-3 text-sm" key={name}>
                <input type="checkbox" name={name} required disabled={pending} className="mt-1" />
                {t(`appointmentLinks.${name}`)}
              </label>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setPreview(null);
                  setWithdraw(null);
                }}
              >
                {t("back")}
              </Button>
              <Button type="submit" disabled={pending || (!withdraw && !preview?.canConfirm)}>
                {t(pending ? "loading" : "appointmentLinks.confirm")}
              </Button>
            </div>
          </form>
        ) : (
          query.data && (
            <div className="space-y-4">
              <p>
                {t("appointmentLinks.terms", {
                  date: formatDate(query.data.appointment.startsAt),
                  mode: t(`appointment.${query.data.appointment.mode}`),
                  location: query.data.appointment.location,
                })}
              </p>
              <p className="text-sm text-muted-foreground">{t("appointmentLinks.choose")}</p>
              {!query.data.candidates.length && <p>{t("appointmentLinks.noCandidates")}</p>}
              {query.data.candidates.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <label className="flex min-w-0 items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      disabled={
                        pending ||
                        !query.data.canLink ||
                        item.status === "linked" ||
                        (selected.length >= 9 && !selected.includes(item.id))
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, item.id]
                            : selected.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span className="break-words">
                      {item.title}
                      {item.status && (
                        <span className="block text-muted-foreground">
                          {t(`appointmentLinks.status.${item.status}`)}
                        </span>
                      )}
                    </span>
                  </label>
                  {item.status && item.status !== "unlinked" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setWithdraw(item)}
                    >
                      {t("appointmentLinks.unlink")}
                    </Button>
                  )}
                </div>
              ))}
              {query.data.candidatesTruncated && (
                <p className="text-sm">{t("appointmentLinks.candidatesTruncated")}</p>
              )}
              <Button
                disabled={pending || !query.data.canLink || !selected.length}
                onClick={() => {
                  setPending(true);
                  setError("");
                  void partnerApi
                    .previewAppointmentLinks(
                      leadId,
                      appointmentId,
                      { leadIds: [...selected].sort() },
                      options(),
                    )
                    .then(setPreview)
                    .catch(() => {
                      setDenied(true);
                      setError(t("appointmentLinks.failed"));
                    })
                    .finally(() => setPending(false));
                }}
              >
                {t(pending ? "loading" : "appointmentLinks.review")}
              </Button>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
