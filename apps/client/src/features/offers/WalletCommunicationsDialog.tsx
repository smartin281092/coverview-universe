import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { CommunicationForm, type WalletCommunicationEditor } from "./CommunicationForm";
export function WalletCommunicationsDialog({
  identity,
  leadId,
  onClose,
}: {
  identity: IdentityMe;
  leadId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("communications"),
    [selected, setSelected] = useState<string>(),
    [recordsCursor, setRecordsCursor] = useState<string>(),
    [recordingsCursor, setRecordingsCursor] = useState<string>(),
    [before, setBefore] = useState<number>(),
    [editor, setEditor] = useState<WalletCommunicationEditor | null>(null);
  const prefix = [
      "private",
      identity.user.id,
      identity.session.id,
      "wallet-leads",
      "communications",
      leadId,
    ],
    policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 };
  const list = useQuery({
    queryKey: [...prefix, recordsCursor, recordingsCursor],
    queryFn: ({ signal }) =>
      partnerApi.communications(
        leadId,
        {
          ...(recordsCursor ? { recordsCursor } : {}),
          ...(recordingsCursor ? { recordingsCursor } : {}),
        },
        true,
        signal,
      ),
    ...policy,
  });
  const detail = useQuery({
    queryKey: [...prefix, "recording", selected, before],
    queryFn: ({ signal }) => partnerApi.recording(selected!, true, before, signal),
    enabled: !!selected,
    ...policy,
  });
  const data = list.isError ? undefined : list.data,
    item = detail.isError ? undefined : detail.data;
  const date = (v: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(v));
  const reload = () => {
    void list.refetch();
    if (selected) void detail.refetch();
  };
  const enabled =
    !!data &&
    !!editor &&
    ("preferences" in editor
      ? data.preferences.canEdit && data.preferences.revision === editor.preferences.revision
      : !!item && item.canDecide && item.revision === editor.recording.revision);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("walletDescription")}</DialogDescription>
        </DialogHeader>
        {list.isError || (selected && detail.isError) ? (
          <div role="alert">
            <p>{t("changed")}</p>
            <Button
              onClick={() => {
                setEditor(null);
                reload();
              }}
            >
              {t("reload")}
            </Button>
          </div>
        ) : !data || (selected && !item) ? (
          <p>{t("loading")}</p>
        ) : editor ? (
          <CommunicationForm
            identity={identity}
            leadId={leadId}
            editor={editor}
            enabled={enabled}
            onBack={() => setEditor(null)}
            onSaved={() => {
              setEditor(null);
              reload();
            }}
          />
        ) : selected && item ? (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(undefined);
                setBefore(undefined);
              }}
            >
              {t("back")}
            </Button>
            <h3 className="font-semibold">{t("recording")}</h3>
            <Badge>{t(`states.${item.state}`)}</Badge>
            <p>{t("advisor", { name: item.advisorName })}</p>
            <p>
              {t("channel")}
              {t("separator")}
              {t(`channels.${item.request.channel}`)}
            </p>
            <p>{t("validThrough", { date: date(item.request.validUntil) })}</p>
            <p>{t("retainedThrough", { date: date(item.request.retainUntil) })}</p>
            <ul className="list-inside list-disc">
              {item.request.purposes.map((v) => (
                <li key={v}>{t(`purposes.${v}`)}</li>
              ))}
            </ul>
            <p className="whitespace-pre-wrap">{item.request.notice}</p>
            <p>
              {t("sourceReference")}
              {t("separator")}
              {item.request.sourceReference}
            </p>
            {item.decisionAt && <p>{t("decisionAt", { date: date(item.decisionAt) })}</p>}
            {item.canDecide && (
              <Button onClick={() => setEditor({ recording: item })}>{t("yourDecision")}</Button>
            )}
            {!item.transcripts.length && (
              <p>{t(item.state === "allowed" ? "noTranscript" : "contentUnavailable")}</p>
            )}
            {item.transcripts.map((v) => (
              <section key={v.id} className="space-y-3 border-t border-border py-4">
                <h3 className="font-semibold">
                  {t(v.revision === 1 ? "initialVersion" : "correctedVersion", {
                    revision: v.revision,
                  })}
                </h3>
                <p>{t("contactAt", { date: date(v.input.occurredAt) })}</p>
                <p>{t("savedAt", { date: date(v.createdAt) })}</p>
                <p>{v.input.sourceReference}</p>
                {v.input.correctionReason && <p>{v.input.correctionReason}</p>}
                {v.input.segments.map((s, i) => (
                  <article key={i}>
                    <p className="font-medium">
                      {s.speaker}
                      {t("separator")}
                      {s.locator}
                    </p>
                    <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-3">
                      {s.text}
                    </blockquote>
                  </article>
                ))}
              </section>
            ))}
            <div className="flex gap-3">
              {before && (
                <Button variant="outline" onClick={() => setBefore(undefined)}>
                  {t("first")}
                </Button>
              )}
              {item.nextRevision && (
                <Button variant="outline" onClick={() => setBefore(item.nextRevision!)}>
                  {t("olderVersions")}
                </Button>
              )}
            </div>
            {item.tasks.length > 0 && (
              <section>
                <h3 className="font-semibold">{t("tasks")}</h3>
                {item.tasks.map((task) => (
                  <article key={task.id} className="py-3">
                    <p>{task.title}</p>
                    <p>
                      {t(`taskStates.${task.state}`)}
                      {t("separator")}
                      {date(task.dueAt)}
                    </p>
                  </article>
                ))}
              </section>
            )}
          </>
        ) : (
          <>
            <h3 className="font-semibold">{t("preferences")}</h3>
            <p>
              {data.preferences.channels
                ? data.preferences.channels.map((v) => t(`channels.${v}`)).join(", ")
                : t("notProvided")}
            </p>
            <p className="whitespace-pre-wrap">{data.preferences.note}</p>
            {data.preferences.canEdit && (
              <Button
                variant="outline"
                onClick={() => setEditor({ preferences: data.preferences })}
              >
                {t("editPreferences")}
              </Button>
            )}
            <h3 className="font-semibold">{t("recordings")}</h3>
            {!data.recordings.length && <p>{t("noRecordings")}</p>}
            {data.recordings.map((r) => (
              <Button
                key={r.id}
                variant="outline"
                className="h-auto min-h-11 w-full justify-between gap-3 whitespace-normal text-left"
                onClick={() => setSelected(r.id)}
              >
                <span>{date(r.createdAt)}</span>
                <span>{t(`states.${r.state}`)}</span>
              </Button>
            ))}
            <div className="flex gap-3">
              {recordingsCursor && (
                <Button variant="outline" onClick={() => setRecordingsCursor(undefined)}>
                  {t("first")}
                </Button>
              )}
              {data.nextRecordingsCursor && (
                <Button
                  variant="outline"
                  onClick={() => setRecordingsCursor(data.nextRecordingsCursor!)}
                >
                  {t("older")}
                </Button>
              )}
            </div>
            <h3 className="font-semibold">{t("records")}</h3>
            {!data.records.length && <p>{t("noRecords")}</p>}
            {data.records.map((r) => (
              <article key={r.id} className="space-y-2 border-t border-border py-4">
                <p className="font-medium">
                  {t(`channels.${r.input.channel}`)}
                  {t("separator")}
                  {date(r.input.occurredAt)}
                </p>
                <p>
                  {r.authorName}
                  {t("separator")}
                  {t(`outcomes.${r.input.outcome}`)}
                </p>
                <p className="whitespace-pre-wrap">{r.input.summary}</p>
                <p>
                  {r.input.nextAction}
                  {t("separator")}
                  {date(r.input.dueAt)}
                </p>
              </article>
            ))}
            <div className="flex gap-3">
              {recordsCursor && (
                <Button variant="outline" onClick={() => setRecordsCursor(undefined)}>
                  {t("first")}
                </Button>
              )}
              {data.nextRecordsCursor && (
                <Button variant="outline" onClick={() => setRecordsCursor(data.nextRecordsCursor!)}>
                  {t("older")}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
