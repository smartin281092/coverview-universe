import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, FileText, FolderOpen, Upload, X } from "lucide-react";
import type { DocumentSummary } from "@coverview/contracts";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@coverview/ui";

export type IdentityAttachmentSide = "combined" | "front" | "back";

export function IdentityAttachmentSource({
  side,
  file,
  document,
  available,
  disabled,
  loading,
  error,
  portalContainer,
  onFile,
  onExisting,
  onClear,
}: {
  side: IdentityAttachmentSide;
  file?: File | undefined;
  document?: DocumentSummary | undefined;
  available: DocumentSummary[];
  disabled: boolean;
  loading: boolean;
  error?: string | undefined;
  portalContainer: HTMLDivElement | null;
  onFile: (file: File) => void;
  onExisting: (document: DocumentSummary) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("authorizations");
  const { t: td } = useTranslation("documents");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const options =
    document && !available.some((item) => item.id === document.id)
      ? [document, ...available]
      : available;
  const receive = (input: HTMLInputElement) => {
    const selected = input.files?.[0];
    if (selected) onFile(selected);
    input.value = "";
  };
  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-medium">
          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
          {t(`identityPiece.side.${side}`)}
        </h3>
        {(file || document) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={disabled}
            onClick={onClear}
            aria-label={t("identityPiece.clear", { side: t(`identityPiece.side.${side}`) })}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {preview && (
        <img
          src={preview}
          alt={t("identityPiece.preview", { side: t(`identityPiece.side.${side}`) })}
          className="max-h-40 w-full rounded-lg object-contain"
        />
      )}
      {(file || document) && (
        <div className="min-w-0 space-y-1 text-sm">
          <p className="break-words font-medium">{document?.name ?? file?.name}</p>
          <p className="text-xs text-muted-foreground">
            {document ? td(`state.${document.state}`) : t("identityPiece.selectedFile")}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" />
          {t("identityPiece.chooseFile")}
        </Button>
        {side !== "combined" && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => cameraInput.current?.click()}
          >
            <Camera className="size-4" aria-hidden="true" />
            {t("identityPiece.takePhoto")}
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled}
        aria-label={t("identityPiece.chooseFor", { side: t(`identityPiece.side.${side}`) })}
        onChange={(event) => receive(event.currentTarget)}
      />
      {side !== "combined" && (
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          aria-label={t("identityPiece.photoFor", { side: t(`identityPiece.side.${side}`) })}
          onChange={(event) => receive(event.currentTarget)}
        />
      )}
      <div className="space-y-2">
        <Label htmlFor={`identity-existing-${side}`}>
          <FolderOpen className="size-4" aria-hidden="true" />
          {t("identityPiece.existing")}
        </Label>
        <Select
          value={document?.id ?? ""}
          disabled={disabled || loading || options.length === 0}
          onValueChange={(id) => {
            const selected = options.find((item) => item.id === id);
            if (selected) onExisting(selected);
          }}
        >
          <SelectTrigger id={`identity-existing-${side}`} className="min-h-11 w-full text-sm">
            <SelectValue
              placeholder={t(
                loading ? "identityPiece.loadingExisting" : "identityPiece.chooseExisting",
              )}
            />
          </SelectTrigger>
          <SelectContent portalContainer={portalContainer}>
            {options.map((item) => (
              <SelectItem key={item.id} value={item.id} className="whitespace-normal break-words">
                {item.title && item.title !== item.name
                  ? t("identityPiece.existingOption", { title: item.title, name: item.name })
                  : item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
