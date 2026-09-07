import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { api } from "../../api";

export function ProfileDocumentDifferences({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("documents");
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "profile-differences"],
    queryFn: ({ signal }) => api.documentProfileDifferences({ signal }),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  if (!query.data?.fields.length) return null;
  return (
    <aside
      className="max-w-3xl space-y-3 rounded-xl bg-amber-50 p-5 text-amber-950"
      aria-label={t("requests.profileDifferences")}
    >
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
        {t("requests.profileDifferences")}
      </p>
      <p className="text-sm">{t("requests.profileHelp")}</p>
      <ul className="flex flex-wrap gap-2">
        {query.data.fields.map((item) => (
          <li key={item.field}>
            <Link
              to="/documents/$documentId"
              params={{ documentId: item.documentId }}
              className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 px-3 text-sm font-medium underline underline-offset-4"
            >
              {t("requests.fieldCount", { field: t(`field.${item.field}`), count: item.count })}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
