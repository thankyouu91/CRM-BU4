"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { PLAY_PATH } from "@/lib/petdex-public";
import type { GameAccount } from "@/app/api/ta-tua/account/route";
import { MeadowShell } from "./meadow";
import { saveGuest } from "./play-screen";

export interface PasswordLink {
  valid: boolean;
  username?: string;
  displayName?: string;
  hasPassword?: boolean;
  expiresAt?: number;
}

const NAME_RULE = /^[\p{L}\p{N}_]{3,20}$/u;

/** The page behind an administrator's one-time link: pick a login name and a password, then play. */
export function PasswordSetup({ code, link, error }: { code: string; link: PasswordLink; error: string | null }) {
  const router = useRouter();
  const [username, setUsername] = useState(link.username && NAME_RULE.test(link.username) ? link.username : "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!NAME_RULE.test(name.normalize("NFC"))) return setMessage("Tên đăng nhập 3–20 ký tự: chữ, số hoặc dấu _, không dấu cách.");
    if (password.length < 6) return setMessage("Mật khẩu cần ít nhất 6 ký tự.");
    if (password !== confirm) return setMessage("Hai lần nhập mật khẩu chưa khớp.");
    setBusy(true);
    setMessage(null);
    try {
      const account = await api<GameAccount>("/api/ta-tua/account", { method: "POST", body: { action: "setup", code, username: name, password } });
      if (account.token) saveGuest({ token: account.token, name: account.displayName, code: "", kind: account.kind });
      router.replace(PLAY_PATH);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Không gửi được, thử lại nhé.");
      setBusy(false);
    }
  };

  return (
    <MeadowShell>
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
        <KeyRound className="h-5 w-5" />
      </span>
      <h1 className="text-lg font-semibold">{link.hasPassword ? "Đặt lại mật khẩu" : "Đặt mật khẩu"}</h1>
      {link.valid ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Tài khoản chơi <span className="font-medium text-foreground">{link.displayName}</span>. Chọn tên đăng nhập và mật khẩu, lần sau vào{" "}
            <Link href={PLAY_PATH} className="underline underline-offset-2">trang chơi</Link> bằng tên và mật khẩu này. Bé và xu giữ nguyên.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field label="Tên đăng nhập" htmlFor="pw-username" hint="3–20 ký tự: chữ, số hoặc dấu _, không dấu cách.">
              <Input id="pw-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={20} required autoFocus />
            </Field>
            <Field label="Mật khẩu" htmlFor="pw-password" hint="Ít nhất 6 ký tự.">
              <Input id="pw-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </Field>
            <Field label="Nhập lại mật khẩu" htmlFor="pw-confirm">
              <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </Field>
            {message && (
              <p role="alert" className="text-sm text-danger">
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" loading={busy}>
              Lưu và vào chơi
            </Button>
          </form>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{error ?? "Link đặt mật khẩu này đã dùng rồi hoặc đã hết hạn. Nhờ quản trị viên tạo link mới."}</p>
      )}
    </MeadowShell>
  );
}
