"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** The current year in the business time zone (Vietnam), for the year we fill in. */
export function currentYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(now));
}

type Parts = { d: string; m: string; y: string };

function split(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { d: match[3], m: match[2], y: match[1] } : { d: "", m: "", y: "" };
}

/** "YYYY-MM-DD" for a real calendar date, else null. */
export function joinDate(p: Parts): string | null {
  const d = Number(p.d);
  const m = Number(p.m);
  const y = Number(p.y);
  if (!d || !m || p.y.length !== 4 || y < 1900 || m > 12) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // e.g. 31/02
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Date field shown as dd/mm/yyyy whatever the browser's language (the native date
 * input follows it, e.g. mm/dd/yyyy on an English browser). Once the day and month
 * are typed the year is filled in with the current one; it stays editable for
 * earlier or later years. The calendar button opens the browser's date picker.
 * Value and onChange use "YYYY-MM-DD" ("" when empty), like <input type="date">.
 */
export function DateInput({
  value,
  onChange,
  disabled,
  required,
  min,
  max,
  id,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const [parts, setParts] = useState<Parts>(() => split(value));
  // Latest parts, for handlers that run before a re-render (a blur right after typing moves focus).
  const latest = useRef(parts);
  latest.current = parts;
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Follow changes from outside (a reset, a saved value), but not our own partial typing.
  useEffect(() => {
    setParts((cur) => (joinDate(cur) === value || (!value && !cur.d && !cur.m && !cur.y) ? cur : split(value)));
  }, [value]);

  const commit = (next: Parts) => {
    latest.current = next;
    setParts(next);
    const joined = joinDate(next);
    if (joined) {
      if (joined !== value) onChange(joined);
    } else if (!next.d && !next.m && !next.y && value) {
      onChange("");
    }
  };

  const setDay = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 2);
    commit(withYear({ ...latest.current, d }));
    if (d.length === 2 || Number(d) > 3) monthRef.current?.focus();
  };
  const setMonth = (raw: string) => {
    const m = raw.replace(/\D/g, "").slice(0, 2);
    commit(withYear({ ...latest.current, m }));
    if (m.length === 2 || Number(m) > 1) yearRef.current?.select();
  };
  const setYear = (raw: string) => commit({ ...latest.current, y: raw.replace(/\D/g, "").slice(0, 4) });

  // Backspace in an empty part moves back to the previous one.
  const back = (prev: React.RefObject<HTMLInputElement | null>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !e.currentTarget.value) prev.current?.focus();
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  const seg = "bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed";
  return (
    <div
      className={cn(
        "relative flex w-full items-center rounded-lg border bg-card pl-3 pr-1 text-sm text-foreground transition-colors",
        "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20",
        size === "sm" ? "h-9" : "h-10",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <input
        ref={dayRef}
        id={id}
        inputMode="numeric"
        placeholder="dd"
        aria-label={`${ariaLabel ? `${ariaLabel}: ` : ""}ngày`}
        value={parts.d}
        disabled={disabled}
        required={required}
        onChange={(e) => setDay(e.target.value)}
        onBlur={() => latest.current.d.length === 1 && commit({ ...latest.current, d: pad(Number(latest.current.d)) })}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(seg, "w-[2ch]")}
      />
      <span className="px-0.5 text-muted-foreground">/</span>
      <input
        ref={monthRef}
        inputMode="numeric"
        placeholder="mm"
        aria-label={`${ariaLabel ? `${ariaLabel}: ` : ""}tháng`}
        value={parts.m}
        disabled={disabled}
        onChange={(e) => setMonth(e.target.value)}
        onKeyDown={back(dayRef)}
        onBlur={() => latest.current.m.length === 1 && commit({ ...latest.current, m: pad(Number(latest.current.m)) })}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(seg, "w-[2.6ch]")}
      />
      <span className="px-0.5 text-muted-foreground">/</span>
      <input
        ref={yearRef}
        inputMode="numeric"
        placeholder="yyyy"
        aria-label={`${ariaLabel ? `${ariaLabel}: ` : ""}năm`}
        value={parts.y}
        disabled={disabled}
        onChange={(e) => setYear(e.target.value)}
        onKeyDown={back(monthRef)}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(seg, "w-[4.4ch]")}
      />
      <span className="flex-1" />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none"
        aria-label="Chọn ngày trên lịch"
        tabIndex={-1}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {/* The browser's calendar, opened by the button; hidden but kept in the layout for showPicker. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={joinDate(parts) ?? ""}
        min={min}
        max={max}
        onChange={(e) => commit(split(e.target.value))}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}

/** Fill in the current year once the day and month are there and no year was typed. */
function withYear(p: Parts): Parts {
  return p.d && p.m && (p.m.length === 2 || Number(p.m) > 1) && !p.y ? { ...p, y: String(currentYear()) } : p;
}
