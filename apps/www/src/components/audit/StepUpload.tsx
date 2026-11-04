import { useRef, useState, type DragEvent } from "react";
import { Check, FileText, Upload } from "lucide-react";
import { auditCopy as copy } from "../../content/fr/audit";
import { readContractFile, type ContractReading, type ReadStatus } from "./contract-reader";
import { chf } from "./format";
import { providerById } from "./strategies";

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; name: string }
  | { kind: "done"; status: ReadStatus; reading?: ContractReading; name: string };

/**
 * Première question : déposer son contrat PDF, lu localement, ou passer. Les repères trouvés sont
 * listés et confirmés aux étapes suivantes ; une image ou un échec mène aux questions.
 */
export function StepUpload({
  onRead,
  onSkip,
}: {
  onRead: (reading: ContractReading) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const read = (file: File | undefined) => {
    if (!file) return;
    setPhase({ kind: "reading", name: file.name });
    void readContractFile(file).then((result) => {
      setPhase({
        kind: "done",
        status: result.status,
        name: file.name,
        ...(result.reading ? { reading: result.reading } : {}),
      });
    });
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setOver(false);
    read(event.dataTransfer.files[0]);
  };
  const t = copy.steps.upload;
  const status = phase.kind === "done" ? phase.status : null;
  const reading = phase.kind === "done" ? phase.reading : undefined;
  const providerLabel = reading?.provider ? providerById(reading.provider)?.label : undefined;
  const detected: { label: string; value: string }[] = [];
  if (reading) {
    if (providerLabel) detected.push({ label: t.detected.provider, value: providerLabel });
    if (reading.monthly)
      detected.push({ label: t.detected.monthly, value: `${chf(reading.monthly)} CHF` });
    if (reading.startYear)
      detected.push({ label: t.detected.startYear, value: String(reading.startYear) });
    if (reading.birthYear)
      detected.push({ label: t.detected.birthYear, value: String(reading.birthYear) });
  }
  return (
    <div className="audit-upload">
      {phase.kind !== "done" && (
        <label
          className={`audit-dropzone ${over ? "is-over" : ""} ${phase.kind === "reading" ? "is-busy" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf,image/*"
            className="audit-file"
            onChange={(event) => read(event.target.files?.[0])}
          />
          <span className="audit-dropzone-icon" aria-hidden="true">
            {phase.kind === "reading" ? <span className="audit-spinner" /> : <Upload />}
          </span>
          <span className="audit-dropzone-title">
            {phase.kind === "reading" ? t.reading : t.drop}
          </span>
          <span className="audit-dropzone-hint">
            {phase.kind === "reading" ? phase.name : t.dropHint}
          </span>
          {phase.kind === "idle" && <span className="audit-chip audit-chip-solid">{t.choose}</span>}
        </label>
      )}
      {phase.kind === "done" && (
        <div className="audit-read" role="status">
          <p className="audit-read-title">
            <FileText aria-hidden="true" />
            <span>{status === "ok" ? t.read : phase.name}</span>
          </p>
          {status === "ok" && detected.length > 0 ? (
            <>
              <p className="audit-read-lead">{t.found}</p>
              <ul className="audit-read-list">
                {detected.map((item) => (
                  <li key={item.label}>
                    <Check aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </li>
                ))}
              </ul>
              <p className="audit-read-note">{t.confirm}</p>
              <div className="audit-actions">
                <button
                  type="button"
                  className="audit-next"
                  onClick={() => reading && onRead(reading)}
                >
                  {t.continue}
                </button>
                <button type="button" className="audit-secondary" onClick={onSkip}>
                  {t.skip}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="audit-read-lead">
                {status === "image"
                  ? t.image
                  : status === "too-big"
                    ? t.tooBig
                    : status === "failed"
                      ? t.failed
                      : t.nothing}
              </p>
              <div className="audit-actions">
                <button type="button" className="audit-next" onClick={onSkip}>
                  {copy.nav.next}
                </button>
                <button
                  type="button"
                  className="audit-secondary"
                  onClick={() => {
                    setPhase({ kind: "idle" });
                    window.setTimeout(() => input.current?.click(), 0);
                  }}
                >
                  {t.choose}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {phase.kind === "idle" && (
        <div className="audit-upload-alt">
          <span className="audit-or">{t.or}</span>
          <button type="button" className="audit-secondary audit-secondary-strong" onClick={onSkip}>
            {t.skip}
          </button>
        </div>
      )}
      <p className="audit-privacy">{t.privacy}</p>
    </div>
  );
}
