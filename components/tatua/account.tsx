"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client";
import { playUrl } from "@/lib/petdex-public";
import { cn } from "@/lib/utils";
import type { GameAccount } from "@/app/api/ta-tua/account/route";

// Session cookies (no expiry): shared by every tab on this site until the browser closes, so the
// dialog really shows once per browser session and "Để sau" holds in a newly opened tab too.
const LATER_KEY = "tatua_cred_later";
const ASKED_KEY = "tatua_cred_asked";
const hasFlag = (key: string) => document.cookie.split("; ").includes(`${key}=1`);
const setFlag = (key: string) => {
  document.cookie = `${key}=1; path=/; SameSite=Lax`;
};
const NAME_RULE = /^[\p{L}\p{N}_]{3,20}$/u;
const nameHint = "3–20 ký tự: chữ, số hoặc dấu _, không dấu cách.";

const failure = (err: unknown) => (err instanceof ApiError ? err.message : "Không gửi được, thử lại nhé.");

function checkNew(username: string, password: string, confirm: string): string | null {
  if (!NAME_RULE.test(username.normalize("NFC"))) return `Tên đăng nhập ${nameHint}`;
  if (password.length < 6) return "Mật khẩu cần ít nhất 6 ký tự.";
  if (password !== confirm) return "Hai lần nhập mật khẩu chưa khớp.";
  return null;
}

/** Sign in or sign up with a name and a password (the play page, when the browser has no session). */
export function AccountForm({ onSignedIn }: { onSignedIn: (account: GameAccount & { token: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    const problem = mode === "register" ? checkNew(name, password, confirm) : null;
    if (problem) return setMessage(problem);
    setBusy(true);
    setMessage(null);
    try {
      const account = await api<GameAccount>("/api/ta-tua/account", { method: "POST", body: { action: mode, username: name, password } });
      if (account.token) onSignedIn({ ...account, token: account.token });
    } catch (err) {
      setMessage(failure(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setMessage(null);
        }}
        options={[
          { value: "login", label: "Đăng nhập" },
          { value: "register", label: "Tạo tài khoản" },
        ]}
      />
      <Field label="Tên đăng nhập" htmlFor="tt-username" hint={mode === "register" ? nameHint : undefined}>
        <Input id="tt-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={20} required autoFocus />
      </Field>
      <Field label="Mật khẩu" htmlFor="tt-password" hint={mode === "register" ? "Ít nhất 6 ký tự." : undefined}>
        <Input
          id="tt-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
        />
      </Field>
      {mode === "register" && (
        <Field label="Nhập lại mật khẩu" htmlFor="tt-confirm">
          <Input id="tt-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
      )}
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <Button type="submit" className="w-full" loading={busy} disabled={!username.trim() || !password}>
        {mode === "register" ? "Tạo tài khoản và vào chơi" : "Vào chơi"}
      </Button>
    </form>
  );
}

function CredentialsForm({ token, current, onSaved, onLater }: { token: string; current: string; onSaved: (account: GameAccount) => void; onLater: () => void }) {
  const [username, setUsername] = useState(NAME_RULE.test(current) ? current : "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    const problem = checkNew(name, password, confirm);
    if (problem) return setMessage(problem);
    setBusy(true);
    setMessage(null);
    try {
      onSaved(await api<GameAccount>("/api/ta-tua/account", { method: "POST", body: { action: "credentials", token, username: name, password } }));
    } catch (err) {
      setMessage(failure(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Tên đăng nhập" htmlFor="tt-set-username" hint={nameHint}>
        <Input id="tt-set-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={20} required autoFocus />
      </Field>
      <Field label="Mật khẩu" htmlFor="tt-set-password" hint="Ít nhất 6 ký tự.">
        <Input id="tt-set-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </Field>
      <Field label="Nhập lại mật khẩu" htmlFor="tt-set-confirm">
        <Input id="tt-set-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <Button type="submit" className="w-full" loading={busy}>
        Lưu tên và mật khẩu
      </Button>
      <button type="button" onClick={onLater} className="w-full rounded-md py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        Để sau
      </button>
    </form>
  );
}

/**
 * For players who came in through WorkHub or an invite and have no password yet: when they come
 * back, the dialog asks them (once per browser session) to add a login name and a password, and a
 * bar above the game keeps the reminder until they do or choose "Để sau".
 */
export function CredentialsNotice({ token, className = "border-b" }: { token: string; className?: string }) {
  const [account, setAccount] = useState<GameAccount | null>(null);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [later, setLater] = useState(false);

  useEffect(() => {
    let live = true;
    if (hasFlag(LATER_KEY)) setLater(true);
    api<{ ok: boolean } & Partial<GameAccount>>("/api/ta-tua/guest", { method: "POST", body: { resume: token } })
      .then((res) => {
        if (!live || !res.ok) return;
        setAccount(res as GameAccount);
        if (res.hasPassword || hasFlag(ASKED_KEY) || hasFlag(LATER_KEY)) return;
        setFlag(ASKED_KEY);
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);

  const postpone = () => {
    setLater(true);
    setFlag(LATER_KEY);
  };

  if (saved) {
    return (
      <div className={cn("flex shrink-0 items-center gap-2 bg-muted/60 px-4 py-2 text-xs", className)}>
        <KeyRound className="h-3.5 w-3.5 shrink-0" />
        <span>
          Đã lưu. Lần sau vào <span className="font-medium">{playUrl()}</span> và đăng nhập bằng tên <span className="font-medium">{saved}</span>.
        </span>
        <button onClick={() => setSaved(null)} className="ml-auto rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          Đóng
        </button>
      </div>
    );
  }
  if (!account || account.hasPassword || later) return null;
  return (
    <>
      <div className={cn("flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 bg-muted/60 px-4 py-2 text-xs", className)}>
        <KeyRound className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          Mới: đặt <span className="font-medium">tên đăng nhập và mật khẩu</span> để lần sau vào thẳng {playUrl()}, không cần link mời hay WorkHub. Bé và xu giữ nguyên.
        </span>
        <span className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => setOpen(true)}>
            Đặt ngay
          </Button>
          <button onClick={postpone} className="rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            Để sau
          </button>
        </span>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Bổ sung mật khẩu cho tài khoản chơi"
        description={`Pet Town giờ đăng nhập bằng tên + mật khẩu tại ${playUrl()}, trên bất kỳ máy nào. Bé, xu và mọi thứ của ${account.displayName} giữ nguyên.`}
      >
        <CredentialsForm
          token={token}
          current={account.username}
          onSaved={(next) => {
            setAccount(next);
            setOpen(false);
            setSaved(next.username);
          }}
          onLater={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
