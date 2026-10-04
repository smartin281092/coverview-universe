import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Badge, Label } from "@coverview/ui";
import type { LeadDetail } from "@coverview/contracts/partner";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";

type Person = { id: string; name: string; organization: string };

// Ranked proposal for an Admin assignment. The person stays a human choice; leaving the first
// eligible candidate turns the mandatory reason into a documented deviation.
export function MatchingAssignment({ lead, directory }: { lead: LeadDetail; directory: Person[] }) {
  const { t } = useTranslation("matching"),
    session = usePartner(),
    reasonId = useId(),
    otherId = useId();
  const matching = useQuery({
    queryKey: [...session.queryKey, "lead-matching", lead.id, lead.revision],
    queryFn: ({ signal }) => partnerApi.leadMatching(lead.id, signal),
    gcTime: 0,
    retry: false,
  });
  const candidates = matching.data?.candidates ?? [];
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const selected = choice ?? candidates[0]?.userId ?? "other";
  const responsibleId = selected === "other" ? other : selected;
  const deviation = selected !== candidates[0]?.userId;
  const excluded = matching.data?.excluded.reduce((total, e) => total + e.count, 0) ?? 0;
  const last = matching.data?.decisions[0];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("notice")}</p>
      <input type="hidden" name="responsibleId" value={responsibleId} />
      {matching.data && <input type="hidden" name="matchingBasis" value={matching.data.basis} />}
      {matching.isPending && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("loading")}
        </p>
      )}
      {matching.isError && (
        <p className="text-sm text-destructive" role="alert">
          {t("error")}
        </p>
      )}
      {matching.data && (
        <div className="space-y-2 text-sm">
          <p>{t("summary", { evaluated: matching.data.evaluated, excluded })}</p>
          {matching.data.truncated && <p className="text-muted-foreground">{t("truncated")}</p>}
          {matching.data.excluded.length > 0 && (
            <ul className="text-muted-foreground" aria-label={t("excludedTitle")}>
              {matching.data.excluded.map((e) => (
                <li key={e.reason}>
                  {t(`excluded.${e.reason}`)}
                  {" : "}
                  {e.count}
                </li>
              ))}
            </ul>
          )}
          {last && (
            <p className="text-muted-foreground">
              {t("lastDecision", { name: last.chosenName, kind: t(`kind.${last.kind}`) })}
              {last.deviation ? t("deviation") : ""}
            </p>
          )}
        </div>
      )}
      {matching.data && candidates.length === 0 && (
        <p className="rounded-md border border-dashed p-3 text-sm" role="status">
          {t("none")}
        </p>
      )}
      <fieldset className="space-y-2">
        {candidates.map((candidate) => (
          <label
            key={candidate.userId}
            className="flex cursor-pointer gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input
              type="radio"
              name="matchingChoice"
              value={candidate.userId}
              checked={selected === candidate.userId}
              onChange={() => setChoice(candidate.userId)}
              className="mt-1"
            />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{candidate.name}</span>
                <span className="text-sm text-muted-foreground">{candidate.organization}</span>
                <span className="text-xs text-muted-foreground">
                  {t("rank", { rank: candidate.rank })}
                  {" · "}
                  {t("load", { count: candidate.activeLeads })}
                </span>
              </span>
              <span className="flex flex-wrap gap-1">
                {candidate.reasons.map((reason) => (
                  <Badge key={reason} variant="secondary">
                    {t(`reasons.${reason}`)}
                  </Badge>
                ))}
                {candidate.caveats.map((caveat) => (
                  <Badge key={caveat} variant="outline">
                    {t(`caveats.${caveat}`)}
                  </Badge>
                ))}
              </span>
            </span>
          </label>
        ))}
        <label className="flex cursor-pointer gap-3 rounded-md border p-3 has-[:checked]:border-primary">
          <input
            type="radio"
            name="matchingChoice"
            value="other"
            checked={selected === "other"}
            onChange={() => setChoice("other")}
            className="mt-1"
          />
          <span className="text-sm">{t("other")}</span>
        </label>
      </fieldset>
      {selected === "other" && (
        <div className="space-y-2">
          <Label htmlFor={otherId}>{t("otherPerson")}</Label>
          <select
            id={otherId}
            value={other}
            required
            onChange={(event) => setOther(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{"—"}</option>
            {directory.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {" · "}
                {person.organization}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={reasonId}>{deviation ? t("reasonDeviation") : t("reasonTop")}</Label>
        {deviation && <p className="text-xs text-muted-foreground">{t("deviationNotice")}</p>}
        <textarea
          id={reasonId}
          name="note"
          required
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
