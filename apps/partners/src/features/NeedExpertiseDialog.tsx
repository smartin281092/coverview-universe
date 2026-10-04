import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { NeedExpertiseEvidence, NeedExpertiseDossier } from "@coverview/contracts/partner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { CompetenceDialog } from "./CompetenceDialog";
import { NeedExpertiseEvidenceDetails } from "./NeedExpertiseEvidenceDetails";
import { NeedExpertisePanel } from "./NeedExpertisePanel";
import { formatDate } from "./Field";

export function NeedExpertiseDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner();
  const [decision, setDecision] = useState(false),
    [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [dossier, setDossier] = useState<{
    userId: string;
    category: NeedExpertiseEvidence["scope"]["category"];
  } | null>(null);
  const query = useQuery({
    queryKey: [...session.queryKey, "need-expertise-evidence", leadId],
    queryFn: ({ signal }) => partnerApi.needExpertiseEvidence(leadId, signal),
    enabled: !dossier && !decision,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  // The personal category dossier has its own audience, lifecycle and fresh authorization.
  if (dossier)
    return (
      <CompetenceDialog
        userId={dossier.userId}
        initialCategory={dossier.category}
        onClose={() => {
          setReturning(true);
          setDossier(null);
          void query.refetch().finally(() => setReturning(false));
        }}
      />
    );
  const value = query.isError ? undefined : query.data,
    openDossier = (current: NeedExpertiseDossier) => {
      setDecision(false);
      setDossier({ userId: current.advisorId, category: current.scope.category });
    };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
        closeLabel={t("close")}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("needExpertise.title")}</DialogTitle>
          <DialogDescription>{t("needExpertise.privacy")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (decision) {
                setDecision(false);
                setReturning(true);
                void query.refetch().finally(() => setReturning(false));
              } else onClose();
            }}
          >
            {t("advisorAssessment.back")}
          </Button>
          <Button
            variant="outline"
            disabled={query.isFetching || busy || decision}
            onClick={() => void query.refetch()}
          >
            {t(query.isFetching ? "loading" : "advisorAssessment.refresh")}
          </Button>
        </div>
        {decision ? (
          <NeedExpertisePanel leadId={leadId} onBusy={setBusy} onDossier={openDossier} />
        ) : query.isPending || returning ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("needExpertise.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          value && (
            <>
              <p className="text-xs text-muted-foreground">
                {t("advisorAssessment.at", { date: formatDate(value.assessedAt) })}
              </p>
              {value.changeRequested && (
                <p role="status" className="text-sm font-medium">
                  {t("advisorAssessment.changeRequested")}
                </p>
              )}
              <NeedExpertiseEvidenceDetails
                value={value}
                onDossier={() =>
                  setDossier({ userId: value.advisorId, category: value.scope.category })
                }
              />
              <section className="space-y-2 text-sm">
                <h3 className="font-medium">{t("needExpertise.reviewTitle")}</h3>
                <p>{t("needExpertise.review")}</p>
                <Button onClick={() => setDecision(true)}>{t("needExpertiseDecision.open")}</Button>
                <p className="text-muted-foreground">{t("needExpertise.limits")}</p>
              </section>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
