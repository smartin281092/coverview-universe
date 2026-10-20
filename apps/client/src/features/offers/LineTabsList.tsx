import { useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@coverview/ui";

export type LineTab<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  // The icon's colour when the tab is open; the underline takes the matching colour.
  tone: string;
  color: string;
};

// Wallet's tab bar (offer page, then Actions on 20 October 2026): a grey track, an underline in
// the open tab's colour that glides to it, and each tab's icon in its colour once open.
export function LineTabsList<T extends string>({
  tabs,
  value,
  label,
}: {
  tabs: readonly LineTab<T>[];
  value: T;
  label: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    const measure = () => {
      const open = node.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (open) setUnderline({ left: open.offsetLeft, width: open.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);
  return (
    <TabsList
      ref={list}
      variant="line"
      aria-label={label}
      className="relative w-full justify-start gap-0.5 overflow-x-auto p-0 [scrollbar-width:none] group-data-horizontal/tabs:h-12 sm:gap-6 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map(({ id, label: name, icon: Icon, tone }) => (
        <TabsTrigger
          key={id}
          value={id}
          className="h-full flex-none gap-1.5 px-1 text-[13px] font-normal text-tab-idle after:hidden data-active:text-foreground sm:px-1.5 sm:text-sm"
        >
          <Icon className={`size-4 ${value === id ? tone : "text-tab-idle"}`} aria-hidden="true" />
          {name}
        </TabsTrigger>
      ))}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-tab-track"
      />
      {underline && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full transition-[transform,width,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            width: underline.width,
            transform: `translateX(${underline.left}px)`,
            backgroundColor: tabs.find((item) => item.id === value)?.color,
          }}
        />
      )}
    </TabsList>
  );
}
