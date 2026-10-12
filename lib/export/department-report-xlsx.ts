import { departmentGroups, type DepartmentReport, type DepartmentRow } from "../department-report";
import { statusLabel, zonedText } from "../work-report";
import { PROJECT_STATUS } from "../constants";

// Explicit strings prevent task content beginning with '=' from becoming a formula.
const cell = (value: string) => ({ value, type: String, fontFamily: "Arial", fontSize: 10, wrap: true });
const header = ["Nhóm báo cáo", "Dự án", "Hạng mục", "Công việc tổng", "Công việc", "Nội dung", "Phụ trách", "Tình trạng hiện tại", "Tiến độ", "Bắt đầu", "Deadline", "Hoàn thành", "Cập nhật trong tuần"];

export function departmentWorkbook(report: DepartmentReport, scope: string) {
  const rows = (label: string, items: DepartmentRow[]) => departmentGroups(items).flatMap(group => group.rows.map(({ task: t, updates }) => [
    label, t.project.name, t.category, t.parentTitle ?? "", t.title, t.description ?? "", t.assignee?.name ?? "Chưa phân công",
    `${statusLabel(t.status)}${t.overdue ? " · Quá hạn" : ""}`, `${t.progress}%`, zonedText(t.startDate), zonedText(t.dueDate), zonedText(t.completedAt),
    updates.map(u => `${zonedText(u.createdAt, "datetime")} · ${u.author} · ${u.progress}%\n${u.content}`).join("\n\n"),
  ].map(cell)));
  const widths = [34, 34, 30, 32, 50, 60, 24, 24, 12, 16, 16, 16, 72].map(width => ({ width }));
  const sheet = (name: string, title: string, detail: ReturnType<typeof rows>) => ({
    sheet: name, columns: widths, stickyRowsCount: 5,
    data: [
      [cell(title)], [cell(`Phạm vi: ${scope}`)], [cell(`Dữ liệu hiện tại: ${zonedText(report.asOf, "datetime")} · Giờ Việt Nam`)],
      [cell("Công việc tổng không cộng lặp. Trạng thái hiện tại; kết quả theo ngày hoàn thành, kế hoạch theo ngày bắt đầu/deadline.")],
      header.map(value => ({ ...cell(value), fontWeight: "bold" as const, backgroundColor: "#e2e8f0" })), ...detail,
    ],
  });
  const projectHeader = ["Dự án", "Trạng thái dự án", "Quản lý dự án", "Số công việc", "Việc tiếp theo", "Bắt đầu", "Deadline", "Ngày tạo dự án"];
  const projects = {
    sheet: "Dự án chưa có việc", columns: [40, 20, 24, 14, 50, 16, 16, 16].map(width => ({ width })), stickyRowsCount: 5,
    data: [
      [cell("Dự án chưa có việc trong 3 tuần báo cáo")], [cell(`Phạm vi: ${scope}`)], [cell(`Dữ liệu hiện tại: ${zonedText(report.asOf, "datetime")} · Giờ Việt Nam`)],
      [cell("Chưa có công việc, hoặc việc còn lại bắt đầu và đến hạn sau tuần tới.")],
      projectHeader.map(value => ({ ...cell(value), fontWeight: "bold" as const, backgroundColor: "#e2e8f0" })),
      ...report.projectsWithoutWork.map(p => [
        p.name, PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS]?.label ?? p.status, p.owner ?? "", String(p.taskCount),
        p.next?.title ?? "Chưa có công việc", zonedText(p.next?.startDate), zonedText(p.next?.dueDate), zonedText(p.createdAt),
      ].map(cell)),
    ],
  };
  return [
    ...report.sections.map((section, index) => sheet(["Tuần trước", "Tuần này", "Tuần tới"][index], `${section.title} · ${section.period.label}`, section.buckets.flatMap(b => rows(b.label, b.rows)))),
    projects,
    sheet("Chưa có deadline", "Cần bổ sung hạn hoàn thành", rows("Chưa có deadline", report.unscheduled.map(task => ({ task, updates: [] })))),
    sheet("Kiểm tra ngày hoàn thành", "Việc đã xong nhưng thiếu ngày hoặc ngày nằm trong tương lai", rows("Kiểm tra ngày hoàn thành", report.missingCompletion.map(task => ({ task, updates: [] })))),
  ];
}

export async function exportDepartmentReport(report: DepartmentReport, scope: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  await writeXlsxFile(departmentWorkbook(report, scope)).toFile(`bao-cao-phong-${report.week}.xlsx`);
}
