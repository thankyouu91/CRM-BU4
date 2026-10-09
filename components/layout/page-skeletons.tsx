// Placeholders shown by the route loading.tsx files while a page renders on the
// server, so every navigation responds at once. Plain markup, no client JS.

import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted motion-reduce:animate-none", className)} />;
}

function Card({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>{children}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải…</span>
      {children}
    </div>
  );
}

function Header({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Bone className="h-7 w-56" />
        <Bone className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Bone key={i} className="h-9 w-28" />
        ))}
      </div>
    </div>
  );
}

function Rows({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Bone className="h-5 w-5 rounded-full" />
          <Bone className="h-4 flex-1" />
          <Bone className="hidden h-4 w-24 sm:block" />
          <Bone className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard, reports, contracts, team and other card + table pages. */
export function PageSkeleton() {
  return (
    <Shell>
      <Header actions={2} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-3">
            <Bone className="h-3.5 w-24" />
            <Bone className="h-7 w-32" />
            <Bone className="h-3 w-20" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Bone className="mb-4 h-5 w-40" />
          <Bone className="h-56 w-full" />
        </Card>
        <Card>
          <Bone className="mb-4 h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Bone key={i} className="h-8 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

/** Projects grid. */
export function GridSkeleton() {
  return (
    <Shell>
      <Header />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="space-y-4">
            <div className="flex items-center gap-3">
              <Bone className="h-10 w-10" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/2" />
              </div>
            </div>
            <Bone className="h-2 w-full" />
            <div className="flex justify-between">
              <Bone className="h-6 w-20" />
              <Bone className="h-6 w-16" />
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  );
}

/** My tasks and the reports inbox. */
export function ListSkeleton() {
  return (
    <Shell>
      <Header />
      <Bone className="mb-4 h-9 w-64" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <Rows count={8} />
      </div>
    </Shell>
  );
}

/** A weekly / monthly work report: period bar, header card, counts and sections. */
export function ReportSkeleton() {
  return (
    <Shell>
      <Bone className="mb-4 h-4 w-48" />
      <Bone className="mb-5 h-9 w-80 max-w-full" />
      <Card className="mb-5 flex items-start gap-3">
        <Bone className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bone className="h-3 w-32" />
          <Bone className="h-6 w-72 max-w-full" />
          <Bone className="h-4 w-56" />
        </div>
      </Card>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-3">
            <Bone className="h-3.5 w-24" />
            <Bone className="h-7 w-16" />
          </Card>
        ))}
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="mb-5 overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="border-b px-5 py-4">
            <Bone className="h-5 w-48" />
          </div>
          <Rows count={3} />
        </div>
      ))}
    </Shell>
  );
}

/** Project workspace: header card, tabs and the task list. */
export function ProjectSkeleton() {
  return (
    <Shell>
      <Bone className="mb-4 h-4 w-20" />
      <Card className="mb-6 flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-3">
          <Bone className="h-7 w-72 max-w-full" />
          <Bone className="h-4 w-96 max-w-full" />
          <div className="flex gap-2">
            <Bone className="h-6 w-24" />
            <Bone className="h-6 w-32" />
          </div>
        </div>
        <Bone className="h-24 w-24 rounded-full" />
      </Card>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div className="border-b px-5 py-4">
              <Bone className="h-5 w-48" />
            </div>
            <Rows count={4} />
          </div>
        ))}
      </div>
    </Shell>
  );
}
