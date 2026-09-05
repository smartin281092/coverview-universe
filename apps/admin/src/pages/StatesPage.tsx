import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AccessDeniedState,
  Button,
  LoadingState,
  NotFoundState,
  SessionExpiredState,
} from "@coverview/ui";

export function StatesPage() {
  const { t } = useTranslation();
  if (!import.meta.env.DEV)
    return (
      <AccessDeniedState
        title={t("stateExamples.localOnly")}
        description={t("stateExamples.localOnlyDescription")}
      />
    );
  const action = (
    <Button asChild>
      <Link to="/">{t("stateExamples.home")}</Link>
    </Button>
  );
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("stateExamples.title")}</h1>
        <p className="text-muted-foreground">{t("stateExamples.description")}</p>
      </div>
      <LoadingState label={t("stateExamples.loading")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AccessDeniedState
          title={t("stateExamples.denied")}
          description={t("stateExamples.deniedDescription")}
          action={action}
        />
        <SessionExpiredState
          title={t("stateExamples.expired")}
          description={t("stateExamples.expiredDescription")}
          action={action}
        />
      </div>
    </>
  );
}

export function MissingPage() {
  const { t } = useTranslation();
  return (
    <NotFoundState
      title={t("stateExamples.notFound")}
      description={t("stateExamples.notFoundDescription")}
      action={
        <Button asChild>
          <Link to="/">{t("stateExamples.home")}</Link>
        </Button>
      }
    />
  );
}
