// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import JSZip from "jszip";
import { deckWeekAnchor, makeDeckMeta, PROJECTS_PER_SLIDE, projectSlides, weekSlides, WEEK_LINES, type SlideModel, type WorkLine } from "../lib/deck-model";
import { buildDepartmentReport, type DepartmentTaskSource } from "../lib/department-report";
import { workPeriodFromKey } from "../lib/work-report";
import { SlideView } from "../components/deck/slides";
import { DECK_THEMES } from "../components/deck/theme";
import type { Summary } from "../lib/stats";

const saved = vi.hoisted(() => ({ blob: null as Blob | null }));
// next/font only works inside the Next.js build.
vi.mock("next/font/google", () => ({ Be_Vietnam_Pro: () => ({ className: "font", style: { fontFamily: "Be Vietnam Pro" }, variable: "--font" }) }));
vi.mock("../lib/export/save", () => ({ saveBlob: (b: Blob) => { saved.blob = b; }, fileSlug: (s: string) => s }));
afterEach(cleanup);

type P = Summary["projects"][number];
const project = (i: number, patch: Partial<P> = {}): P => ({
  id: `p${i}`, name: `Dự án ${String(i).padStart(2, "0")}`, color: "#2a78d6", status: "ACTIVE", progress: 50, totalTasks: 4, doneTasks: 2, overdueTasks: 0,
  members: 1, ownerName: "An", startDate: null, dueDate: null, schedule: { status: "ON_TRACK" } as P["schedule"], workload: { total: 4, done: 2, remaining: 2 } as P["workload"],
  ...patch,
});
const meta = makeDeckMeta("Tháng 10/2026", null, "An");

describe("project progress slides", () => {
  it("shows every project on one slide up to the page size, running work first, finished last", () => {
    const list = [
      project(1, { status: "COMPLETED", progress: 100, doneTasks: 4 }),
      project(2, { status: "PLANNING", progress: 0, totalTasks: 0, doneTasks: 0 }),
      project(3, { progress: 30, overdueTasks: 2 }),
      ...Array.from({ length: 10 }, (_, i) => project(10 + i, { progress: 60 })),
    ];
    const [slide, ...rest] = projectSlides(list) as Extract<SlideModel, { kind: "projects" }>[];
    expect(rest).toHaveLength(0);
    expect(slide.rows).toHaveLength(13);
    expect(slide.rows[0].name).toBe("Dự án 10"); // active, highest progress, then name
    expect(slide.rows.at(-2)!.name).toBe("Dự án 02"); // planning after active
    expect(slide.rows.at(-1)).toMatchObject({ name: "Dự án 01", status: "Hoàn thành", statusColor: "#22c55e" });
    expect(slide.summary).toEqual({ total: 13, complete: 1, overdue: 1, empty: 1 });
    expect(slide.title).toBe("Tiến độ hoàn thành từng dự án");
  });

  it("splits a long list into balanced slides with the same summary", () => {
    const slides = projectSlides(Array.from({ length: 30 }, (_, i) => project(i))) as Extract<SlideModel, { kind: "projects" }>[];
    expect(slides.map((s) => s.rows.length)).toEqual([10, 10, 10]);
    expect(slides.map((s) => s.title)).toEqual(["Tiến độ hoàn thành từng dự án (1/3)", "Tiến độ hoàn thành từng dự án (2/3)", "Tiến độ hoàn thành từng dự án (3/3)"]);
    expect(new Set(slides.flatMap((s) => s.rows.map((r) => r.name))).size).toBe(30);
    expect(slides.every((s) => s.summary.total === 30)).toBe(true);
    expect(projectSlides(Array.from({ length: PROJECTS_PER_SLIDE }, (_, i) => project(i)))).toHaveLength(1);
    expect(projectSlides([])).toEqual([]);
  });

  it("renders all projects of a slide, in two columns past six, with shortened long names", () => {
    const list = Array.from({ length: 13 }, (_, i) => project(i, i === 0 ? { name: "Cung cấp sản phẩm Upskill EdTech tại Trường Đại học Nguyễn Tất Thành và các cơ sở" } : {}));
    const [slide] = projectSlides(list);
    const { container } = render(<SlideView slide={slide} meta={meta} theme={DECK_THEMES.dark} index={2} total={11} />);
    const text = container.textContent!;
    for (let i = 1; i < 13; i++) expect(text).toContain(`Dự án ${String(i).padStart(2, "0")}`);
    expect(text).toContain("Cung cấp sản phẩm Upskill EdTech tại…");
    expect(text).toContain("13 dự án");
    expect(container.querySelector('[style*="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)"]')).toBeTruthy();
  });
});

const week = workPeriodFromKey("WEEK", "2026-W42")!;
const now = new Date("2026-10-14T05:00:00Z");
const task = (id: string, patch: Partial<DepartmentTaskSource> = {}): DepartmentTaskSource => ({
  id, title: `Việc ${id}`, description: null, status: "TODO", priority: "MEDIUM", progress: 0, startDate: null, dueDate: null, completedAt: null, createdAt: "2026-09-01T00:00:00Z",
  project: { id: "a", name: "Đào tạo PCCC", color: "#1baf7a", status: "ACTIVE" }, category: null, parent: null, assignee: { id: "u", name: "Bình" }, reports: [], ...patch,
});

