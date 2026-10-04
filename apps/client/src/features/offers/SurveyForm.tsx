import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button, Label } from "@coverview/ui";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import {
  surveySchema,
  surveyPositiveSchema,
  surveyImprovementSchema,
  surveyResponseInputSchema,
} from "@coverview/contracts/partner-quality";
import { partnerApi } from "../../partner-api";
const schema = z
  .object({ ...surveyResponseInputSchema.shape, confirmed: z.boolean() })
  .pipe(surveyResponseInputSchema);
export function SurveyForm({
  identity,
  survey,
  onSaved,
}: {
  identity: IdentityMe;
  survey: z.infer<typeof surveySchema>;
  onSaved: () => void;
}) {
  const { t } = useTranslation("quality"),
    [step, setStep] = useState(0),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false);
  const attempt = useRef<{ input: z.output<typeof schema>; key: string } | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      experience: "overall",
      positives: [],
      improvements: [],
      comment: "",
      callbackRequested: false,
      confirmed: false,
    },
  });
  const rating = form.watch("rating"),
    locked = pending || !!attempt.current;
  async function send() {
    if (!attempt.current || pending || blocked || !survey.canRespond) return;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      await partnerApi.respondSurvey(survey.id, attempt.current.input, {
        csrfToken: identity.csrfToken,
        idempotencyKey: attempt.current.key,
        signal: controller.current.signal,
      });
      if (!controller.current.signal.aborted) {
        attempt.current = null;
        onSaved();
      }
    } catch (cause) {
      if (controller.current.signal.aborted) return;
      const definitive =
        cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
      setBlocked(definitive);
      setError(t(definitive ? "changed" : "uncertain"));
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  if (survey.response)
    return (
      <div className="space-y-5">
        <p className="text-xl font-semibold" role="status">
          {t("thanks")}
        </p>
        {survey.googleStatus === "available" && survey.googleReviewUrl && (
          <>
            <p>{t("googleInvitation")}</p>
            <Button asChild>
              <a href={survey.googleReviewUrl} target="_blank" rel="noopener noreferrer">
                {t("googleAction")}
              </a>
            </Button>
          </>
        )}
        {survey.googleStatus === "not_configured" && (
          <p className="text-muted-foreground">{t("googleUnavailable")}</p>
        )}
        {survey.response.callbackRequested && <p>{t("callbackSaved")}</p>}
      </div>
    );
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        void form.handleSubmit((input) => {
          attempt.current ??= { input, key: crypto.randomUUID() };
          void send();
        })(event);
      }}
    >
      <p className="text-sm text-muted-foreground">{survey.title}</p>
      <fieldset disabled={locked || blocked || !survey.canRespond} className="space-y-5">
        <legend className="text-lg font-semibold">{t("question")}</legend>
        {step === 0 ? (
          <>
            <div role="radiogroup" aria-label={t("rating")} className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input px-3"
                >
                  <input
                    type="radio"
                    value={value}
                    checked={rating === value}
                    onChange={() => {
                      form.setValue("rating", value);
                      form.setValue("positives", []);
                      form.setValue("improvements", []);
                      form.setValue("callbackRequested", false);
                    }}
                  />
                  {t("stars", { count: value })}
                </label>
              ))}
            </div>
            <Button type="button" disabled={!rating} onClick={() => setStep(1)}>
              {t("continue")}
            </Button>
          </>
        ) : (
          <>
            <p>{t("stars", { count: rating })}</p>
            <Label htmlFor="survey-experience">{t("experience")}</Label>
            <select
              id="survey-experience"
              {...form.register("experience")}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            >
              {["overall", "coverview", "advisor", "insurer"].map((v) => (
                <option key={v} value={v}>
                  {t(`experienceTypes.${v}`)}
                </option>
              ))}
            </select>
            <fieldset className="space-y-2">
              <legend className="mb-3 font-medium">
                {t(rating === 5 ? "positiveQuestion" : "improvementQuestion")}
              </legend>
              {(rating === 5 ? surveyPositiveSchema.options : surveyImprovementSchema.options).map(
                (value) => (
                  <label key={value} className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      value={value}
                      {...form.register(rating === 5 ? "positives" : "improvements")}
                    />
                    {t(`${rating === 5 ? "positive" : "improvement"}.${value}`)}
                  </label>
                ),
              )}
            </fieldset>
            <Label htmlFor="survey-comment">{t("comment")}</Label>
            <textarea
              id="survey-comment"
              {...form.register("comment")}
              maxLength={2000}
              rows={4}
              className="w-full rounded-md border border-input bg-background p-3"
            />
            {rating < 5 && (
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" {...form.register("callbackRequested")} />
                {t("callback")}
              </label>
            )}
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" {...form.register("confirmed")} />
              {t("shareResponse")}
            </label>
            {Object.keys(form.formState.errors).length > 0 && <p role="alert">{t("invalid")}</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                {t("back")}
              </Button>
              <Button type="submit">{t("sendResponse")}</Button>
            </div>
          </>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {attempt.current && !blocked && (
        <Button type="button" disabled={pending} onClick={() => void send()}>
          {t(pending ? "saving" : "retryExact")}
        </Button>
      )}
    </form>
  );
}
