import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Badge, LoadingState, ErrorState } from "@coverview/ui";
import { usePartner } from "../features/PartnerSession";
import {
  CommunicationEditor,
  type CommunicationEditorState,
} from "../features/CommunicationEditor";
import { formatDate } from "../features/Field";
import { partnerApi } from "../api";
export function CommunicationsPage() {
  const { t } = useTranslation("communications"),
    session = usePartner(),
    { leadId } = useParams({ from: "/leads/$leadId/communications" });
  const [selected, setSelected] = useState<string>(),
    [recordsCursor, setRecordsCursor] = useState<string>(),
    [recordingsCursor, setRecordingsCursor] = useState<string>(),
    [before, setBefore] = useState<number>(),
    [editor, setEditor] = useState<CommunicationEditorState | null>(null);
  const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 10000 };
  const list = useQuery({
    queryKey: [...session.queryKey, "communications", leadId, recordsCursor, recordingsCursor],
    queryFn: ({ signal }) =>
      partnerApi.communications(
        leadId,
        {
          ...(recordsCursor ? { recordsCursor } : {}),
          ...(recordingsCursor ? { recordingsCursor } : {}),
        },
        false,
        signal,
      ),
    ...policy,
  });
  const detail = useQuery({
    queryKey: [...session.queryKey, "recording", selected, before],
    queryFn: ({ signal }) => partnerApi.recording(selected!, false, before, signal),
    enabled: !!selected,
    ...policy,
  });
  const data = list.isError ? undefined : list.data,
    item = detail.isError ? undefined : detail.data;
  const reload = () => {
    void list.refetch();
    if (selected) void detail.refetch();
  };
  const enabled =
    !!data &&
    (editor?.recording
      ? !!item &&
        item.canTranscribe &&
        item.revision === editor.recording.revision &&
        item.transcripts[0]?.id === editor.recording.transcripts[0]?.id
      : data.canRecord && data.leadRevision === editor?.leadRevision);
  return (
    <>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("partnerDescription")}</p>
        <Button variant="outline" asChild>
          <Link to="/leads/$leadId" params={{ leadId }}>
            {t("lead")}
          </Link>
        </Button>
      </header>
      {editor && (
        <CommunicationEditor
          leadId={leadId}
          editor={editor}
          enabled={enabled}
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
      {list.isError || (selected && detail.isError) ? (
        <ErrorState
          title={t("changed")}
          description={t("reloadDescription")}
          retryLabel={t("reload")}
          pendingLabel={t("loading")}
          onRetry={reload}
        />
      ) : !data || (selected && !item) ? (
        <LoadingState label={t("loading")} />
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
          <h2 className="text-xl font-semibold">{t("recording")}</h2>
          <Badge>{t(`states.${item.state}`)}</Badge>
          <p>{t("advisor", { name: item.advisorName })}</p>
          <p>{t("validThrough", { date: formatDate(item.request.validUntil) })}</p>
          <p>{t("retainedThrough", { date: formatDate(item.request.retainUntil) })}</p>
          <p>{item.request.purposes.map((v) => t(`purposes.${v}`)).join(", ")}</p>
          <p className="whitespace-pre-wrap">{item.request.notice}</p>
          <p className="whitespace-pre-wrap">{item.request.sourceReference}</p>
          {item.canTranscribe && !before && (
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() =>
                  setEditor({
                    mode: "transcript",
                    leadRevision: data.leadRevision,
                    recording: item,
                  })
                }
              >
                {t(item.transcripts.length ? "correctTranscript" : "modes.transcript")}
              </Button>
              {item.transcripts.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditor({ mode: "task", leadRevision: data.leadRevision, recording: item })
                  }
                >
                  {t("modes.task")}
                </Button>
              )}
            </div>
          )}
          {!item.transcripts.length && (
            <p>{t(item.state === "allowed" ? "noTranscript" : "contentUnavailable")}</p>
          )}
          {item.transcripts.map((v) => (
            <section key={v.id} className="space-y-4 border-t border-border py-4">
              <h3 className="font-semibold">
                {t(v.revision === 1 ? "initialVersion" : "correctedVersion", {
                  revision: v.revision,
                })}
              </h3>
              <p>{t("contactAt", { date: formatDate(v.input.occurredAt) })}</p>
              <p>{t("savedAt", { date: formatDate(v.createdAt) })}</p>
              <p className="whitespace-pre-wrap">{v.input.sourceReference}</p>
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
            <section className="space-y-3">
              <h3 className="font-semibold">{t("tasks")}</h3>
              {item.tasks.map((task) => (
                <article key={task.id}>
                  <p>{task.title}</p>
                  <p>
                    {t(`taskStates.${task.state}`)}
                    {t("separator")}
                    {formatDate(task.dueAt)}
                  </p>
                </article>
              ))}
              <Button variant="outline" asChild>
                <Link to="/leads/$leadId" params={{ leadId }} search={{ tab: "tasks" }}>
                  {t("openTasks")}
                </Link>
              </Button>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{t("preferences")}</h2>
            <p>
              {data.preferences.channels
                ? data.preferences.channels.map((v) => t(`channels.${v}`)).join(", ")
                : t("notProvided")}
            </p>
            <p className="whitespace-pre-wrap">{data.preferences.note}</p>
            {data.preferences.confirmedAt && (
              <p>{t("confirmedAt", { date: formatDate(data.preferences.confirmedAt) })}</p>
            )}
          </section>
          {data.canRecord && (
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setEditor({ mode: "record", leadRevision: data.leadRevision })}
              >
                {t("modes.record")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditor({ mode: "request", leadRevision: data.leadRevision })}
              >
                {t("modes.request")}
              </Button>
            </div>
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{t("recordings")}</h2>
            {!data.recordings.length && <p>{t("noRecordings")}</p>}
            {data.recordings.map((r) => (
              <article
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
              >
                <div>
                  <p>{formatDate(r.createdAt)}</p>
                  <p>{t(`states.${r.state}`)}</p>
                </div>
                <Button variant="outline" onClick={() => setSelected(r.id)}>
                  {t("open")}
                </Button>
              </article>
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
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{t("records")}</h2>
            {!data.records.length && <p>{t("noRecords")}</p>}
            {data.records.map((r) => (
              <article key={r.id} className="space-y-2 border-t border-border py-4">
                <p className="font-medium">
                  {t(`channels.${r.input.channel}`)}
                  {t("separator")}
                  {formatDate(r.input.occurredAt)}
                </p>
                <p>
                  {r.authorName}
                  {t("separator")}
                  {t(`outcomes.${r.input.outcome}`)}
                </p>
                <p className="whitespace-pre-wrap">{r.input.summary}</p>
                <p>
                  {t("sourceReference")}
                  {t("separator")}
                  {r.input.sourceReference}
                </p>
                <p>
                  {r.input.nextAction}
                  {t("separator")}
                  {formatDate(r.input.dueAt)}
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
          </section>
        </>
      )}
    </>
  );
}
