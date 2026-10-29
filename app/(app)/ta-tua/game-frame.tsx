"use client";

import Link from "next/link";
import { useState } from "react";
import { Gamepad2, Maximize2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export function GameFrame({ src, error, admin }: { src: string | null; error: string | null; admin: boolean }) {
  const [reloads, setReloads] = useState(0);
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pet Town"
        description="Nuôi bé, đi làm, buôn bán và gặp đồng nghiệp ở công viên Phố Trân Châu."
        actions={
          <>
            {admin && (
              <Link href="/ta-tua/quan-ly" className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium hover:bg-muted">
                <SlidersHorizontal className="h-4 w-4" /> Quản lý
              </Link>
            )}
            {src && (
              <>
                <Button variant="outline" size="sm" onClick={() => setReloads((n) => n + 1)}>
                  <RefreshCw className="h-4 w-4" /> Tải lại
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open("/server1", "_blank", "noopener")}>
                  <Maximize2 className="h-4 w-4" /> Mở tab riêng
                </Button>
              </>
            )}
          </>
        }
      />
      {src ? (
        <iframe
          key={reloads}
          src={src}
          title="Pet Town"
          className="h-[calc(100dvh-11.5rem)] min-h-[560px] w-full rounded-xl border bg-card"
          allow="autoplay"
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={Gamepad2} title="Chưa vào chơi được" description={error ?? "Máy chủ game chưa sẵn sàng."} />
        </div>
      )}
    </div>
  );
}
