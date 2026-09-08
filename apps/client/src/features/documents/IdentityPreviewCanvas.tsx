import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@coverview/ui";

type ImageAsset = { document: { id: string; name: string }; url: string };
type Point = { x: number; y: number };
type View = Point & { scale: number };
type Size = { width: number; height: number };
const initialView: View = { x: 0, y: 0, scale: 1 };
const maximumZoom = 8;

// Maximize visible image area, rather than choosing an orientation by breakpoint alone.
function fitImages(ratios: number[], viewport: Size, gap: number) {
  const width = Math.max(1, viewport.width - gap * 2);
  const height = Math.max(1, viewport.height - gap * 2);
  const gaps = gap * Math.max(0, ratios.length - 1);
  const ratioSum = ratios.reduce((sum, ratio) => sum + ratio, 0);
  const inverseSum = ratios.reduce((sum, ratio) => sum + 1 / ratio, 0);
  const rowHeight = Math.max(1, Math.min(height, (width - gaps) / ratioSum));
  const columnWidth = Math.max(1, Math.min(width, (height - gaps) / inverseSum));
  const horizontal = rowHeight ** 2 * ratioSum >= columnWidth ** 2 * inverseSum;
  let position = 0;
  const frames = ratios.map((ratio) => {
    const frameWidth = horizontal ? rowHeight * ratio : columnWidth;
    const frameHeight = horizontal ? rowHeight : columnWidth / ratio;
    const frame = {
      width: frameWidth,
      height: frameHeight,
      left: horizontal ? position : 0,
      top: horizontal ? 0 : position,
    };
    position += (horizontal ? frameWidth : frameHeight) + gap;
    return frame;
  });
  return {
    frames,
    width: horizontal ? Math.max(1, position - gap) : columnWidth,
    height: horizontal ? rowHeight : Math.max(1, position - gap),
  };
}

function containView(view: View, viewport: Size, content: Size): View {
  const scale = Math.min(maximumZoom, Math.max(1, view.scale));
  const maxX = Math.max(0, (content.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (content.height * scale - viewport.height) / 2);
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, view.x)),
    y: Math.min(maxY, Math.max(-maxY, view.y)),
  };
}

function gesture(points: Point[]) {
  const first = points[0];
  if (!first) return null;
  const second = points[1];
  return second
    ? {
        center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        distance: Math.hypot(second.x - first.x, second.y - first.y),
      }
    : { center: first, distance: 0 };
}

