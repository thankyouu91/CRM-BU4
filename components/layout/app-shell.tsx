"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  ChartColumn,
  ChevronDown,
  FolderKanban,
  Gamepad2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
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
import { LiveFeedProvider, useLiveFeed } from "./live-feed";
import { CommandPalette } from "./command-palette";
import { SceneBackdrop } from "./scene-backdrop";
import type { CurrentUser } from "@/lib/session";
import type { NotificationFeed } from "@/lib/notifications";
import { clearApiCache } from "@/lib/client";
import { cn } from "@/lib/utils";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { SIDEBAR_COOKIE } from "@/lib/constants";

type NavItem = { href: string; label: string; icon: typeof Users; badge?: "inbox" | "report"; permission?: PermissionKey; adminOnly?: boolean };

// Grouped by what people come to do; settings sit apart at the bottom.
const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Làm việc",
    items: [
      { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/projects", label: "Dự án", icon: FolderKanban },
      { href: "/tasks", label: "Công việc của tôi", icon: ListChecks, badge: "report" },
      { href: "/attendance", label: "Chấm công", icon: CalendarCheck },
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
// Tà tưa (the Petdex game) sits at the bottom with settings; its management board is for administrators.
const GAME: NavItem = { href: "/ta-tua", label: "Tà tưa", icon: Gamepad2 };
const GAME_ADMIN: NavItem = { href: "/ta-tua/quan-ly", label: "Quản lý Tà tưa", icon: SlidersHorizontal, adminOnly: true };

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex h-9 items-center gap-2.5 rounded-md", collapsed ? "justify-center" : "px-2")}
      aria-label="WorkHub, về Tổng quan"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-foreground text-sidebar">
        <FolderKanban className="h-4 w-4" strokeWidth={2.25} />
      </span>
      {!collapsed && <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-sidebar-foreground">WorkHub</span>}
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
        "group relative flex h-8 items-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        collapsed ? "justify-center px-0" : "gap-2.5 px-2",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-foreground"
          : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 2} aria-hidden />
      {/* Collapsed, the name is for screen readers only: it must not also be a flex-1 box, or it takes the row and pushes the icon left. */}
      <span className={collapsed ? "sr-only" : "flex-1 whitespace-nowrap"}>
        {item.label}
        {collapsed && count > 0 && `, ${shown} chưa duyệt`}
        {dot && <span className="sr-only">, {dot}</span>}
      </span>
      {dot && !count && (
        <span aria-hidden title={dot} className={cn("h-1.5 w-1.5 rounded-full bg-warning", collapsed && "absolute right-2 top-1.5")} />
      )}
      {count > 0 && (
        <span
          aria-hidden={collapsed}
          className={cn(
            "rounded-full bg-sidebar-foreground font-semibold tabular-nums leading-none text-sidebar",
            collapsed ? "absolute -right-0.5 -top-0.5 px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-xs",
          )}
        >
          {shown}
        </span>
      )}
      {/* Name of the icon when the bar is narrow (hover or keyboard focus). */}
      {collapsed && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ user, collapsed, onNavigate }: { user: CurrentUser; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Live counts, shared with the bell (LiveFeedProvider): they follow new reports and the person's own saves.
  const { feed } = useLiveFeed();
  const pendingReports = feed?.pendingReports ?? 0;
  const reportOwed = feed?.reportOwed ?? null;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const allowed = (item: NavItem) => (!item.permission || hasPermission(user, item.permission)) && (!item.adminOnly || user.role === "ADMIN");
  return (
    <nav aria-label="Điều hướng chính" className={cn("mt-5 flex min-h-0 flex-1 flex-col", !collapsed && "overflow-y-auto")}>
      {NAV.map((group, i) => {
        const items = group.items.filter(allowed);
        if (!items.length) return null;
        return (
          <div key={group.title} role="group" aria-labelledby={`nav-${i}`} className={cn(i > 0 && "mt-5")}>
            <p id={`nav-${i}`} className={cn(collapsed ? "sr-only" : "px-2 pb-1 text-xs font-medium text-sidebar-muted")}>
              {group.title}
            </p>
            {collapsed && i > 0 && <div aria-hidden className="mx-auto mb-3 h-px w-5 bg-border" />}
            <div className="space-y-0.5">
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
      <div className="mt-auto space-y-0.5 pt-4">
        <NavLink item={GAME} active={isActive(GAME.href) && !isActive(GAME_ADMIN.href)} collapsed={collapsed} count={0} onNavigate={onNavigate} />
        {allowed(GAME_ADMIN) && <NavLink item={GAME_ADMIN} active={isActive(GAME_ADMIN.href)} collapsed={collapsed} count={0} onNavigate={onNavigate} />}
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
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-muted"
      >
        <Avatar name={user.name} color={user.avatarColor} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.jobTitle ?? user.email}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-lg border bg-card p-1 shadow-pop"
          >
            <div className="mb-1 border-b px-2.5 pb-2.5 pt-1.5">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-2">
                <RoleBadge role={user.role} />
              </div>
            </div>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted"
            >
              <KeyRound className="h-4 w-4 text-muted-foreground" /> Đổi mật khẩu
            </Link>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-danger hover:bg-danger/10"
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
  feed,
  initialCollapsed = false,
  children,
}: {
  user: CurrentUser;
  /** The live feed as the server rendered it: bell, inbox count, weekly report dot. */
  feed: NotificationFeed | null;
  /** The sidebar is a narrow icon bar (from the cookie, so the server renders it the same). */
  initialCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // While collapsed, pointing at (or tabbing into) the bar opens it over the page for a
  // moment; it folds back when the pointer leaves. The page itself does not move.
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => setPeek(false), [pathname, collapsed]);
  useEffect(() => () => clearTimeout(peekTimer.current ?? undefined), []);
  const schedulePeek = (open: boolean, delay: number) => {
    clearTimeout(peekTimer.current ?? undefined);
    peekTimer.current = setTimeout(() => setPeek(open), delay);
  };
  const wide = !collapsed || peek;

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <LiveFeedProvider initial={feed}>
      <SceneBackdrop />
      <div className="min-h-screen">
        {/* Desktop sidebar */}
        <aside
          id="app-sidebar"
          onMouseEnter={() => collapsed && schedulePeek(true, 120)}
          onMouseLeave={() => collapsed && schedulePeek(false, 200)}
          onFocus={(e) => collapsed && e.target.matches(":focus-visible") && schedulePeek(true, 0)}
          onBlur={(e) => collapsed && !e.currentTarget.contains(e.relatedTarget as Node | null) && schedulePeek(false, 0)}
          onKeyDown={(e) => e.key === "Escape" && peek && schedulePeek(false, 0)}
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar py-3 transition-[width,box-shadow] duration-200 motion-reduce:transition-none lg:flex print:!hidden",
            wide ? "w-60 overflow-hidden px-3" : "w-14 px-2",
            peek && "shadow-pop",
          )}
        >
          <Brand collapsed={!wide} />
          <SidebarNav user={user} collapsed={!wide} />
        </aside>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <motion.div
                className="absolute inset-0 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-sidebar px-3 py-3"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="flex items-center justify-between">
                  <Brand />
                  <button onClick={() => setMobileOpen(false)} className="rounded-md p-2 text-sidebar-muted hover:bg-sidebar-accent" aria-label="Đóng menu">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <SidebarNav user={user} onNavigate={() => setMobileOpen(false)} />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className={cn("transition-[padding] duration-200 motion-reduce:transition-none print:!pl-0", collapsed ? "lg:pl-14" : "lg:pl-60")}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4 sm:px-6 lg:px-8 print:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={toggleSidebar}
              className="-ml-2 hidden rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
              aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              aria-controls="app-sidebar"
              aria-expanded={!collapsed}
              title={collapsed ? "Mở rộng thanh bên (giữ mở)" : "Thu gọn thanh bên (di chuột vào để mở tạm)"}
            >
              {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            </button>
            <div className="flex-1" />
            <CommandPalette user={user} />
            <NotificationBell />
            <ThemeToggle />
            <UserMenu user={user} />
          </header>
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:!max-w-none print:!p-0">{children}</main>
        </div>
      </div>
    </LiveFeedProvider>
  );
}
