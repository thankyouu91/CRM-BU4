"use client";

import { useMemo, useState } from "react";
import { Check, Copy, KeyRound, Layers3, Loader2, Minus, Pencil, Search, ShieldAlert, ShieldCheck, UserCheck, UserPlus, UserX, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState, PageHeader, Segmented } from "@/components/ui/misc";
import { api, ApiError, useApi } from "@/lib/client";
import {
  type Actor,
  assignableRoles,
  canManageUser,
  effectivePermissions,
  grantablePermissions,
  hasPermission,
  PERMISSION_INFO,
  PERMISSIONS,
  type PermissionKey,
  ROLE_DEFAULTS,
  ROLE_INFO,
  ROLE_LEVEL,
  ROLES,
  type RoleKey,
} from "@/lib/permissions";
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
  /** Individually granted permissions (visible to account managers). */
  permissions?: string[];
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

/** Level + permission checkboxes. Level defaults are shown checked and locked. */
function PermissionChecklist({
  role,
  granted,
  grantable,
  onChange,
}: {
  role: string;
  granted: string[];
  grantable: readonly PermissionKey[];
  onChange: (next: string[]) => void;
}) {
  const defaults = ROLE_DEFAULTS[role as RoleKey] ?? [];
  return (
    <ul className="divide-y rounded-xl border">
      {PERMISSIONS.map((p) => {
        const included = defaults.includes(p);
        const allowed = grantable.includes(p);
        const checked = included || granted.includes(p);
        const disabled = included || !allowed;
        return (
          <li key={p}>
            <label className={cn("flex items-start gap-3 px-3.5 py-3", disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/50")}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked ? [...granted, p] : granted.filter((g) => g !== p))}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {PERMISSION_INFO[p].label}
                  {included && <Badge className="bg-muted text-muted-foreground">Có sẵn theo cấp bậc</Badge>}
                  {!included && !allowed && <Badge className="bg-muted text-muted-foreground">Ngoài quyền của bạn</Badge>}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{PERMISSION_INFO[p].description}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function RoleSelect({ value, onChange, roles, disabled }: { value: string; onChange: (r: string) => void; roles: readonly RoleKey[]; disabled?: boolean }) {
  // Keep the current level selectable even when the actor could not assign it.
  const options = roles.includes(value as RoleKey) ? roles : [value as RoleKey, ...roles];
  return (
    <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {options.map((r) => (
        <option key={r} value={r}>
          {ROLE_INFO[r]?.label ?? r}
        </option>
      ))}
    </Select>
  );
}

/** The four levels and what each one includes. */
function LevelsOverview({ canDelegate }: { canDelegate: boolean }) {
  return (
    <section className="mb-6 rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Layers3 className="h-4 w-4 text-primary" /> Các cấp phân quyền
          </h2>
          <p className="text-xs text-muted-foreground">
            Mỗi cấp có sẵn một nhóm quyền. Người có quyền “Quản lý nhân viên” cấp thêm quyền cho người ở cấp thấp hơn, trong phạm vi quyền của chính mình.
          </p>
        </div>
        {canDelegate && (
          <p className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Bấm biểu tượng khiên ở mỗi dòng để phân quyền
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border bg-muted/30 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <RoleBadge role={r} />
              <span className="text-[11px] tabular-nums text-muted-foreground">Cấp {ROLE_LEVEL[r]}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{ROLE_INFO[r].summary}</p>
            <ul className="mt-2.5 space-y-1">
              {PERMISSIONS.map((p) => {
                const has = ROLE_DEFAULTS[r].includes(p);
                return (
                  <li key={p} className={cn("flex items-center gap-1.5 text-xs", has ? "text-foreground" : "text-muted-foreground/70")}>
                    {has ? <Check className="h-3.5 w-3.5 text-success" /> : <Minus className="h-3.5 w-3.5" />}
                    {PERMISSION_INFO[p].label}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateMemberModal({
  open,
  actor,
  onClose,
  onCreated,
}: {
  open: boolean;
  actor: Actor;
  onClose: () => void;
  onCreated: (email: string, pw: string) => void;
}) {
  const roles = assignableRoles(actor);
  const blank = () => ({
    name: "",
    email: "",
    jobTitle: "",
    role: (roles.includes("MEMBER") ? "MEMBER" : roles[roles.length - 1]) as string,
    password: "",
    permissions: [] as string[],
  });
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await api("/api/users", { method: "POST", body: { ...v, jobTitle: v.jobTitle || null } });
      toast.success(`Đã tạo tài khoản cho ${v.name}`);
      onCreated(v.email.trim().toLowerCase(), v.password);
      setV(blank());
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
      size="lg"
      title="Thêm nhân viên"
      description="Tạo tài khoản đăng nhập, chọn cấp bậc và cấp thêm quyền nếu cần."
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
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Họ và tên" error={errors.name}>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Nguyễn Văn A" autoFocus />
          </Field>
          <Field label="Email hoặc tên đăng nhập" error={errors.email}>
            <Input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="ten@congty.vn hoặc nguyenvana" autoCapitalize="none" />
          </Field>
          <Field label="Chức danh">
            <Input value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} placeholder="VD: Chuyên viên Marketing" />
          </Field>
          <PasswordField label="Mật khẩu tạm thời" value={v.password} onChange={(password) => setV({ ...v, password })} error={errors.password} />
        </div>
        <div className="space-y-4">
          <Field label="Cấp bậc" hint={ROLE_INFO[v.role as RoleKey]?.summary}>
            <RoleSelect value={v.role} roles={roles} onChange={(role) => setV({ ...v, role })} />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground/80">Quyền</p>
            <PermissionChecklist role={v.role} granted={v.permissions} grantable={grantablePermissions(actor)} onChange={(permissions) => setV({ ...v, permissions })} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PermissionsModal({ member, actor, onClose, onSaved }: { member: Member; actor: Actor; onClose: () => void; onSaved: () => void }) {
  const isSelf = member.id === actor.id;
  const [role, setRole] = useState(member.role);
  const [granted, setGranted] = useState<string[]>(member.permissions ?? []);
  const [busy, setBusy] = useState(false);
  const roleChanged = role !== member.role;

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/users/${member.id}`, { method: "PATCH", body: { role, permissions: granted } });
      toast.success(roleChanged ? `Đã đổi cấp bậc của ${member.name} — họ cần đăng nhập lại` : `Đã cập nhật quyền của ${member.name}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể cập nhật");
    } finally {
      setBusy(false);
    }
  };

  const effective = effectivePermissions(role, granted);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Phân quyền · ${member.name}`}
      description="Quyền mới có hiệu lực ngay ở thao tác tiếp theo của người dùng."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={busy}>
            Lưu phân quyền
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Cấp bậc"
          hint={isSelf ? "Bạn không thể tự thay đổi cấp bậc của mình." : roleChanged ? "Đổi cấp bậc sẽ đăng xuất người dùng để áp dụng quyền mới." : ROLE_INFO[role as RoleKey]?.summary}
        >
          <RoleSelect value={role} roles={assignableRoles(actor)} disabled={isSelf} onChange={setRole} />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground/80">
            Quyền <span className="text-muted-foreground">({effective.length}/{PERMISSIONS.length} đang có)</span>
          </p>
          <PermissionChecklist role={role} granted={granted} grantable={role === "ADMIN" ? [] : grantablePermissions(actor)} onChange={setGranted} />
        </div>
      </div>
    </Modal>
  );
}

function EditMemberModal({ member, onClose, onSaved, isSelf }: { member: Member; onClose: () => void; onSaved: () => void; isSelf: boolean }) {
  const [v, setV] = useState({ email: member.email, name: member.name, jobTitle: member.jobTitle ?? "" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await api(`/api/users/${member.id}`, {
        method: "PATCH",
        body: { email: v.email, name: v.name, jobTitle: v.jobTitle || null },
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
      </div>
    </Modal>
  );
}

/** Extra grants beyond the level, as compact chips. */
function GrantChips({ member }: { member: Member }) {
  const extras = (member.permissions ?? []).filter((p) => !ROLE_DEFAULTS[member.role as RoleKey]?.includes(p as PermissionKey));
  if (member.role === "ADMIN") return <span className="text-xs text-muted-foreground">Toàn quyền</span>;
  if (extras.length === 0) return <span className="text-xs text-muted-foreground">Theo cấp bậc</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {extras.map((p) => (
        <Badge key={p} className="bg-primary/10 text-primary">
          + {PERMISSION_INFO[p as PermissionKey]?.label ?? p}
        </Badge>
      ))}
    </div>
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

export function TeamView({ actor }: { actor: Actor }) {
  const { data, loading, reload } = useApi<{ users: Member[] }>("/api/users");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"ALL" | RoleKey>("ALL");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [granting, setGranting] = useState<Member | null>(null);
  const [resetting, setResetting] = useState<Member | null>(null);
  const [toggling, setToggling] = useState<Member | null>(null);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);

  // Admins and holders of "Quản lý nhân viên" administer accounts below their level.
  const managing = actor.role === "ADMIN" || hasPermission(actor, "USER_MANAGE");
  const canCreate = assignableRoles(actor).length > 0;

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
        description={managing ? `${active} tài khoản đang hoạt động · quản lý tài khoản, cấp bậc và quyền` : "Danh bạ thành viên trong hệ thống"}
        actions={
          canCreate && (
            <Button onClick={() => setCreating(true)}>
              <UserPlus className="h-4 w-4" /> Thêm nhân viên
            </Button>
          )
        }
      />

      <LevelsOverview canDelegate={managing} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          layoutId="team-role"
          value={role}
          onChange={setRole}
          className="max-w-full overflow-x-auto"
          options={[{ value: "ALL" as const, label: "Tất cả" }, ...ROLES.map((r) => ({ value: r, label: ROLE_INFO[r].label }))]}
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
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Nhân sự</th>
                  <th className="px-3 py-3 text-left font-medium">Cấp bậc</th>
                  {managing && <th className="px-3 py-3 text-left font-medium">Quyền thêm</th>}
                  <th className="px-3 py-3 text-left font-medium">Trạng thái</th>
                  <th className="px-3 py-3 text-right font-medium">Công việc</th>
                  {managing && <th className="px-3 py-3 text-left font-medium">Đăng nhập gần nhất</th>}
                  {managing && <th className="px-5 py-3 text-right font-medium">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const manageable = canManageUser(actor, u);
                  return (
                    <tr key={u.id} className={cn("border-b last:border-0", !u.active && "opacity-60")}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} color={u.avatarColor} />
                          <div className="min-w-0">
                            <p className="font-medium">
                              {u.name}
                              {u.id === actor.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(bạn)</span>}
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
                      {managing && (
                        <td className="max-w-[220px] px-3 py-3">
                          <GrantChips member={u} />
                        </td>
                      )}
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
                      {managing && <td className="px-3 py-3 text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Chưa đăng nhập"}</td>}
                      {managing && (
                        <td className="px-5 py-3">
                          {manageable ? (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" title="Phân quyền" aria-label="Phân quyền" className="hover:text-primary" onClick={() => setGranting(u)}>
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="Chỉnh sửa thông tin" aria-label="Chỉnh sửa thông tin" onClick={() => setEditing(u)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu" onClick={() => setResetting(u)}>
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              {u.id !== actor.id && (
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
                          ) : (
                            <p className="text-right text-xs text-muted-foreground">{u.id === actor.id ? "—" : "Cấp ngang hoặc cao hơn"}</p>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {managing && (
        <>
          {canCreate && (
            <CreateMemberModal
              open={creating}
              actor={actor}
              onClose={() => setCreating(false)}
              onCreated={(email, password) => {
                setCredential({ email, password });
                void reload();
              }}
            />
          )}
          {granting && <PermissionsModal member={granting} actor={actor} onClose={() => setGranting(null)} onSaved={reload} />}
          {editing && <EditMemberModal member={editing} isSelf={editing.id === actor.id} onClose={() => setEditing(null)} onSaved={reload} />}
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
