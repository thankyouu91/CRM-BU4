import Link from "next/link";
import { ChevronRight, History, KeyRound, Palette, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ThemeChoice } from "./theme-choice";
import { BackupsCard } from "./backups-card";
import { AiSettingsCard } from "./ai-card";
import { formatDateTime } from "@/lib/utils";
import { PERMISSION_INFO } from "@/lib/permissions";
import { isAdmin } from "@/lib/rbac";

export const metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const me = (await getCurrentUser())!;
  const extra = await prisma.user.findUnique({
    where: { id: me.id },
    select: { createdAt: true, lastLoginAt: true },
  });

  return (
    <div className="max-w-4xl">
      <PageHeader title="Cài đặt tài khoản" description="Thông tin cá nhân, mật khẩu và giao diện." />
      <div className="space-y-6">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> Hồ sơ</span>} description="Thông tin do quản trị viên quản lý." />
          <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar name={me.name} color={me.avatarColor} size="lg" />
            <dl className="grid flex-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Họ và tên</dt>
                <dd className="font-medium">{me.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="font-medium">{me.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Chức danh</dt>
                <dd className="font-medium">{me.jobTitle ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Cấp bậc</dt>
                <dd className="mt-0.5">
                  <RoleBadge role={me.role} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Quyền của bạn</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {me.permissions.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Thực hiện và báo cáo công việc được giao. Quản lý có thể cấp thêm quyền cho bạn.</span>
                  ) : (
                    me.permissions.map((p) => (
                      <Badge key={p} className="bg-primary/10 text-primary">
                        {PERMISSION_INFO[p].label}
                      </Badge>
                    ))
                  )}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Đổi mật khẩu</span>} description="Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số." />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Bảo mật</span>} />
            <CardBody className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Đăng nhập gần nhất</p>
                <p className="font-medium">{extra?.lastLoginAt ? formatDateTime(extra.lastLoginAt) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ngày tạo tài khoản</p>
                <p className="font-medium">{extra?.createdAt ? formatDateTime(extra.createdAt) : "—"}</p>
              </div>
              <ul className="space-y-1.5 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                <li>• Phiên đăng nhập hết hạn sau 7 ngày.</li>
                <li>• Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác.</li>
                <li>• Đăng nhập sai nhiều lần sẽ bị tạm khoá 15 phút.</li>
              </ul>
            </CardBody>
          </Card>
        </div>

        {isAdmin(me) && (
          <Link href="/settings/audit-log" className="block rounded-2xl transition-shadow hover:shadow-md">
            <Card className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Nhật ký thao tác</p>
                <p className="text-sm text-muted-foreground">Xem ai đã tạo, sửa, xoá dữ liệu, đổi quyền hay đăng nhập, lúc nào và từ đâu. Chỉ quản trị viên thấy mục này.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        )}
        {isAdmin(me) && <AiSettingsCard />}
        {isAdmin(me) && <BackupsCard />}

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Giao diện</span>} description="Áp dụng trên trình duyệt này." />
          <CardBody>
            <ThemeChoice />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
