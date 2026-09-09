import { useRef } from "react";
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
  const position = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    ];
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("signing.drawHelp")}</p>
      <svg
        viewBox="0 0 600 200"
        role="img"
        aria-label={t("signing.drawLabel")}
        className="w-full touch-none rounded-lg border border-border bg-background text-foreground"
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
      </svg>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || value.length === 0}
        onClick={() => {
          active.current = null;
          drawing.current = [];
          onChange([]);
        }}
      >
        {t("signing.clear")}
      </Button>
    </div>
  );
}