describe("weekly report slides", () => {
  it("makes last week done, this week in progress and next week planned, with their figures", () => {
    const report = buildDepartmentReport([
      task("done", { status: "DONE", completedAt: "2026-10-08T03:00:00Z", dueDate: "2026-10-09T00:00:00Z" }),
      task("late", { dueDate: "2026-10-08T00:00:00Z" }),
      task("due", { status: "IN_PROGRESS", progress: 40, dueDate: "2026-10-15T00:00:00Z", project: { id: "b", name: "Khảo thí ACB", color: "#eb6834", status: "ACTIVE" } }),
      task("next", { dueDate: "2026-10-22T00:00:00Z", assignee: null }),
    ], week, null, now);
    const slides = weekSlides(report) as Extract<SlideModel, { kind: "week" }>[];
    expect(slides.map((s) => s.title)).toEqual(["Tuần trước · Đã làm", "Tuần này · Đang làm", "Tuần tới · Sẽ làm"]);
    expect(slides[0].period).toBe("Tuần 41 · 05/10 – 11/10/2026");
    expect(slides[0].stats.map((s) => [s.label, s.value])).toEqual([["việc đã xong", 1], ["việc có cập nhật", 0], ["đến hạn nhưng chưa xong", 1]]);
    const tasks = (s: (typeof slides)[number]) => s.columns.flat().filter((l): l is Extract<WorkLine, { kind: "task" }> => l.kind === "task");
    expect(tasks(slides[0]).map((l) => [l.title, l.tag, l.tone])).toEqual([["Việc done", "Xong 08/10", "success"], ["Việc late", "Chưa xong · hạn 08/10", "danger"]]);
    // This week, grouped by project in Vietnamese alphabetical order (Đ before K).
    expect(slides[1].columns[0].map((l) => (l.kind === "project" ? `# ${l.name}` : l.tag))).toEqual(["# Đào tạo PCCC", "Tồn · hạn 08/10", "# Khảo thí ACB", "Hạn 15/10 · 40%"]);
    expect(tasks(slides[2])).toEqual([expect.objectContaining({ title: "Việc next", who: "Chưa giao", tag: "Hạn 22/10" })]);
  });

  it("pages a long week without leaving a project heading at the end of a column, and counts what it leaves out", () => {
    const many = Array.from({ length: 80 }, (_, i) => task(`t${i}`, { dueDate: "2026-10-15T00:00:00Z", project: { id: `p${i % 5}`, name: `Dự án ${i % 5}`, color: "#000", status: "ACTIVE" } }));
    const slides = (weekSlides(buildDepartmentReport(many, week, null, now)) as Extract<SlideModel, { kind: "week" }>[]).filter((s) => s.title.startsWith("Tuần này"));
    expect(slides.map((s) => s.title)).toEqual(["Tuần này · Đang làm (1/3)", "Tuần này · Đang làm (2/3)", "Tuần này · Đang làm (3/3)"]);
    for (const col of slides.flatMap((s) => s.columns)) {
      expect(col.length).toBeLessThanOrEqual(WEEK_LINES);
      expect(col[0].kind).toBe("project");
      expect(col.at(-1)!.kind).toBe("task");
    }
    const shown = slides.flatMap((s) => s.columns).flat().filter((l) => l.kind === "task").length;
    expect(slides.at(-1)!.hidden).toBe(80 - shown);
    expect(slides[0].hidden).toBe(0);
    expect(slides[0].columns[1][0]).toMatchObject({ kind: "project", continued: true });
  });

  it("uses this week while the period runs, and the period's last week once it is over", () => {
    expect(deckWeekAnchor("2026-10-01T00:00:00Z", "2026-10-31T16:59:59Z", now)).toBe(now);
    expect(deckWeekAnchor("2026-09-01T00:00:00Z", "2026-09-30T16:59:59Z", now).toISOString()).toBe("2026-09-30T16:59:59.000Z");
  });
});

describe("PowerPoint export", () => {
  it("writes every project and the weekly tasks into the slides", async () => {
    const { exportDeckPptx } = await import("../lib/export/pptx");
    const report = buildDepartmentReport([task("due", { dueDate: "2026-10-15T00:00:00Z" })], week, null, now);
    const deck = { meta, slides: [...projectSlides(Array.from({ length: 13 }, (_, i) => project(i))), ...weekSlides(report)] };
    await exportDeckPptx(deck, "dark", "fade", "x.pptx");
    // jsdom's Blob has no arrayBuffer(); FileReader reads it.
    const bytes = await new Promise<ArrayBuffer>((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result as ArrayBuffer); r.readAsArrayBuffer(saved.blob!); });
    const zip = await JSZip.loadAsync(bytes);
    const xml = await Promise.all(Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort().map((f) => zip.file(f)!.async("string")));
    expect(xml).toHaveLength(4);
    for (let i = 0; i < 13; i++) expect(xml[0]).toContain(`Dự án ${String(i).padStart(2, "0")}`);
    expect(xml[0]).toContain("13 dự án");
    expect(xml[2]).toContain("Việc due");
    expect(xml[2]).toContain("Hạn 15/10");
  });
});
