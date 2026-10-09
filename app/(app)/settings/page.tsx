import { KeyRound, Palette, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ThemeChoice } from "./theme-choice";
import { formatDateTime } from "@/lib/utils";

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
                <dt className="text-xs text-muted-foreground">Vai trò</dt>
                <dd className="mt-0.5">
                  <RoleBadge role={me.role} />
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
