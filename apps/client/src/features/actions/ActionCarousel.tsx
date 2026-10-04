import { useEffect, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { gsap } from "gsap";

export type ActionDirection = -1 | 1;

export function ActionCarousel({
  children,
  cardId,
  direction,
  disabled,
  canPrevious,
  canNext,
  label,
  onRequest,
  onExit,
}: {
  children: ReactNode;
  cardId: string;
  direction: ActionDirection | null;
  disabled: boolean;
  canPrevious: boolean;
  canNext: boolean;
  label: string;
  onRequest: (direction: ActionDirection) => void;
  onExit: (direction: ActionDirection) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    time: number;
    dragging: boolean;
    vertical: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const exit = useRef(onExit);
  exit.current = onExit;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const arrival = useRef<ActionDirection>(1);
  useLayoutEffect(() => {
    if (!card.current) return;
    card.current.scrollTop = 0;
    const tween = gsap.fromTo(
      card.current,
      {
        x: 0,
        xPercent: reduced() ? 0 : arrival.current * 35,
        rotation: 0,
        opacity: reduced() ? 1 : 0,
        scale: 1,
      },
      {
        xPercent: 0,
        opacity: 1,
        scale: 1,
        duration: reduced() ? 0 : 0.25,
        ease: "power2.out",
      },
    );
    return () => {
      tween.kill();
    };
  }, [cardId]);
  useEffect(() => {
    if (direction === null || !card.current) return;
    arrival.current = direction;
    const tween = gsap.to(card.current, {
      xPercent: reduced() ? 0 : -direction * 120,
      x: 0,
      rotation: reduced() ? 0 : -direction * 7,
      opacity: reduced() ? 1 : 0,
      duration: reduced() ? 0 : 0.28,
      ease: "power2.in",
      overwrite: "auto",
      onComplete: () => exit.current(direction),
    });
    return () => {
      tween.kill();
    };
  }, [direction]);
  useEffect(
    () => () => {
      if (card.current) gsap.killTweensOf(card.current);
    },
    [],
  );
  const settle = () => {
    if (card.current)
      gsap.to(card.current, {
        x: 0,
        rotation: 0,
        duration: reduced() ? 0 : 0.2,
        ease: "power2.out",
      });
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - start.time);
    if (
      !cancelled &&
      start.dragging &&
      !disabled &&
      Math.abs(dx) > Math.abs(dy) * 1.25 &&
      (Math.abs(dx) >= 70 || (Math.abs(dx) >= 30 && velocity > 0.5))
    ) {
      const next = dx < 0 ? 1 : -1;
      settle();
      if ((next === 1 && canNext) || (next === -1 && canPrevious)) onRequest(next);
    } else settle();
  };
  return (
    <section
      aria-label={label}
      aria-roledescription="carrousel"
      className="relative isolate overflow-hidden px-4 py-3 sm:px-9"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 inset-y-3 -translate-x-3 -rotate-2 rounded-2xl border border-border bg-muted/50 sm:inset-x-9 sm:-translate-x-6"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 inset-y-3 translate-x-3 rotate-2 rounded-2xl border border-border bg-muted/50 sm:inset-x-9 sm:translate-x-6"
      />
      <div
        ref={card}
        className="relative h-[clamp(22rem,60svh,32rem)] touch-pan-y overflow-y-auto overscroll-contain rounded-2xl border border-border bg-background shadow-sm"
        aria-busy={direction !== null}
        inert={direction !== null}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (
            disabled ||
            direction !== null ||
            !event.isPrimary ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest(
              "input, textarea, select, button, a, [contenteditable=true]",
            )
          )
            return;
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: performance.now(),
            dragging: false,
            vertical: false,
          };
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start || start.id !== event.pointerId || start.vertical || disabled) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!start.dragging) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
              start.vertical = true;
              return;
            }
            if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
            start.dragging = true;
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            gsap.killTweensOf(card.current);
            gsap.set(card.current, { opacity: 1, scale: 1 });
          }
          event.preventDefault();
          if (!reduced()) gsap.set(card.current, { x: dx, rotation: dx / 35 });
        }}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
      >
        {children}
      </div>
    </section>
  );
}
