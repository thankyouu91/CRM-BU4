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
  PanelLeftClose,
  PanelLeftOpen,
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
import { NotificationBell } from "./notification-bell";
import type { CurrentUser } from "@/lib/session";
import { clearApiCache } from "@/lib/client";
import { cn } from "@/lib/utils";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { SIDEBAR_COOKIE } from "@/lib/constants";

type NavItem = { href: string; label: string; icon: typeof Users; badge?: "inbox" | "report"; permission?: PermissionKey };

// Grouped by what people come to do; settings sit apart at the bottom.
const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Làm việc",
    items: [
      { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/projects", label: "Dự án", icon: FolderKanban },
      { href: "/tasks", label: "Công việc của tôi", icon: ListChecks, badge: "report" },
      { href: "/ai", label: "Trợ lý AI", icon: Sparkles },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { href: "/inbox", label: "Hộp báo cáo", icon: Inbox, badge: "inbox" },
      { href: "/reports", label: "Trung tâm báo cáo", icon: ChartColumn },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { href: "/contracts", label: "Hợp đồng & chi phí", icon: Wallet, permission: "FINANCE_MANAGE" },
      { href: "/team", label: "Nhân sự", icon: Users },
    ],
  },
];
const SETTINGS: NavItem = { href: "/settings", label: "Cài đặt", icon: Settings };

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-2.5", collapsed ? "justify-center" : "px-2")} aria-label="WorkHub, về Tổng quan">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
        <FolderKanban className="h-5 w-5" />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold text-white">WorkHub</span>
          <span className="block text-[11px] text-sidebar-muted">Quản lý & Báo cáo</span>
        </span>
      )}
    </Link>
  );
}

function NavLink({ item, active, collapsed, count, dot, onNavigate }: { item: NavItem; active: boolean; collapsed?: boolean; count: number; dot?: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  const shown = count > 99 ? "99+" : String(count);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
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
      <Icon className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-indigo-300")} aria-hidden />
      <span className={cn("relative flex-1", collapsed && "sr-only")}>
        {item.label}
        {collapsed && count > 0 && `, ${shown} chưa duyệt`}
        {dot && <span className="sr-only">, {dot}</span>}
      </span>
      {dot && !count && (
        <span aria-hidden title={dot} className={cn("relative h-2 w-2 rounded-full bg-amber-400", collapsed && "absolute right-2 top-2")} />
      )}
      {count > 0 && (
        <span
          aria-hidden={collapsed}
          className={cn(
            "relative rounded-full bg-rose-500 font-bold leading-none text-white",
            collapsed ? "absolute right-1 top-1 px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
          )}
        >
          {shown}
        </span>
      )}
      {/* Name of the icon when the bar is narrow (hover or keyboard focus). */}
      {collapsed && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-pop ring-1 ring-white/10 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ user, pendingReports, reportOwed, collapsed, onNavigate }: { user: CurrentUser; pendingReports: number; reportOwed?: string | null; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const allowed = (item: NavItem) => !item.permission || hasPermission(user, item.permission);
  return (
    <nav aria-label="Điều hướng chính" className={cn("mt-6 flex min-h-0 flex-1 flex-col", !collapsed && "overflow-y-auto")}>
      {NAV.map((group, i) => {
        const items = group.items.filter(allowed);
        if (!items.length) return null;
        return (
          <div key={group.title} role="group" aria-labelledby={`nav-${i}`} className={cn(i > 0 && "mt-4")}>
            <p id={`nav-${i}`} className={cn(collapsed ? "sr-only" : "px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted/70")}>
              {group.title}
            </p>
            {collapsed && i > 0 && <div aria-hidden className="mx-auto mb-4 h-px w-6 bg-white/10" />}
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  count={item.badge === "inbox" ? pendingReports : 0}
                  dot={item.badge === "report" && reportOwed ? `chưa gửi báo cáo ${reportOwed}` : undefined}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="mt-auto pt-4">
        <NavLink item={SETTINGS} active={isActive(SETTINGS.href)} collapsed={collapsed} count={0} onNavigate={onNavigate} />
      </div>
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
  reportOwed = null,
  initialCollapsed = false,
  children,
}: {
  user: CurrentUser;
  pendingReports: number;
  /** "tuần 42" when this person's weekly report is due and not sent. */
  reportOwed?: string | null;
  /** The sidebar is a narrow icon bar (from the cookie, so the server renders it the same). */
  initialCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar py-6 transition-[width] duration-200 motion-reduce:transition-none lg:flex print:!hidden",
          collapsed ? "w-[72px] px-3" : "w-64 px-4",
        )}
      >
        <Brand collapsed={collapsed} />
        <SidebarNav user={user} pendingReports={pendingReports} reportOwed={reportOwed} collapsed={collapsed} />
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
              <SidebarNav user={user} pendingReports={pendingReports} reportOwed={reportOwed} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={cn("transition-[padding] duration-200 motion-reduce:transition-none print:!pl-0", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={toggleSidebar}
            className="-ml-2 hidden rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
            aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <ThemeToggle />
          <UserMenu user={user} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:!max-w-none print:!p-0">{children}</main>
      </div>
    </div>
  );
}
