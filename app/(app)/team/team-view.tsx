"use client";

import { useMemo, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Pencil, Search, ShieldAlert, UserCheck, UserPlus, UserX, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { api, ApiError, useApi } from "@/lib/client";
import { ROLE_LABELS } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  jobTitle: string | null;
  avatarColor: string;
  active: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  mustChangePassword?: boolean;
  _count: { assignedTasks: number };
}

/** Strong temporary password that satisfies the policy (upper, lower, digit, symbol). */
function generatePassword(): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const rand = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const chars = sets.map((s) => s[rand(s.length)]);
  while (chars.length < 14) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function PasswordField({ value, onChange, error, label }: { value: string; onChange: (v: string) => void; error?: string; label: string }) {
  return (
    <Field label={label} error={error} hint="Người dùng sẽ bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.">
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" autoComplete="new-password" />
        <Button type="button" variant="outline" onClick={() => onChange(generatePassword())} title="Tạo mật khẩu mạnh">
          <Wand2 className="h-4 w-4" /> Tạo
        </Button>
      </div>
    </Field>
  );
}

/** Shown once after creating/resetting: the admin hands the temporary password over. */
function CredentialNotice({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Tài khoản WorkHub\nEmail: ${email}\nMật khẩu tạm thời: ${password}\n(Bạn sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần đầu.)`;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Thông tin đăng nhập tạm thời"
      description="Mật khẩu chỉ hiển thị một lần. Hãy gửi cho nhân viên qua kênh an toàn."
      footer={<Button onClick={onClose}>Xong</Button>}
    >
      <div className="space-y-2 rounded-xl border bg-muted/40 p-4 font-mono text-sm">
        <p>
          <span className="text-muted-foreground">Email:</span> {email}
        </p>
        <p>
          <span className="text-muted-foreground">Mật khẩu:</span> {password}
        </p>
      </div>
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => undefined);
          setCopied(true);
        }}
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} Sao chép thông tin
      </Button>
    </Modal>
  );
}

function CreateMemberModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (email: string, pw: string) => void }) {
  const [v, setV] = useState({ name: "", email: "", jobTitle: "", role: "MEMBER", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await api("/api/users", { method: "POST", body: { ...v, jobTitle: v.jobTitle || null } });
      toast.success(`Đã tạo tài khoản cho ${v.name}`);
      onCreated(v.email.trim().toLowerCase(), v.password);
      setV({ name: "", email: "", jobTitle: "", role: "MEMBER", password: "" });
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields ?? {});
        toast.error(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm nhân viên"
      description="Tạo tài khoản đăng nhập cho thành viên mới."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy} disabled={!v.name.trim() || !v.email.trim() || !v.password}>
            Tạo tài khoản
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ và tên" error={errors.name}>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Nguyễn Văn A" autoFocus />
        </Field>
        <Field label="Email hoặc tên đăng nhập" error={errors.email}>
          <Input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="ten@congty.vn hoặc nguyenvana" autoCapitalize="none" />
        </Field>
        <Field label="Chức danh">
          <Input value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} placeholder="VD: Chuyên viên Marketing" />
        </Field>
        <Field label="Vai trò">
          <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <PasswordField label="Mật khẩu tạm thời" value={v.password} onChange={(password) => setV({ ...v, password })} error={errors.password} />
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        <b className="text-foreground">Phân quyền:</b> Quản trị viên — toàn quyền & quản lý tài khoản · Quản lý — tạo dự án, giao việc, duyệt báo cáo · Nhân viên — thực hiện
        công việc & gửi báo cáo.
      </div>
    </Modal>
  );
}

function EditMemberModal({ member, onClose, onSaved, isSelf }: { member: Member; onClose: () => void; onSaved: () => void; isSelf: boolean }) {
  const [v, setV] = useState({ email: member.email, name: member.name, jobTitle: member.jobTitle ?? "", role: member.role });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await api(`/api/users/${member.id}`, {
        method: "PATCH",
        body: { email: v.email, name: v.name, jobTitle: v.jobTitle || null, role: v.role },
      });
      toast.success(isSelf && v.email.trim().toLowerCase() !== member.email ? "Đã đổi email — vui lòng đăng nhập lại bằng email mới" : "Đã cập nhật");
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields ?? {});
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Chỉnh sửa thông tin"
      description={member.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Email hoặc tên đăng nhập" error={errors.email} hint="Đổi thông tin đăng nhập sẽ đăng xuất người dùng khỏi mọi thiết bị.">
          <Input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoCapitalize="none" />
        </Field>
        <Field label="Họ và tên">
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Chức danh">
          <Input value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} />
        </Field>
        <Field label="Vai trò" hint={isSelf ? "Bạn không thể tự thay đổi vai trò của mình." : "Đổi vai trò sẽ đăng xuất người dùng để áp dụng quyền mới."}>
          <Select value={v.role} disabled={isSelf} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose, onDone }: { member: Member; onClose: () => void; onDone: (pw: string) => void }) {
  const [pw, setPw] = useState(generatePassword);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/users/${member.id}`, { method: "PATCH", body: { resetPassword: pw } });
      toast.success("Đã đặt lại mật khẩu — mọi phiên đăng nhập của người dùng đã bị thu hồi");
      onDone(pw);
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setError(e.fields?.resetPassword ?? e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Đặt lại mật khẩu · ${member.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy}>
            Đặt lại
          </Button>
        </>
      }
    >
      <PasswordField label="Mật khẩu tạm thời mới" value={pw} onChange={setPw} error={error} />
    </Modal>
  );
}