export function IdentityPreviewCanvas({ images }: { images: readonly ImageAsset[] }) {
  const { t, i18n } = useTranslation("identityPreview");
  const instructionsId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const viewRef = useRef<View>(initialView);
  const [view, setView] = useState(initialView);
  const [viewport, setViewport] = useState({ width: 1, height: 1, gap: 0 });
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const layout = fitImages(
    images.map(({ document }) => ratios[document.id] ?? 1),
    viewport,
    viewport.gap,
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height, gap });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Resizing or loading the second face must never leave either face out of reach.
    pointers.current.clear();
    viewRef.current = initialView;
    setView(initialView);
  }, [viewport.width, viewport.height, layout.width, layout.height]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const focus = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      const previous = viewRef.current;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? viewport.gap : event.deltaMode === 2 ? viewport.height : 1);
      const scale = Math.min(maximumZoom, Math.max(1, previous.scale * Math.exp(-delta / 300)));
      const ratio = scale / previous.scale;
      const next = containView(
        {
          scale,
          x: focus.x - (focus.x - previous.x) * ratio,
          y: focus.y - (focus.y - previous.y) * ratio,
        },
        viewport,
        layout,
      );
      viewRef.current = next;
      setView(next);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [viewport, layout.width, layout.height]);

  function commit(next: View) {
    const bounded = containView(next, viewport, layout);
    viewRef.current = bounded;
    setView(bounded);
  }
  function zoom(factor: number) {
    const previous = viewRef.current;
    const scale = Math.min(maximumZoom, Math.max(1, previous.scale * factor));
    const ratio = scale / previous.scale;
    commit({ scale, x: previous.x * ratio, y: previous.y * ratio });
  }
  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const before = gesture([...pointers.current.values()]);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = gesture([...pointers.current.values()]);
    if (!before || !after) return;
    const previous = viewRef.current;
    const factor = before.distance > 0 && after.distance > 0 ? after.distance / before.distance : 1;
    const scale = Math.min(maximumZoom, Math.max(1, previous.scale * factor));
    const ratio = scale / previous.scale;
    const rect = event.currentTarget.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    commit({
      scale,
      x: (previous.x - (before.center.x - center.x)) * ratio + after.center.x - center.x,
      y: (previous.y - (before.center.y - center.y)) * ratio + after.center.y - center.y,
    });
  }
  function releasePointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="flex min-h-64 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11"
          disabled={view.scale <= 1}
          aria-label={t("zoomOut")}
          onClick={() => zoom(1 / 1.25)}
        >
          <ZoomOut className="size-4" aria-hidden="true" />
        </Button>
        <output
          aria-label={t("zoom", {
            value: new Intl.NumberFormat(i18n.language, {
              style: "percent",
              maximumFractionDigits: 0,
            }).format(view.scale),
          })}
          className="min-w-14 text-center text-sm tabular-nums"
        >
          {new Intl.NumberFormat(i18n.language, {
            style: "percent",
            maximumFractionDigits: 0,
          }).format(view.scale)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11"
          disabled={view.scale >= maximumZoom}
          aria-label={t("zoomIn")}
          onClick={() => zoom(1.25)}
        >
          <ZoomIn className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => commit(initialView)}
        >
          <Maximize className="size-4" aria-hidden="true" />
          {t("reset")}
        </Button>
      </div>
      <div
        ref={viewportRef}
        role="region"
        tabIndex={0}
        aria-label={t("canvas")}
        aria-describedby={instructionsId}
        className="relative min-h-48 flex-1 touch-none overflow-hidden rounded-lg bg-muted gap-4 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ cursor: view.scale > 1 ? "grab" : "default" }}
        onPointerDown={(event) => {
          if ((event.pointerType === "mouse" && event.button !== 0) || pointers.current.size >= 2)
            return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }}
        onPointerMove={movePointer}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
        onKeyDown={(event) => {
          const previous = viewRef.current;
          const step = viewport.gap * 3;
          if (event.key === "+" || event.key === "=") zoom(1.25);
          else if (event.key === "-" || event.key === "_") zoom(1 / 1.25);
          else if (event.key === "0" || event.key === "Home") commit(initialView);
          else if (event.key === "ArrowLeft") commit({ ...previous, x: previous.x + step });
          else if (event.key === "ArrowRight") commit({ ...previous, x: previous.x - step });
          else if (event.key === "ArrowUp") commit({ ...previous, y: previous.y + step });
          else if (event.key === "ArrowDown") commit({ ...previous, y: previous.y - step });
          else return;
          event.preventDefault();
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 origin-center"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          {images.map((image, index) => (
            <div
              key={image.document.id}
              className="absolute flex items-center justify-center overflow-hidden rounded-md"
              style={layout.frames[index]}
            >
              {failed.has(image.document.id) ? (
                <p role="alert" className="p-4 text-center text-sm text-muted-foreground">
                  {t("imageError")}
                </p>
              ) : (
                <img
                  src={image.url}
                  alt={image.document.name}
                  draggable={false}
                  className="size-full object-contain"
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth > 0 && naturalHeight > 0)
                      setRatios((previous) => ({
                        ...previous,
                        [image.document.id]: naturalWidth / naturalHeight,
                      }));
                  }}
                  onError={() => setFailed((previous) => new Set(previous).add(image.document.id))}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <p id={instructionsId} className="shrink-0 text-center text-xs text-muted-foreground">
        {t("gestures")}
      </p>
    </div>
  );
}
