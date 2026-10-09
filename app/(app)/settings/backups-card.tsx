"use client";

import { DatabaseBackup, Download } from "lucide-react";
import { useApi } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";
import { formatFileSize } from "@/lib/contract-files";
import type { BackupInfo } from "@/lib/backups";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

const SHOWN = 7;

/** Admin settings: the latest automatic backups (daily, 02:00 Vietnam time) with download links. */
export function BackupsCard() {
  const { data, error, loading } = useApi<{ enabled: boolean; backups: BackupInfo[] }>("/api/backups");
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><DatabaseBackup className="h-4 w-4 text-primary" /> Sao lưu dữ liệu</span>}
        description="Tự động mỗi ngày lúc 2:00 (giờ Việt Nam): giữ 30 bản gần nhất và 12 bản đầu tháng. File PDF hợp đồng được lưu riêng trên R2."
      />
      <CardBody>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : loading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : !data.enabled ? (
          <p className="text-sm text-muted-foreground">Chưa bật kho sao lưu (R2) cho hệ thống này.</p>
        ) : data.backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có bản sao lưu nào. Bản đầu tiên được tạo vào 2:00 sáng tới.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.backups.slice(0, SHOWN).map((b) => (
              <li key={b.key} className="flex items-center gap-3 py-2">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{b.kind === "monthly" ? "Đầu tháng" : "Hằng ngày"}</span>
                <span className="flex-1 tabular-nums">{formatDateTime(b.createdAt)}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {formatFileSize(b.size)}
                  {b.rows !== null ? ` · ${b.rows.toLocaleString("vi-VN")} dòng` : ""}
                </span>
                <a
                  href={`/api/backups/download?key=${encodeURIComponent(b.key)}`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Download className="h-3.5 w-3.5" /> Tải về
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