export function TeamView({ meId, admin }: { meId: string; admin: boolean }) {
  const { data, loading, reload } = useApi<{ users: Member[] }>("/api/users");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"ALL" | "ADMIN" | "MANAGER" | "MEMBER">("ALL");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [resetting, setResetting] = useState<Member | null>(null);
  const [toggling, setToggling] = useState<Member | null>(null);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);

  const users = useMemo(
    () =>
      (data?.users ?? []).filter(
        (u) =>
          (role === "ALL" || u.role === role) &&
          (!q.trim() || `${u.name} ${u.email} ${u.jobTitle ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [data, q, role],
  );
  const active = (data?.users ?? []).filter((u) => u.active).length;

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        description={admin ? `${active} tài khoản đang hoạt động · quản lý tài khoản, vai trò và bảo mật` : "Danh bạ thành viên trong hệ thống"}
        actions={
          admin && (
            <Button onClick={() => setCreating(true)}>
              <UserPlus className="h-4 w-4" /> Thêm nhân viên
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          layoutId="team-role"
          value={role}
          onChange={setRole}
          options={[
            { value: "ALL", label: "Tất cả" },
            { value: "ADMIN", label: ROLE_LABELS.ADMIN },
            { value: "MANAGER", label: ROLE_LABELS.MANAGER },
            { value: "MEMBER", label: ROLE_LABELS.MEMBER },
          ]}
        />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, email, chức danh…"
            className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="Không tìm thấy nhân sự" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Nhân sự</th>
                  <th className="px-3 py-3 text-left font-medium">Vai trò</th>
                  <th className="px-3 py-3 text-left font-medium">Trạng thái</th>
                  <th className="px-3 py-3 text-right font-medium">Công việc</th>
                  {admin && <th className="px-3 py-3 text-left font-medium">Đăng nhập gần nhất</th>}
                  {admin && <th className="px-5 py-3 text-right font-medium">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={cn("border-b last:border-0", !u.active && "opacity-60")}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} color={u.avatarColor} />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {u.name}
                            {u.id === meId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(bạn)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {u.email}
                            {u.jobTitle && ` · ${u.jobTitle}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-3 py-3">
                      {!u.active ? (
                        <Badge className="bg-muted text-muted-foreground">Đã vô hiệu hoá</Badge>
                      ) : u.mustChangePassword ? (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          <ShieldAlert className="h-3 w-3" /> Chờ đổi mật khẩu
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Hoạt động</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{u._count.assignedTasks}</td>
                    {admin && <td className="px-3 py-3 text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Chưa đăng nhập"}</td>}
                    {admin && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Chỉnh sửa" aria-label="Chỉnh sửa" onClick={() => setEditing(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu" onClick={() => setResetting(u)}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {u.id !== meId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title={u.active ? "Vô hiệu hoá" : "Kích hoạt lại"}
                              aria-label={u.active ? "Vô hiệu hoá" : "Kích hoạt lại"}
                              className={u.active ? "hover:text-danger" : "hover:text-success"}
                              onClick={() => setToggling(u)}
                            >
                              {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {admin && (
        <>
          <CreateMemberModal open={creating} onClose={() => setCreating(false)} onCreated={(email, password) => { setCredential({ email, password }); void reload(); }} />
          {editing && <EditMemberModal member={editing} isSelf={editing.id === meId} onClose={() => setEditing(null)} onSaved={reload} />}
          {resetting && (
            <ResetPasswordModal
              member={resetting}
              onClose={() => setResetting(null)}
              onDone={(password) => {
                setCredential({ email: resetting.email, password });
                void reload();
              }}
            />
          )}
          <ConfirmDialog
            open={!!toggling}
            onClose={() => setToggling(null)}
            danger={toggling?.active}
            title={toggling?.active ? "Vô hiệu hoá tài khoản?" : "Kích hoạt lại tài khoản?"}
            confirmLabel={toggling?.active ? "Vô hiệu hoá" : "Kích hoạt"}
            message={
              toggling?.active ? (
                <>
                  <b className="text-foreground">{toggling?.name}</b> sẽ bị đăng xuất ngay và không thể đăng nhập. Công việc và báo cáo của họ vẫn được giữ nguyên.
                </>
              ) : (
                <>
                  <b className="text-foreground">{toggling?.name}</b> sẽ có thể đăng nhập lại.
                </>
              )
            }
            onConfirm={async () => {
              try {
                await api(`/api/users/${toggling!.id}`, { method: "PATCH", body: { active: !toggling!.active } });
                toast.success(toggling!.active ? "Đã vô hiệu hoá tài khoản" : "Đã kích hoạt tài khoản");
                await reload();
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
              }
            }}
          />
          {credential && <CredentialNotice email={credential.email} password={credential.password} onClose={() => setCredential(null)} />}
        </>
      )}
    </div>
  );
}
