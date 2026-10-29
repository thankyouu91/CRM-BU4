"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { PLAY_PATH } from "@/lib/petdex-public";
import { readGuest, saveGuest } from "./play-screen";

/** Invite page: a guest types a name and is taken to the play page; a returning guest goes straight there. */
export function GuestEntry({ code, valid, label, error }: { code: string; valid: boolean; label: string | null; error: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const kept = readGuest();
    if (!kept) {
      setChecking(false);
      return;
    }
    api<{ ok: boolean }>("/api/ta-tua/guest", { method: "POST", body: { resume: kept.token } })
      .then((res) => (res.ok ? router.replace(PLAY_PATH) : setChecking(false)))
      .catch(() => setChecking(false));
  }, [router]);

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ token: string }>("/api/ta-tua/guest", { method: "POST", body: { code, name: name.trim() } });
      saveGuest({ token: res.token, name: name.trim(), code });
      router.replace(PLAY_PATH);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Không vào được, thử lại nhé.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-card">
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
          <Gamepad2 className="h-5 w-5" />
        </span>
        <h1 className="text-lg font-semibold">Tà tưa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {valid ? `Bạn được mời vào chơi${label ? ` (${label})` : ""}. Điền tên để bắt đầu, không cần tài khoản.` : error ?? "Link mời này không còn hiệu lực. Hãy xin link mới từ người đã mời bạn."}
        </p>
        {valid && !checking && (
          <form onSubmit={enter} className="mt-5 space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" minLength={2} maxLength={40} required autoFocus />
            {message && <p className="text-sm text-danger">{message}</p>}
            <Button type="submit" className="w-full" loading={busy} disabled={name.trim().length < 2}>
              Vào chơi
            </Button>
          </form>
        )}
        {valid && checking && <p className="mt-5 text-sm text-muted-foreground">Đang kiểm tra phiên chơi cũ…</p>}
        <p className="mt-6 text-xs text-muted-foreground">Một trò chơi trong WorkHub. Dữ liệu chơi chỉ dùng cho vui, không liên quan tới công việc.</p>
      </div>
    </main>
  );
}
