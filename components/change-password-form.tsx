"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";

const RULES = [
  { test: (p: string) => p.length >= 8, label: "Ít nhất 8 ký tự" },
  { test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p), label: "Có chữ hoa và chữ thường" },
  { test: (p: string) => /[0-9]/.test(p), label: "Có ít nhất một chữ số" },
];

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const checks = useMemo(() => RULES.map((r) => ({ ...r, ok: r.test(next) })), [next]);
  const strength = checks.filter((c) => c.ok).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setErrors({ confirm: "Mật khẩu xác nhận không khớp" });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      await api("/api/auth/change-password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      toast.success("Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.");
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Mật khẩu hiện tại" error={errors.currentPassword}>
        <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Mật khẩu mới" error={errors.newPassword}>
        <Input type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      {next && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < strength ? (strength === 3 ? "bg-success" : strength === 2 ? "bg-warning" : "bg-danger") : "bg-muted",
                )}
              />
            ))}
          </div>
          <ul className="space-y-1">
            {checks.map((c) => (
              <li key={c.label} className={cn("flex items-center gap-1.5 text-xs", c.ok ? "text-success" : "text-muted-foreground")}>
                {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Field label="Xác nhận mật khẩu mới" error={errors.confirm}>
        <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" loading={loading} disabled={strength < 3 || !current || !confirm}>
        Cập nhật mật khẩu
      </Button>
    </form>
  );
}
