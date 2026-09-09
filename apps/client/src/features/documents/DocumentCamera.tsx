import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, X } from "lucide-react";
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

export function DocumentCamera({
  count,
  onPhoto,
  onClose,
  onNativeCamera,
  portalContainer,
  maximum,
  error,
}: {
  count: number;
  maximum: number;
  onPhoto: (file: File) => boolean;
  error?: string | undefined;
  onClose: () => void;
  onNativeCamera: () => void;
  portalContainer: HTMLDivElement | null;
}) {
  const { t } = useTranslation("documents");
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [taking, setTaking] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<Blob>();
  const [thumbnail, setThumbnail] = useState<string>();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    let disposed = false;
    let stream: MediaStream | undefined;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
        const opened = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 3072 },
          },
        });
        if (disposed) {
          for (const track of opened.getTracks()) track.stop();
          return;
        }
        stream = opened;
        if (video.current) {
          video.current.srcObject = opened;
          await video.current.play();
        }
        if (!disposed) setState("ready");
      } catch {
        for (const track of stream?.getTracks() ?? []) track.stop();
        if (!disposed) setState("unavailable");
      }
    }
    void start();
    return () => {
      active.current = false;
      disposed = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, []);
  useEffect(() => {
    if (!lastPhoto) return;
    const url = URL.createObjectURL(lastPhoto);
    setThumbnail(url);
    return () => URL.revokeObjectURL(url);
  }, [lastPhoto]);
  async function takePhoto() {
    const element = video.current;
    if (!element?.videoWidth || taking || count >= maximum) return;
    setTaking(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Camera unavailable");
      context.drawImage(element, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95),
      );
      canvas.width = 0;
      canvas.height = 0;
      if (!blob || !active.current) return;
      const accepted = onPhoto(
        new File([blob], `${t("capture.photoName", { index: count + 1 })}.jpg`, {
          type: "image/jpeg",
        }),
      );
      if (accepted) setLastPhoto(blob);
    } catch {
      if (active.current) setState("unavailable");
    } finally {
      if (active.current) setTaking(false);
    }
  }
  if (!portalContainer) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        portalContainer={portalContainer}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto p-4 sm:max-w-3xl sm:p-6"
      >
        <div className="flex justify-between gap-3">
          <DialogHeader className="text-left">
            <DialogTitle>{t("capture.cameraTitle")}</DialogTitle>
            <DialogDescription>{t("capture.cameraHelp")}</DialogDescription>
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
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label={t("capture.cameraView")}
          className={
            state === "unavailable"
              ? "hidden"
              : "aspect-[4/3] max-h-[60dvh] w-full rounded-xl bg-muted object-contain"
          }
        />
        {state === "loading" && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("capture.cameraLoading")}
          </p>
        )}
        {state === "unavailable" && (
          <div role="status" className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("capture.cameraUnavailable")}</p>
            <Button type="button" variant="outline" onClick={onNativeCamera}>
              <ImagePlus aria-hidden="true" />
              {t("capture.nativeCamera")}
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3" aria-live="polite">
          {thumbnail && (
            <img
              src={thumbnail}
              alt={t("capture.lastPhoto")}
              className="size-16 rounded-lg border border-border object-cover"
            />
          )}
          <p className="text-sm">{t("capture.count", { count })}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="min-h-11 flex-1"
            disabled={state !== "ready" || taking || count >= maximum}
            onClick={() => void takePhoto()}
          >
            <Camera aria-hidden="true" />
            {t("capture.take")}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            <Check aria-hidden="true" />
            {t("capture.done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
