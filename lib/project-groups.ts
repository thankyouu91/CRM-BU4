// Tabs of the dashboard's "Tiến độ dự án" card. Pure: shared by the card and tests.

export interface GroupableProject {
  status: string;
  overdueTasks: number;
  schedule: { status: string };
}

export type ProjectTab = "active" | "attention" | "done" | "all";

export const PROJECT_TABS: { key: ProjectTab; label: string }[] = [
  { key: "active", label: "Đang làm" },
  { key: "attention", label: "Cần chú ý" },
  { key: "done", label: "Hoàn thành" },
  { key: "all", label: "Tất cả" },
];

const OPEN = new Set(["PLANNING", "ACTIVE", "ON_HOLD"]);
const SLIPPING = new Set(["AT_RISK", "BEHIND", "OVERDUE"]);

/** Open and either has overdue tasks or is behind its schedule. */
export const needsAttention = (p: GroupableProject) => OPEN.has(p.status) && (p.overdueTasks > 0 || SLIPPING.has(p.schedule.status));

export function inTab(p: GroupableProject, tab: ProjectTab): boolean {
  if (tab === "active") return OPEN.has(p.status);
  if (tab === "attention") return needsAttention(p);
  if (tab === "done") return p.status === "COMPLETED";
  return true;
}

/** Projects per tab, keeping the incoming order (newest first). */
export function groupProjects<T extends GroupableProject>(projects: T[]): Record<ProjectTab, T[]> {
  return {
    active: projects.filter((p) => inTab(p, "active")),
    attention: projects.filter((p) => inTab(p, "attention")),
    done: projects.filter((p) => inTab(p, "done")),
    all: projects,
  };
}

/** The tab to open first: work in progress, else everything. */
export const firstTab = (groups: Record<ProjectTab, unknown[]>): ProjectTab => (groups.active.length ? "active" : "all");
