"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rows a dashboard card shows before "Xem thêm", so the cards stay about the same height. */
export const VISIBLE_ROWS = 6;

/**
 * A dashboard list: the first `visible` items, then "Xem thêm N …" opening the rest
 * in a scrolling area (the card never runs down the page), and "Thu gọn" back.
 */
export function ExpandableList<T>({
  items,
  getKey,
  render,
  unit,
  visible = VISIBLE_ROWS,
  className,
  role,
}: {
  items: T[];
  getKey: (item: T) => string;
  render: (item: T) => React.ReactNode;
  /** "dự án", "báo cáo", … for the button. */
  unit: string;
  visible?: number;
  className?: string;
  role?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, visible);
  return (
    <>
      <ul role={role} className={cn("-mx-2 divide-y divide-border/60", expanded && "max-h-[26rem] overflow-y-auto pr-1", className)}>
        {shown.map((item) => (
          <li key={getKey(item)}>{render(item)}</li>
        ))}
      </ul>
      {items.length > visible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 flex min-h-8 w-full items-center justify-center gap-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {expanded ? "Thu gọn" : `Xem thêm ${items.length - visible} ${unit}`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      )}
    </>
  );
}

/** Tabs with counts, as on the project progress card. */
export function CountTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: { key: K; label: string; count: number; alert?: boolean }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5", className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active ? "bg-card text-foreground shadow-card ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className={cn("tabular-nums", t.alert && t.count > 0 ? "text-danger" : "text-muted-foreground")}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "Xem tất cả" style link in a card header, with a 32px target. */
export const headerLinkClass = "-my-1.5 -mr-2 inline-flex min-h-8 items-center rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/5 hover:underline";
