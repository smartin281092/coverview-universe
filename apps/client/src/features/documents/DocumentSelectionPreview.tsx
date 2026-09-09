import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@coverview/ui";
import { IdentityPreviewCanvas } from "./IdentityPreviewCanvas";
import { photoTypes } from "./document-upload-file";

export type SelectedDocumentFile = { id: string; file: File; url: string };

export function DocumentSelectionPreview({
  files,
  selectedId,
  onSelect,
  onClose,
  portalContainer,
}: {
  files: readonly SelectedDocumentFile[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  portalContainer: HTMLDivElement | null;
}) {
  const { t } = useTranslation("documents");
  const index = files.findIndex((file) => file.id === selectedId);
  const selected = files[index];
  if (!selected || !portalContainer) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        portalContainer={portalContainer}
        className="flex h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-4 sm:max-w-5xl sm:p-6"
      >
        <div className="flex shrink-0 justify-between gap-3">
          <DialogHeader className="min-w-0 text-left">
            <DialogTitle className="break-words">{selected.file.name}</DialogTitle>
            <DialogDescription>
              {t("capture.position", { index: index + 1, count: files.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label={t("close")}
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {photoTypes.has(selected.file.type) ? (
            <IdentityPreviewCanvas
              key={selected.id}
              images={[
                { document: { id: selected.id, name: selected.file.name }, url: selected.url },
              ]}
              generic
            />
          ) : selected.file.type === "application/pdf" ? (
            <>
              <iframe
                title={selected.file.name}
                src={selected.url}
                sandbox=""
                className="min-h-64 w-full flex-1 rounded-xl border border-border"
              />
              <p className="mt-3 text-sm text-muted-foreground">{t("capture.pdfHelp")}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("capture.unsupportedPreview")}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline">
            <a href={selected.url} download={selected.file.name}>
              <Download aria-hidden="true" />
              {t("download")}
            </a>
          </Button>
          {files.length > 1 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11"
                disabled={index === 0}
                aria-label={t("capture.previous")}
                onClick={() => {
                  const item = files[index - 1];
                  if (item) onSelect(item.id);
                }}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11"
                disabled={index === files.length - 1}
                aria-label={t("capture.next")}
                onClick={() => {
                  const item = files[index + 1];
                  if (item) onSelect(item.id);
                }}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
