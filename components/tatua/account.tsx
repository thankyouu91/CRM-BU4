"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client";
import { GUEST_SESSION_KEY, playUrl } from "@/lib/petdex-public";
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

function checkPassword(password: string, confirm: string): string | null {
  if (password.length < 6) return "Mật khẩu cần ít nhất 6 ký tự.";
  if (password !== confirm) return "Hai lần nhập mật khẩu chưa khớp.";
  return null;
}

function checkNew(username: string, password: string, confirm: string): string | null {
  if (!NAME_RULE.test(username.normalize("NFC"))) return `Tên đăng nhập ${nameHint}`;
  return checkPassword(password, confirm);
}

const NO_PROOF = "Trình duyệt này không còn phiên chơi của tài khoản này. Nhờ quản trị viên gửi link đặt mật khẩu cho bạn.";

/** Play sessions this browser still keeps (the play page's and the game page's copies). */
function storedTokens(): string[] {
  try {
    const guest = JSON.parse(localStorage.getItem(GUEST_SESSION_KEY) ?? "null") as { token?: string } | null;
    return [guest?.token, localStorage.getItem("petdex.token")].filter((t): t is string => typeof t === "string" && t.length >= 16);
  } catch {
    return [];
  }
}

/**
 * Sign in or sign up with a name and a password (the play page, when the browser has no session).
 * An old account that has no password yet ("claim") gets one here only if this browser still holds
 * that account's play session; otherwise an administrator's one-time link is the way.
 */
export function AccountForm({ onSignedIn }: { onSignedIn: (account: GameAccount & { token: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "claim">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [noPassword, setNoPassword] = useState(false);
  const [noProof, setNoProof] = useState(false);

  const reset = (next: "login" | "register" | "claim") => {
    setMode(next);
    setMessage(null);
    setNoPassword(false);
    setNoProof(false);
    setPassword("");
    setConfirm("");
  };

  const startClaim = () => {
    if (!storedTokens().length) return setNoProof(true);
    setMode("claim");
    setMessage(null);
    setPassword("");
    setConfirm("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    const problem = mode === "register" ? checkNew(name, password, confirm) : mode === "claim" ? checkPassword(password, confirm) : null;
    if (problem) return setMessage(problem);
    setBusy(true);
    setMessage(null);
    try {
      const body = mode === "claim" ? { action: "claim", username: name, password, tokens: storedTokens() } : { action: mode, username: name, password };
      const account = await api<GameAccount>("/api/ta-tua/account", { method: "POST", body });
      if (account.token) onSignedIn({ ...account, token: account.token });
    } catch (err) {
      const reason = err instanceof ApiError ? err.fields?.reason : undefined;
      if (reason === "no_password") setNoPassword(true);
      else if (reason === "no_proof") {
        reset("login");
        setNoPassword(true);
        setNoProof(true);
      } else setMessage(failure(err));
      setBusy(false);
    }
  };

  const claiming = mode === "claim";
  const newPassword = mode !== "login";
  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented
        value={claiming ? "login" : mode}
        onChange={reset}
        options={[
          { value: "login", label: "Đăng nhập" },
          { value: "register", label: "Tạo tài khoản" },
        ]}
      />
      <Field label="Tên đăng nhập" htmlFor="tt-username" hint={mode === "register" ? nameHint : undefined}>
        <Input
          id="tt-username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setNoPassword(false);
            setNoProof(false);
          }}
          autoComplete="username"
          maxLength={20}
          required
          readOnly={claiming}
          autoFocus
        />
      </Field>
      {claiming && <p className="text-sm text-muted-foreground">Trình duyệt này còn phiên chơi của tài khoản. Đặt mật khẩu để lần sau đăng nhập bằng tên này.</p>}
      <Field label={claiming ? "Mật khẩu mới" : "Mật khẩu"} htmlFor="tt-password" hint={newPassword ? "Ít nhất 6 ký tự." : undefined}>
        <Input
          id="tt-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={newPassword ? "new-password" : "current-password"}
          required={newPassword}
        />
      </Field>
      {newPassword && (
        <Field label="Nhập lại mật khẩu" htmlFor="tt-confirm">
          <Input id="tt-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
      )}
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      {noPassword && mode === "login" && (
        <div role="alert" className="space-y-2 rounded-md border bg-muted/50 p-3 text-sm">
          <p className="font-medium">Tài khoản này chưa có mật khẩu.</p>
          {noProof ? (
            <p className="text-muted-foreground">{NO_PROOF}</p>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={startClaim}>
              <KeyRound className="h-4 w-4" /> Tạo mật khẩu
            </Button>
          )}
        </div>
      )}
      <Button type="submit" className="w-full" loading={busy} disabled={!username.trim() || (newPassword && !password)}>
        {mode === "register" ? "Tạo tài khoản và vào chơi" : claiming ? "Lưu mật khẩu và vào chơi" : "Vào chơi"}
      </Button>
      {claiming && (
        <button type="button" onClick={() => reset("login")} className="w-full rounded-md py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          ← Quay lại đăng nhập
        </button>
      )}
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
