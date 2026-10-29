"use client";

import { useEffect, useState } from "react";
import { Gamepad2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";

const GAME_PAGE = "/ta-tua/game/index.html";
const storageKey = (code: string) => `tatua.guest.${code}`;

export function GuestEntry({ code, valid, label, error }: { code: string; valid: boolean; label: string | null; error: string | null }) {
  const [name, setName] = useState("");
  const [session, setSession] = useState<{ token: string; name: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // A guest who comes back on the same browser keeps playing as the same person.
  useEffect(() => {
    let kept: { token: string; name: string } | null = null;
    try {
      kept = JSON.parse(localStorage.getItem(storageKey(code)) ?? "null");
    } catch {
      kept = null;
    }
    if (!kept?.token) {
      setChecking(false);
      return;
    }
    api<{ ok: boolean; displayName?: string }>("/api/ta-tua/guest", { method: "POST", body: { resume: kept.token } })
      .then((res) => {
        if (res.ok) setSession({ token: kept!.token, name: res.displayName ?? kept!.name });
        else localStorage.removeItem(storageKey(code));
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [code]);

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ token: string; username: string }>("/api/ta-tua/guest", { method: "POST", body: { code, name: name.trim() } });
      const next = { token: res.token, name: name.trim() };
      try {
        localStorage.setItem(storageKey(code), JSON.stringify(next));
      } catch {
        // private mode: still plays, just has to type the name again next time
      }
      setSession(next);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Không vào được, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    localStorage.removeItem(storageKey(code));
    setSession(null);
    setName("");
  };

  if (session) {
    const params = new URLSearchParams({ token: session.token });
    if (process.env.NODE_ENV !== "production") params.set("ws", "ws://127.0.0.1:3200/ta-tua/ws");
    return (
      <div className="flex h-dvh flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
            <Gamepad2 className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">Tà tưa</span>
          <span className="text-xs text-muted-foreground">Khách mời · {session.name}</span>
          <button onClick={leave} className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Đổi tên khác
          </button>
        </header>
        <iframe src={`${GAME_PAGE}#${params.toString()}`} title="Tà tưa" className="min-h-0 w-full flex-1" allow="autoplay" />
      </div>
    );
  }

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
