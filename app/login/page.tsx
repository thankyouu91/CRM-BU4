import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { BarChart3, FolderKanban, Presentation, ShieldCheck, Sparkles } from "lucide-react";

export const metadata = { title: "Đăng nhập" };

const FEATURES = [
  { icon: FolderKanban, text: "Quản lý dự án, hạng mục, task & task con với người phụ trách" },
  { icon: BarChart3, text: "Theo dõi tiến độ trực quan theo ngày, tháng, quý, năm" },
  { icon: Presentation, text: "Xuất PDF, PowerPoint và trình chiếu báo cáo trực tuyến" },
  { icon: Sparkles, text: "Trợ lý AI tạo báo cáo cùng Claude" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.35),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
              <FolderKanban className="h-6 w-6" />
            </span>
            <span className="text-xl font-bold">WorkHub</span>
          </div>
          <div className="max-w-lg">
            <h1 className="text-balance text-4xl font-bold leading-tight">
              Quản lý công việc, báo cáo & trình chiếu trên một nền tảng.
            </h1>
            <ul className="mt-10 space-y-4">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-slate-300">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                    <Icon className="h-[18px] w-[18px] text-indigo-300" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4" /> Phiên đăng nhập được mã hoá và bảo vệ chống dò mật khẩu.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Suspense>
          <LoginForm showDemoHint={process.env.NODE_ENV !== "production"} />
        </Suspense>
      </div>
    </div>
  );
}
