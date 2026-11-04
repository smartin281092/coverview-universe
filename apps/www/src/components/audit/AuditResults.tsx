import { useState } from "react";
import { History, Info, Scale, TrendingUp } from "lucide-react";
import { auditCopy as copy } from "../../content/fr/audit";
import type { Answers } from "./audit-state";
import type { AuditReport } from "./audit-compute";
import { AssumptionsDialog } from "./AssumptionsDialog";
import { CompareTab } from "./CompareTab";
import { HistoryTab } from "./HistoryTab";
import { LineTabs, type LineTab } from "./LineTabs";
import { ProjectionTab } from "./ProjectionTab";
import { ResultsHero } from "./ResultsHero";
import { SynthesisTab } from "./SynthesisTab";

type Tab = "synthesis" | "compare" | "history" | "projection";
const tabs: readonly LineTab<Tab>[] = [
  { id: "synthesis", label: copy.results.tabs.synthesis, icon: Info, color: "#2563eb" },
  { id: "compare", label: copy.results.tabs.compare, icon: Scale, color: "#fb923c" },
  { id: "history", label: copy.results.tabs.history, icon: History, color: "#14b8a6" },
  { id: "projection", label: copy.results.tabs.projection, icon: TrendingUp, color: "#8b5cf6" },
];

/** La page d’audit : le bandeau, puis quatre onglets ; les hypothèses dans un dialogue. */
export default function AuditResults({
  report,
  answers,
  busy,
  error,
  walletUrl,
  onRevise,
  onRestart,
}: {
  report: AuditReport;
  answers: Answers;
  busy: boolean;
  error: string | null;
  walletUrl: string;
  onRevise: (answers: Answers) => void;
  onRestart: () => void;
}) {
  const [tab, setTab] = useState<Tab>("synthesis");
  const [assumptions, setAssumptions] = useState(false);
  const openCompare = () => {
    setTab("compare");
    document
      .getElementById("audit-tab-compare")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  return (
    <div className="audit-results" aria-busy={busy}>
      <ResultsHero
        report={report}
        answers={answers}
        onRestart={onRestart}
        onOpenAssumptions={() => setAssumptions(true)}
      />
      <div className="audit-container audit-results-body">
        {error && (
          <p className="audit-error audit-error-banner" role="alert">
            {error}
          </p>
        )}
        <LineTabs tabs={tabs} value={tab} label={copy.results.eyebrow} onChange={setTab} />
        <div className={`audit-tab-panels ${busy ? "is-busy" : ""}`}>
          {tabs.map(({ id }) => (
            <div
              key={id}
              role="tabpanel"
              id={`audit-panel-${id}`}
              aria-labelledby={`audit-tab-${id}`}
              hidden={tab !== id}
              tabIndex={0}
            >
              {tab === id &&
                (id === "synthesis" ? (
                  <SynthesisTab
                    report={report}
                    answers={answers}
                    walletUrl={walletUrl}
                    onCompare={openCompare}
                  />
                ) : id === "compare" ? (
                  <CompareTab report={report} answers={answers} onRevise={onRevise} />
                ) : id === "history" ? (
                  <HistoryTab report={report} />
                ) : (
                  <ProjectionTab report={report} />
                ))}
            </div>
          ))}
        </div>
      </div>
      {assumptions && (
        <AssumptionsDialog
          open={assumptions}
          answers={answers}
          onClose={() => setAssumptions(false)}
          onApply={onRevise}
        />
      )}
    </div>
  );
}
