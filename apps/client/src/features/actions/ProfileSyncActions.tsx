import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import type { DocumentSynchronization } from "@coverview/contracts";
import { Button } from "@coverview/ui";

export function ProfileSyncActions({
  synchronizations,
  pending,
  onReview,
}: {
  synchronizations: DocumentSynchronization[];
  pending: boolean;
  onReview: (item: DocumentSynchronization) => void;
}) {
  const { t } = useTranslation("actions");
  const { t: fields } = useTranslation("documents");
  return (
    <section className="space-y-4" aria-labelledby="profile-synchronizations">
      <div className="space-y-2">
        <h2 id="profile-synchronizations" className="cv-app-subheading">
          {t("synchronizationsTitle")}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("synchronizationsDescription")}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {synchronizations.map((item) => (
          <li key={item.id} className="grid gap-5 py-6 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="font-medium">
                {item.group.labelKey === "address"
                  ? t("groups.address")
                  : fields(`field.${item.group.labelKey}`)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("profile", { name: item.profileName })}
              </p>
              <Link
                to="/documents/$documentId"
                params={{ documentId: item.documentId }}
                className="inline-flex min-h-11 items-center break-words text-sm text-indigo-600 underline underline-offset-4"
              >
                {item.documentTitle}
              </Link>
            </div>
            <dl className="space-y-2 text-sm">
              {item.group.fields.map((field) => (
                <div key={field.extractionId} className="grid grid-cols-2 gap-3">
                  <dt className="text-muted-foreground">{fields(`field.${field.field}`)}</dt>
                  <dd className="break-words font-medium">{field.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-start md:justify-end">
              <Button className="min-h-11" disabled={pending} onClick={() => onReview(item)}>
                {t("verifySource")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
