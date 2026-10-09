"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChartColumn,
  ChevronDown,
  FolderKanban,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import type { CurrentUser } from "@/lib/session";
import { clearApiCache } from "@/lib/client";
import { cn } from "@/lib/utils";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

const NAV: { href: string; label: string; icon: typeof Users; badge?: boolean; permission?: PermissionKey }[] = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/tasks", label: "Công việc của tôi", icon: ListChecks },
  { href: "/inbox", label: "Hộp báo cáo", icon: Inbox, badge: true },
  { href: "/reports", label: "Trung tâm báo cáo", icon: ChartColumn },
  { href: "/contracts", label: "Hợp đồng & chi phí", icon: Wallet, permission: "FINANCE_MANAGE" },
  { href: "/ai", label: "Trợ lý AI", icon: Sparkles },
  { href: "/team", label: "Nhân sự", icon: Users },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
        <FolderKanban className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold text-white">WorkHub</span>
        <span className="block text-[11px] text-sidebar-muted">Quản lý & Báo cáo</span>
      </span>
    </Link>
  );
}

function SidebarNav({ user, pendingReports, onNavigate }: { user: CurrentUser; pendingReports: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="mt-8 space-y-1">
      {NAV.filter((item) => !item.permission || hasPermission(user, item.permission)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/10"
                transition={{ type: "spring", damping: 30, stiffness: 380 }}
              />
            )}
            <Icon className={cn("relative h-[18px] w-[18px]", active && "text-indigo-300")} />
            <span className="relative flex-1">{item.label}</span>
            {item.badge && pendingReports > 0 && (
              <span className="relative rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {pendingReports > 99 ? "99+" : pendingReports}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearApiCache();
    toast.success("Đã đăng xuất");
    router.replace("/login");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-muted"
      >
        <Avatar name={user.name} color={user.avatarColor} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-[11px] text-muted-foreground">{user.jobTitle ?? user.email}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border bg-card p-1.5 shadow-pop"
          >
            <div className="border-b px-3 pb-3 pt-2">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-2">
                <RoleBadge role={user.role} />
              </div>
            </div>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted"
            >
              <KeyRound className="h-4 w-4 text-muted-foreground" /> Đổi mật khẩu
            </Link>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({
  user,
  pendingReports,
  children,
}: {
  user: CurrentUser;
  pendingReports: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar px-4 py-6 lg:flex print:!hidden">
        <Brand />
        <SidebarNav user={user} pendingReports={pendingReports} />
        <div className="mt-auto rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 p-4 ring-1 ring-white/10">
          <Sparkles className="h-5 w-5 text-indigo-300" />
          <p className="mt-2 text-sm font-semibold text-white">Báo cáo bằng AI</p>
          <p className="mt-1 text-xs leading-relaxed text-sidebar-muted">
            Tạo prompt từ số liệu thực tế và gửi sang Claude chỉ với 1 cú nhấp.
          </p>
          <Link href="/ai" className="mt-3 inline-block text-xs font-semibold text-indigo-300 hover:text-indigo-200">
            Mở trợ lý →
          </Link>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-slate-950/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar px-4 py-6"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
            >
              <div className="flex items-center justify-between">
                <Brand />
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-sidebar-muted" aria-label="Đóng menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav user={user} pendingReports={pendingReports} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64 print:!pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu user={user} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:!max-w-none print:!p-0">{children}</main>
      </div>
    </div>
  );
}
