import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { ForcedChangePassword } from "./forced-change";

export const metadata = { title: "Đổi mật khẩu" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/settings");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 sm:p-8">
        <div className="mb-6">
          <ShieldCheck className="mb-3 h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold tracking-tight">Đặt mật khẩu mới</h1>
          <p className="mt-1 text-sm text-muted-foreground">Xin chào {user.name}, vui lòng đổi mật khẩu tạm thời trước khi tiếp tục.</p>
        </div>
        <ForcedChangePassword />
      </div>
    </div>
  );
}
