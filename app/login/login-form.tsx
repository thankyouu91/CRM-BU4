"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError, clearApiCache } from "@/lib/client";

/** Only allow same-site relative paths, to prevent open redirects via ?next=. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

export function LoginForm({ showDemoHint }: { showDemoHint: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ mustChangePassword: boolean; user: { name: string } }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      clearApiCache();
      toast.success(`Chào mừng, ${res.user.name}!`);
      router.replace(res.mustChangePassword ? "/change-password" : safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể đăng nhập");
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-xl font-semibold tracking-tight">Đăng nhập</h1>
      <p className="mt-1 text-sm text-muted-foreground">Dùng tài khoản được quản trị viên cấp.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email hoặc tên đăng nhập" htmlFor="email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@congty.vn hoặc admin"
              className="pl-9"
            />
          </div>
        </Field>
        <Field label="Mật khẩu" htmlFor="password">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="px-9"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Đăng nhập
        </Button>
      </form>

      {showDemoHint && (
        <div className="mt-6 rounded-lg border border-dashed p-3.5 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Tài khoản demo (môi trường phát triển)</p>
          <p className="mt-1.5">
            Quản trị: <code className="font-mono text-foreground">admin@crm.local</code> /{" "}
            <code className="font-mono text-foreground">Admin@1234</code>
          </p>
          <p>
            Quản lý: <code className="font-mono text-foreground">cuong.le@crm.local</code> /{" "}
            <code className="font-mono text-foreground">Demo@1234</code>
          </p>
          <p>
            Nhân viên: <code className="font-mono text-foreground">hai.do@crm.local</code> /{" "}
            <code className="font-mono text-foreground">Demo@1234</code>
          </p>
        </div>
      )}
    </div>
  );
}
