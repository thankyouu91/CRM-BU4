"use client";

import { Button } from "./button";

export function Pagination({ total, page, busy, hasNext, onPrevious, onNext }: {
  total: number; page: number; busy: boolean; hasNext: boolean;
  onPrevious: () => void; onNext: () => void;
}) {
  return (
    <nav aria-label="Phân trang" className="mt-5 flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">Trang {page} · {total} kết quả</span>
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy || page <= 1} onClick={onPrevious}>Trang trước</Button>
        <Button variant="outline" disabled={busy || !hasNext} onClick={onNext}>Trang sau</Button>
      </div>
    </nav>
  );
}
