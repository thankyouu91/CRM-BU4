"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, History, Search } from "lucide-react";
import { api } from "@/lib/client";
import { formatDateTime, cn } from "@/lib/utils";
import { AUDIT_ACTIONS, AUDIT_GROUPS, auditActionLabel, auditActionsIn, type AuditGroup } from "@/lib/audit-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";

interface Entry {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  details: unknown;
  ip: string | null;
}
interface Page {
  entries: Entry[];
  nextCursor: string | null;
  actors: { id: string; name: string }[];
}
interface Filters {
  group: string;
  action: string;
  actor: string;
  q: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { group: "", action: "", actor: "", q: "", from: "", to: "" };

const GROUP_TONE: Record<AuditGroup, string> = {
  auth: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  user: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  project: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  task: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  contract: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  workReport: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  ai: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  system: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
};

function toneOf(action: string) {
  const group = (AUDIT_ACTIONS as Record<string, { group: AuditGroup }>)[action]?.group;
  return group ? GROUP_TONE[group] : "bg-muted text-muted-foreground";
}

function queryOf(f: Filters, cursor?: string | null) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) sp.set(k, v);
  if (cursor) sp.set("cursor", cursor);
  return `/api/audit-logs?${sp.toString()}`;
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** `details` as readable lines: `{ field: { from, to } }` becomes "field: a → b", other values are listed. */
function DetailLines({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null;
  const lines = Object.entries(details as Record<string, unknown>).map(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v) && "from" in v && "to" in v) {
      const c = v as { from: unknown; to: unknown };
      return { k, text: `${show(c.from)} → ${show(c.to)}` };
    }
    return { k, text: show(v) };
  });
  if (!lines.length) return null;
  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[max-content_1fr]">
      {lines.map((l) => (
        <div key={l.k} className="contents">
          <dt className="font-medium text-muted-foreground">{l.k}</dt>
          <dd className="break-words font-mono">{l.text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditLogView() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [actors, setActors] = useState<Page["actors"]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Typing in the search box filters after a short pause.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api<Page>(queryOf(filters))
      .then((page) => {
        if (!live) return;
        setEntries(page.entries);
        setActors(page.actors);
        setCursor(page.nextCursor);
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<Page>(queryOf(filters, cursor));
      setEntries((prev) => [...prev, ...page.entries]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, filters]);

  const actionOptions = useMemo(
    () => (filters.group ? auditActionsIn(filters.group as AuditGroup) : (Object.keys(AUDIT_ACTIONS) as (keyof typeof AUDIT_ACTIONS)[])),
    [filters.group],
  );
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const filtered = Object.entries(filters).some(([, v]) => v);

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo nội dung hoặc người thực hiện" className="pl-9" aria-label="Tìm kiếm" />
        </div>
        <Select value={filters.group} onChange={(e) => set({ group: e.target.value, action: "" })} aria-label="Nhóm thao tác">
          <option value="">Mọi nhóm</option>
          {(Object.keys(AUDIT_GROUPS) as AuditGroup[]).map((g) => (
            <option key={g} value={g}>
              {AUDIT_GROUPS[g]}
            </option>
          ))}
        </Select>
        <Select value={filters.action} onChange={(e) => set({ action: e.target.value })} aria-label="Thao tác">
          <option value="">Mọi thao tác</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {auditActionLabel(a)}
            </option>
          ))}
        </Select>
        <Select value={filters.actor} onChange={(e) => set({ actor: e.target.value })} aria-label="Người thực hiện">
          <option value="">Mọi người</option>
          {actors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-1">
          <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} aria-label="Từ ngày" className="px-2 xl:w-[150px]" />
          <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} aria-label="Đến ngày" className="px-2 xl:w-[150px]" />
        </div>
        {filtered && (
          <div className="col-span-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilters(EMPTY);
              }}
            >
              Xoá bộ lọc
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {error ? (
          <p className="p-6 text-sm text-danger">{error}</p>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={History} title="Chưa có thao tác nào" description={filtered ? "Không có mục nào khớp bộ lọc." : "Các thao tác thay đổi dữ liệu sẽ xuất hiện ở đây."} />
        ) : (
          <ul className="divide-y">
            {entries.map((e) => {
              const expanded = open === e.id;
              const hasDetails = !!e.details && typeof e.details === "object" && Object.keys(e.details as object).length > 0;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : e.id)}
                    className={cn("grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 sm:grid-cols-[150px_160px_1fr]", expanded && "bg-muted/40")}
                    aria-expanded={expanded}
                  >
                    <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                    <span className="truncate font-medium">{e.actorName}</span>
                    <span className="flex min-w-0 items-start gap-2">
                      <Badge className={cn("shrink-0", toneOf(e.action))}>{auditActionLabel(e.action)}</Badge>
                      <span className="min-w-0 flex-1 break-words">{e.summary}</span>
                      {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    </span>
                  </button>
                  {expanded && (
                    <div className="space-y-2 border-t bg-muted/20 px-4 py-3 sm:pl-[330px]">
                      {hasDetails ? <DetailLines details={e.details} /> : <p className="text-xs text-muted-foreground">Không có chi tiết thêm.</p>}
                      <p className="text-xs text-muted-foreground">
                        IP: <span className="font-mono">{e.ip ?? "—"}</span> · Đối tượng: <span className="font-mono">{e.entityType}{e.entityId ? ` ${e.entityId}` : ""}</span>
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {cursor && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} loading={loadingMore}>
            Xem thêm
          </Button>
        </div>
      )}
    </div>
  );
}
