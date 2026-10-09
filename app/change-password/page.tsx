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
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold">Đặt mật khẩu mới</h1>
            <p className="text-sm text-muted-foreground">Xin chào {user.name}, vui lòng đổi mật khẩu tạm thời trước khi tiếp tục.</p>
          </div>
        </div>
        <ForcedChangePassword />
      </div>
    </div>
  );
}
