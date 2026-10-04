import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@coverview/ui";
type Point = [number, number];
export function SignaturePad({
  value,
  onChange,
  disabled,
}: {
  value: Point[][];
  onChange: (value: Point[][]) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("authorizations");
  const active = useRef<number | null>(null);
  const drawing = useRef<Point[][]>(value);
  const helpId = useId();
  const [cursor, setCursor] = useState<Point>([0.1, 0.5]);
  const [pen, setPen] = useState(false);
  const position = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    ];
  };
  return (
    <div className="space-y-2">
      <p id={helpId} className="text-sm text-muted-foreground">
        {t("signing.drawHelp")} {t("signing.keyboardHelp")}
      </p>
      <svg
        viewBox="0 0 600 200"
        role="application"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby={helpId}
        aria-label={t("signing.drawLabel")}
        className="w-full touch-none rounded-lg border border-border bg-background text-foreground"
        onKeyDown={(event) => {
          if (disabled || active.current !== null) return;
          if (event.key === "Escape") {
            setPen(false);
            return;
          }
          if (event.key === " ") {
            event.preventDefault();
            if (pen) {
              setPen(false);
              onChange(value.filter((stroke) => stroke.length >= 2));
            } else if (value.length < 30 && value.flat().length < 2998) {
              setPen(true);
              onChange([...value, [cursor]]);
            }
            return;
          }
          const offsets: Partial<Record<string, Point>> = {
            ArrowLeft: [-0.02, 0],
            ArrowRight: [0.02, 0],
            ArrowUp: [0, -0.04],
            ArrowDown: [0, 0.04],
          };
          const offset = offsets[event.key];
          if (!offset) return;
          event.preventDefault();
          const next: Point = [
            Math.max(0, Math.min(1, cursor[0] + offset[0])),
            Math.max(0, Math.min(1, cursor[1] + offset[1])),
          ];
          setCursor(next);
          const last = value.at(-1);
          if (pen && last && last.length < 500 && value.flat().length < 3000)
            onChange([...value.slice(0, -1), [...last, next]]);
        }}
        onBlur={() => {
          setPen(false);
        }}
        onPointerDown={(event) => {
          if (
            disabled ||
            active.current !== null ||
            value.length >= 30 ||
            value.flat().length >= 2998 ||
            event.button !== 0
          )
            return;
          event.preventDefault();
          setPen(false);
          active.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = [...value, [position(event)]];
          onChange(drawing.current);
        }}
        onPointerMove={(event) => {
          if (disabled || active.current !== event.pointerId) return;
          const last = drawing.current.at(-1);
          if (!last || last.length >= 500 || drawing.current.flat().length >= 3000) return;
          drawing.current = [...drawing.current.slice(0, -1), [...last, position(event)]];
          onChange(drawing.current);
        }}
        onPointerUp={(event) => {
          if (active.current !== event.pointerId) return;
          active.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          drawing.current = drawing.current.filter((stroke) => stroke.length >= 2);
          onChange(drawing.current);
        }}
        onPointerCancel={() => {
          active.current = null;
          drawing.current = drawing.current.filter((stroke) => stroke.length >= 2);
          onChange(drawing.current);
        }}
      >
        {value.map((stroke, index) => (
          <polyline
            key={index}
            points={stroke.map(([x, y]) => `${x * 600},${y * 200}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <circle
          cx={cursor[0] * 600}
          cy={cursor[1] * 200}
          r="3"
          fill="none"
          stroke="currentColor"
          opacity="0.5"
        />
      </svg>
      <p className="sr-only" aria-live="polite">
        {t(pen ? "signing.penDown" : "signing.penUp")}
      </p>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || value.length === 0}
        onClick={() => {
          active.current = null;
          setPen(false);
          drawing.current = [];
          onChange([]);
        }}
      >
        {t("signing.clear")}
      </Button>
    </div>
  );
}
