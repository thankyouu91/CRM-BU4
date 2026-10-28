import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { FolderKanban, ShieldCheck } from "lucide-react";
import { GalaxyBackground } from "@/components/login/galaxy-background";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");

  // Always dark here (the galaxy needs a night sky): "dark" switches the tokens for this page only.
  return (
    <div className="dark relative min-h-[100dvh] overflow-hidden bg-[#05060a] text-foreground">
      {/* What shows without WebGL, and while three.js loads. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_45%_30%_at_64%_52%,rgba(255,170,110,0.22),transparent),radial-gradient(ellipse_70%_45%_at_64%_52%,rgba(80,100,255,0.12),transparent)]"
      />
      <GalaxyBackground className="absolute inset-0" />
      {/* Darker edges keep the form readable over the stars. */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.6))]" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col justify-center px-4 py-12 sm:px-8 lg:px-[8vw]">
        <div className="mx-auto w-full max-w-sm rounded-xl border border-white/10 bg-black/50 p-6 shadow-pop backdrop-blur-md sm:p-8 lg:mx-0">
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
        <p className="mx-auto mt-6 flex items-center gap-1.5 text-xs text-white/60 lg:mx-0">
          <ShieldCheck className="h-3.5 w-3.5" /> Phiên đăng nhập được mã hoá và bảo vệ chống dò mật khẩu.
        </p>
      </div>
    </div>
  );
}
