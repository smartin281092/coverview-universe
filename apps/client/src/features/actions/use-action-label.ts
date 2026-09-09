import { useTranslation } from "react-i18next";
import type { ActionCenterItem } from "@coverview/contracts";

export function useActionLabel() {
  const { t } = useTranslation("actions");
  const { t: profile } = useTranslation("profile");
  return (action: Pick<ActionCenterItem, "kind" | "topic">) => {
    if (action.kind === "authorization")
      return t(`requirements.${action.topic.replace(/^authorization:/, "")}`, {
        defaultValue: t("kinds.authorization"),
      });
    return t(`groups.${action.topic}`, {
      defaultValue: profile(`fields.${action.topic}`, { defaultValue: t(`kinds.${action.kind}`) }),
    });
  };
}
