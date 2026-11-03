"use client";

import { useCallback, useEffect, useState } from "react";
import { Gamepad2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client";

// Helpers shared by the Pet Town management board's tabs.

export const ADMIN = "/api/ta-tua/admin";
export const when = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "Chưa");
export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Đã có lỗi xảy ra");

export function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    api<T>(url)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false));
  }, [url]);
  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}

export function Failure({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card>
      <EmptyState icon={Gamepad2} title="Không đọc được dữ liệu game" description={error} action={<Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="h-4 w-4" /> Thử lại</Button>} />
    </Card>
  );
}
