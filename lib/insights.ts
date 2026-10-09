import type { Summary } from "./stats";

export interface Insight {
  tone: "good" | "warn" | "info";
  text: string;
}

/**
 * Plain-language observations derived strictly from the summary numbers.
 * No speculation: every sentence restates a figure that is in the data.
 */
export function buildInsights(s: Summary): Insight[] {
  const k = s.kpis;
  const out: Insight[] = [];

  out.push({
    tone: k.overallProgress >= 70 ? "good" : "info",
    text: `Tiến độ trung bình của ${k.totalProjects} dự án đạt ${k.overallProgress}%, trong đó ${k.activeProjects} dự án đang thực hiện.`,
  });

  if (k.totalTasks > 0) {
    out.push({
      tone: k.completionRate >= 50 ? "good" : "info",
      text: `Trong kỳ có ${k.totalTasks} công việc; ${k.doneTasks} công việc đã hoàn thành (${k.completionRate}%), ${k.inProgressTasks} công việc đang thực hiện.`,
    });
  }

  if (k.overdueTasks > 0) {
    const worst = [...s.projects].sort((a, b) => b.overdueTasks - a.overdueTasks)[0];
    out.push({
      tone: "warn",
      text:
        `${k.overdueTasks} công việc đang quá hạn` +
        (worst && worst.overdueTasks > 0 ? `, tập trung nhiều nhất ở dự án “${worst.name}” (${worst.overdueTasks} việc).` : "."),
    });
  } else if (k.totalTasks > 0) {
    out.push({ tone: "good", text: "Không có công việc nào quá hạn trong kỳ." });
  }

  const lead = s.projects.filter((p) => p.status !== "COMPLETED").sort((a, b) => b.progress - a.progress)[0];
  const lag = s.projects.filter((p) => p.status !== "COMPLETED").sort((a, b) => a.progress - b.progress)[0];
  if (lead && lag && lead.id !== lag.id) {
    out.push({
      tone: "info",
      text: `Dự án tiến độ cao nhất: “${lead.name}” (${lead.progress}%); thấp nhất: “${lag.name}” (${lag.progress}%).`,
    });
  }

  if (k.reportsCount > 0) {
    const top = [...s.people].sort((a, b) => b.hours - a.hours)[0];
    out.push({
      tone: "info",
      text:
        `Nhân sự đã gửi ${k.reportsCount} báo cáo tiến độ với tổng ${k.hoursLogged} giờ công` +
        (top && top.hours > 0 ? `; ghi nhận nhiều giờ nhất là ${top.name} (${top.hours} giờ).` : "."),
    });
  } else {
    out.push({ tone: "warn", text: "Chưa có báo cáo tiến độ nào được gửi trong kỳ này." });
  }

  const pending = s.recentReports.filter((r) => !r.reviewedAt).length;
  if (pending > 0) {
    out.push({ tone: "warn", text: `${pending} báo cáo gần đây đang chờ quản lý xem xét.` });
  }

  if (s.upcoming.length > 0) {
    out.push({ tone: "info", text: `${s.upcoming.length} công việc chưa hoàn thành sẽ đến hạn trong 14 ngày tới.` });
  }

  return out;
}
