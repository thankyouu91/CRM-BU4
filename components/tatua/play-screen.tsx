"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";
import { GAME_PAGE, GUEST_SESSION_KEY, INVITE_PATH, PLAY_PATH, type GuestSession } from "@/lib/petdex-public";
import { AccountForm, CredentialsNotice } from "./account";
import { MeadowShell } from "./meadow";

/** `next dev` cannot proxy WebSockets: the park then connects to the local game server directly. */
const DEV_WS = process.env.NODE_ENV !== "production" ? "ws://127.0.0.1:3200/ta-tua/ws" : null;

export function frameSrc(token: string) {
  const params = new URLSearchParams({ token });
  if (DEV_WS) params.set("ws", DEV_WS);
  return `${GAME_PAGE}#${params.toString()}`;
}

export function readGuest(): GuestSession | null {
  try {
    const kept = JSON.parse(localStorage.getItem(GUEST_SESSION_KEY) ?? "null") as GuestSession | null;
    return kept?.token ? kept : null;
  } catch {
    return null;
  }
}

export function saveGuest(session: GuestSession) {
  try {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  } catch {
    // private mode: the guest just types a name again next time
  }
}

/**
 * Leaving for real: the game forgets the session, and the browser drops both its copy and the one
 * the game page keeps (`petdex.token`), so the next person on a shared computer starts signed out.
 */
function signOut(token: string) {
  fetch("/ta-tua/api/auth/logout", { method: "POST", headers: { authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
  try {
    localStorage.removeItem("petdex.token");
  } catch {
    // nothing kept
  }
  forgetGuest();
}

export function forgetGuest() {
  try {
    localStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    // nothing kept
  }
}

function Frame({ token, who, action }: { token: string; who: string; action: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
          <Gamepad2 className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">Pet Town</span>
        <span className="truncate text-xs text-muted-foreground">{who}</span>
        <span className="ml-auto">{action}</span>
      </header>
      <CredentialsNotice token={token} />
      <iframe src={frameSrc(token)} title="Pet Town" className="min-h-0 w-full flex-1" allow="autoplay" />
    </div>
  );
}

/**
 * The full-screen play page: a signed-in WorkHub member, or a session this browser kept (an invite
 * guest, or a name + password account). Without one it offers sign-in and sign-up on the meadow.
 */
export function PlayScreen({ member }: { member: { name: string; token: string } | null }) {
  const router = useRouter();
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [checking, setChecking] = useState(!member);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (member) return;
    const kept = readGuest();
    if (!kept) {
      setChecking(false);
      return;
    }
    api<{ ok: boolean; displayName?: string; kind?: string; hasPassword?: boolean }>("/api/ta-tua/guest", { method: "POST", body: { resume: kept.token } })
      .then((res) => {
        if (res.ok) setGuest({ ...kept, name: res.displayName ?? kept.name, kind: res.kind, hasPassword: res.hasPassword });
        else forgetGuest();
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [member]);

  if (member) {
    return (
      <Frame
        token={member.token}
        who={`${member.name} · tài khoản WorkHub`}
        action={<span className="text-xs text-muted-foreground">Phiên chơi theo tài khoản WorkHub</span>}
      />
    );
  }
  if (guest) {
    // An invite guest without a password can only come back through the invite, as a new name.
    const invited = guest.kind === "guest" && Boolean(guest.code) && !guest.hasPassword;
    const leave = () => {
      signOut(guest.token);
      if (invited) router.replace(`${INVITE_PATH}/${guest.code}`);
      else setGuest(null);
    };
    return (
      <Frame
        token={guest.token}
        who={guest.kind === "guest" ? `Khách mời · ${guest.name}` : guest.name}
        action={
          <button onClick={leave} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> {invited ? "Đổi tên khác" : "Đăng xuất"}
          </button>
        }
      />
    );
  }

  const openInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const found = /([a-f0-9]{6,64})\/?$/i.exec(code.trim());
    if (found) router.push(`${INVITE_PATH}/${found[1]}`);
  };
  return (
    <MeadowShell>
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
        <Gamepad2 className="h-5 w-5" />
      </span>
      <h1 className="text-lg font-semibold">Pet Town</h1>
      {checking ? (
        <p className="mt-1 text-sm text-muted-foreground">Đang mở phiên chơi…</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Chưa có tài khoản thì tạo một cái, lần sau chỉ cần nhớ tên và mật khẩu.</p>
          <div className="mt-5">
            <AccountForm
              onSignedIn={(account) => {
                const session = { token: account.token, name: account.displayName, code: "", kind: account.kind };
                saveGuest(session);
                setGuest({ ...session, hasPassword: true });
              }}
            />
          </div>
          <div className="mt-6 border-t pt-5">
            <p className="text-xs text-muted-foreground">Có link mời? Dán vào đây để vào chơi chỉ bằng tên.</p>
            <form onSubmit={openInvite} className="mt-2 flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Link hoặc mã mời" aria-label="Link hoặc mã mời" />
              <Button type="submit" variant="outline" disabled={!/[a-f0-9]{6,}/i.test(code)}>
                Mở
              </Button>
            </form>
            <Link href={`/login?next=${encodeURIComponent(PLAY_PATH)}`} className="mt-3 flex h-9 items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted">
              <LogIn className="h-4 w-4" /> Nhân viên WorkHub đăng nhập
            </Link>
          </div>
        </>
      )}
    </MeadowShell>
  );
}
