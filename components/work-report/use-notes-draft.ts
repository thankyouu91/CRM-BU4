"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client";
import { notesOf, type WorkNotes, type WorkReportData, type WorkReportRecord } from "@/lib/work-report";

export type SaveState = "saved" | "dirty" | "saving" | "error";

/** The author's notes, saved 1.2 s after typing stops, on demand, and when leaving the report. */
export function useNotesDraft(data: WorkReportData, onSaved: (r: WorkReportRecord) => void) {
  const [notes, setNotes] = useState<WorkNotes>(() => notesOf(data.report?.notes));
  const [state, setState] = useState<SaveState>("saved");
  const latest = useRef(notes);
  const pending = useRef<WorkNotes | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const submitting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const { type, key } = data.period;
  const body = useCallback((n: WorkNotes) => ({ period: type.toLowerCase(), key, ...n }), [type, key]);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (submitting.current) return;
    if (inflight.current) await inflight.current;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setState("saving");
    const run = api<{ report: WorkReportRecord }>("/api/work-reports", { method: "PUT", body: body(next) })
      .then((res) => {
        saved.current(res.report);
        setState(pending.current ? "dirty" : "saved");
      })
      .catch((e) => {
        pending.current ??= next;
        setState("error");
        toast.error(e instanceof ApiError ? e.message : "Không lưu được ghi chú");
      });
    inflight.current = run;
    await run;
    inflight.current = null;
  }, [body]);

  const change = (field: keyof WorkNotes, value: string) => {
    const next = { ...latest.current, [field]: value };
    latest.current = next;
    pending.current = next;
    setNotes(next);
    setState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1200);
  };

  /** Keep the draft until the server confirms submission. */
  const take = async () => {
    clearTimeout(timer.current);
    submitting.current = true;
    if (inflight.current) await inflight.current;
    pending.current = latest.current;
    setState("dirty");
    return latest.current;
  };

  const acknowledge = (submitted: WorkNotes) => {
    submitting.current = false;
    // Typing while the request was in flight must stay dirty.
    if (latest.current !== submitted) {
      timer.current = setTimeout(() => void save(), 1200);
      return;
    }
    pending.current = null;
    setState("saved");
  };

  const failed = () => {
    submitting.current = false;
    pending.current = latest.current;
    setState("error");
  };

  // Leaving the report (another period, the other tab, another page) saves what is pending.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current) void api("/api/work-reports", { method: "PUT", body: body(pending.current), keepalive: true }).catch(() => {});
    },
    [body],
  );
  useEffect(() => {
    if (state === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  return { notes, state, change, save, take, acknowledge, failed };
}
