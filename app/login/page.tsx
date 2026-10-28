import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { FolderKanban, ShieldCheck } from "lucide-react";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
            <FolderKanban className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="text-base font-semibold tracking-tight">WorkHub</span>
        </div>
        <Suspense>
          <LoginForm showDemoHint={process.env.NODE_ENV !== "production"} />
        </Suspense>
      </div>
      <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Phiên đăng nhập được mã hoá và bảo vệ chống dò mật khẩu.
      </p>
    </div>
  );
}
