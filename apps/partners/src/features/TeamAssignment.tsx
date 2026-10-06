import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@coverview/ui";
import type { LeadDetail } from "@coverview/contracts/partner";
import { usePartner } from "./PartnerSession";
import { partnerApi } from "../api";

// Reassignment by the manager within their own team (C8b). The list only helps the choice: the
// server checks the organisation, the eligibility and the restrictions again.
export function TeamAssignment({ lead }: { lead: LeadDetail }) {
  const { t } = useTranslation("team"),
    session = usePartner(),
    reasonId = useId();
  const team = useQuery({
    queryKey: [...session.queryKey, "team"],
    queryFn: ({ signal }) => partnerApi.team(signal),
    gcTime: 0,
  });
  const colleagues =
    team.data?.members.filter(
      (member) =>
        member.state === "approved" &&
        member.grantedRoles.includes("advisor") &&
        member.categories.includes(lead.category) &&
        !member.restrictions.newLeads &&
        !member.restrictions.categories.includes(lead.category) &&
        member.userId !== lead.responsibleId,
    ) ?? [];
  const [choice, setChoice] = useState<string | null>(null);
  const selected = choice ?? colleagues[0]?.userId ?? "";
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("assignment.notice")}</p>
      <input type="hidden" name="responsibleId" value={selected} />
      {team.isPending && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("partner:loading")}
        </p>
      )}
      {team.isError && (
        <p className="text-sm text-destructive" role="alert">
          {t("partner:error")}
        </p>
      )}
      {team.data && colleagues.length === 0 && (
        <p className="rounded-md border border-dashed p-3 text-sm" role="status">
          {t("assignment.none")}
        </p>
      )}
      {colleagues.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t("assignment.colleague")}</legend>
          {colleagues.map((member) => (
            <label
              key={member.userId}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="teamChoice"
                value={member.userId}
                checked={selected === member.userId}
                onChange={() => setChoice(member.userId)}
              />
              <span className="flex-1">{member.name}</span>
              <span className="text-xs text-muted-foreground">
                {t("load", { active: member.activeLeads, overdue: member.overdueLeads })}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="space-y-2">
        <Label htmlFor={reasonId}>{t("assignment.reason")}</Label>
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
