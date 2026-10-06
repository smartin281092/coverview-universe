import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProfileImage } from "@coverview/contracts/partner-profiles";
import { Button } from "@coverview/ui";
import { PictureError, pictureTypes, preparePicture, type PreparedPicture } from "./picture-file";

export type PictureChoice =
  { mode: "keep" } | { mode: "remove" } | { mode: "file"; picture: PreparedPicture };
export const choiceInput = (choice: PictureChoice) =>
  choice.mode === "file" ? choice.picture.input : choice.mode;

// Choice of the picture of a new version (C8c): keep the current one, remove it or prepare a new
// one; the preview shows exactly the bytes that will be sent.
export function PicturePicker({
  kind,
  current,
  currentUrl,
  choice,
  onChange,
}: {
  kind: "photo" | "logo";
  current: ProfileImage | null;
  currentUrl: string | null;
  choice: PictureChoice;
  onChange: (choice: PictureChoice) => void;
}) {
  const { t } = useTranslation("profiles"),
    inputId = useId(),
    [error, setError] = useState<PictureError["code"] | null>(null);
  useEffect(
    () => () => {
      if (choice.mode === "file") URL.revokeObjectURL(choice.picture.url);
    },
    [choice],
  );
  const preview =
    choice.mode === "file" ? choice.picture.url : choice.mode === "keep" ? currentUrl : null;
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 font-medium">{t(`pictures.${kind}.label`)}</legend>
      <p className="text-xs text-muted-foreground">{t(`pictures.${kind}.help`)}</p>
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          <img
            src={preview}
            alt={t(`pictures.${kind}.preview`)}
            className={
              kind === "photo"
                ? "size-20 rounded-full object-cover"
                : "h-12 w-auto max-w-40 object-contain"
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("pictures.none")}</p>
        )}
        <div className="space-y-2 text-sm">
          {current && (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${kind}-choice`}
                  checked={choice.mode === "keep"}
                  onChange={() => onChange({ mode: "keep" })}
                />
                {t("pictures.keep")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${kind}-choice`}
                  checked={choice.mode === "remove"}
                  onChange={() => onChange({ mode: "remove" })}
                />
                {t("pictures.remove")}
              </label>
            </>
          )}
          <label htmlFor={inputId} className="block font-medium">
            {t("pictures.choose")}
          </label>
          <input
            id={inputId}
            type="file"
            accept={pictureTypes.join(",")}
            className="block text-sm"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              setError(null);
              preparePicture(file, kind)
                .then((picture) => onChange({ mode: "file", picture }))
                .catch((cause: unknown) =>
                  setError(cause instanceof PictureError ? cause.code : "image"),
                );
            }}
          />
          {choice.mode === "file" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ mode: "keep" })}
            >
              {t("pictures.discard")}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`pictures.errors.${error}`)}
        </p>
      )}
    </fieldset>
  );
}

/** Where the picture of the latest version stands, with the action it allows. */
export function PictureState({
  image,
  pending,
  onSend,
  onRetry,
}: {
  image: ProfileImage | null;
  pending: boolean;
  onSend: (() => void) | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation("profiles");
  if (!image) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p className="text-muted-foreground">{t(`pictures.state.${image.state}`)}</p>
      {image.canUpload && onSend && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onSend}>
          {t("pictures.send")}
        </Button>
      )}
      {image.canRetry && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRetry}>
          {t("pictures.retry")}
        </Button>
      )}
    </div>
  );
}
