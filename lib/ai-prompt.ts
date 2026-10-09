// Feature #8 — AI-assisted reporting without the Claude API.
// The dashboard packages real report numbers into a structured Vietnamese prompt
// that the user sends to Claude (claude.ai or Claude Code). No API key, no usage
// cost on this server. Claude's answer can be pasted back to be presented or
// exported as slides (see lib/deck-model.ts parseOutline).

import { daysLeftLabel, SCHEDULE_STATUS } from "./schedule";
import { PROJECT_STATUS, TASK_STATUS } from "./constants";
import type { Summary } from "./stats";

export type AIPromptKind = "executive-summary" | "status-report" | "slide-deck" | "risk-analysis";

export const AI_PROMPT_KINDS: { value: AIPromptKind; label: string; desc: string }[] = [
  { value: "executive-summary", label: "Tóm tắt cho lãnh đạo", desc: "250–350 từ: tiến độ, thành tựu, rủi ro, đề xuất" },
  { value: "status-report", label: "Báo cáo tiến độ chi tiết", desc: "6 phần có cấu trúc, dùng gửi email/lưu hồ sơ" },
  { value: "slide-deck", label: "Dàn ý trình chiếu", desc: "6–8 slide — dán lại đây để trình chiếu & xuất PPTX" },
  { value: "risk-analysis", label: "Phân tích rủi ro", desc: "Điểm nghẽn, mức ảnh hưởng, biện pháp giảm thiểu" },
];

const TASKS: Record<AIPromptKind, string> = {
  "executive-summary":
    "Viết BÁO CÁO TÓM TẮT CHO BAN LÃNH ĐẠO dài 250–350 từ. Nêu tiến độ tổng thể, kết quả nổi bật, rủi ro chính và 2–3 đề xuất hành động cụ thể. Văn phong trang trọng, súc tích.",
  "status-report":
    "Viết BÁO CÁO TIẾN ĐỘ có cấu trúc gồm 6 phần với tiêu đề rõ ràng: (1) Tổng quan, (2) Tiến độ theo từng dự án, (3) Công việc đã hoàn thành, (4) Công việc đang thực hiện, (5) Vấn đề & rủi ro, (6) Kế hoạch giai đoạn tới. Dùng gạch đầu dòng khi phù hợp.",
  "slide-deck":
    "Tạo DÀN Ý TRÌNH CHIẾU gồm 6–8 slide. BẮT BUỘC dùng đúng định dạng sau cho mỗi slide (để hệ thống tự dựng slide):\n## Slide 1: <tiêu đề ngắn>\n- <ý chính 1>\n- <ý chính 2>\nMỗi slide 3–5 gạch đầu dòng, mỗi dòng không quá 20 từ. Slide đầu là tổng quan, các slide giữa theo chủ đề/dự án, slide cuối là đề xuất & bước tiếp theo. Không thêm lời dẫn ngoài các slide.",
  "risk-analysis":
    "PHÂN TÍCH RỦI RO & ĐIỂM NGHẼN dựa trên công việc quá hạn, tiến độ chậm và khối lượng nhân sự. Với mỗi rủi ro nêu: mô tả, mức độ ảnh hưởng (Cao/Trung bình/Thấp), nguyên nhân khả dĩ (ghi rõ là giả định nếu số liệu không cho biết), biện pháp giảm thiểu và người/bộ phận nên phụ trách.",
};

const label = <T extends Record<string, { label: string }>>(map: T, key: string) => (map as Record<string, { label: string }>)[key]?.label ?? key;

export function buildReportPrompt(kind: AIPromptKind, s: Summary, scopeLabel: string): string {
  const k = s.kpis;
  const L: string[] = [];
  L.push("Bạn là chuyên gia phân tích và lập báo cáo quản lý dự án.");
  L.push("");
  L.push(`NHIỆM VỤ: ${TASKS[kind]}`);
  L.push("");
  L.push(`PHẠM VI: ${scopeLabel}`);
  L.push(`KỲ BÁO CÁO: ${s.period.label}`);
  L.push("");
  L.push("1. SỐ LIỆU TỔNG HỢP");
  L.push(`- Dự án: ${k.totalProjects} (đang thực hiện: ${k.activeProjects}); tiến độ trung bình: ${k.overallProgress}%`);
  L.push(`- Công việc trong kỳ: ${k.totalTasks}; hoàn thành trong kỳ: ${k.doneTasks} (${k.completionRate}%); đang thực hiện: ${k.inProgressTasks}; quá hạn: ${k.overdueTasks}`);
  L.push(`- Báo cáo tiến độ đã gửi: ${k.reportsCount}; tổng giờ công: ${k.hoursLogged} giờ`);
  L.push(`- Phân bổ trạng thái: ${s.statusDistribution.map((d) => `${label(TASK_STATUS, d.status)} ${d.count}`).join(", ")}`);
  L.push("");
  L.push("2. CHI TIẾT DỰ ÁN");
  if (!s.projects.length) L.push("- (Không có dự án trong phạm vi)");
  s.projects.forEach((p, i) =>
    L.push(
      `${i + 1}. ${p.name} — ${label(PROJECT_STATUS, p.status)}; tiến độ ${p.progress}%; ${p.doneTasks}/${p.totalTasks} việc xong; ${p.overdueTasks} quá hạn; ${p.members} thành viên; chủ dự án: ${p.ownerName}` +
        (p.dueDate ? `; hạn ${new Date(p.dueDate).toLocaleDateString("vi-VN")}` : ""),
    ),
  );
  L.push("");
  L.push("2b. TIẾN ĐỘ THEO DEADLINE (thực tế so với kế hoạch đến hôm nay) & KHỐI LƯỢNG");
  const w = s.workload;
  L.push(`- Khối lượng hiện tại: ${w.total} việc; đã làm ${w.done}; cần làm ${w.remaining} (đang làm ${w.inProgress}, chưa bắt đầu ${w.notStarted}, bị chặn ${w.blocked}); quá hạn ${w.overdue}`);
  s.schedule.forEach((r) => {
    const indent = r.level === 2 ? "    - " : r.level === 1 ? "  - " : "- ";
    const plan =
      r.schedule.planned === null
        ? "chưa đặt hạn"
        : `kế hoạch ${r.schedule.planned}%, đạt ${r.schedule.achievement ?? "—"}% kế hoạch, ${daysLeftLabel(r.schedule.daysLeft)}`;
    L.push(
      `${indent}${r.name}: thực tế ${r.progress}%; ${plan}; trạng thái: ${SCHEDULE_STATUS[r.schedule.status].label}; đã làm ${r.workload.done}/cần làm ${r.workload.remaining}`,
    );
  });
  if (s.finance && s.finance.totals.count > 0) {
    const f = s.finance.totals;
    const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;
    L.push("");
    L.push(`2c. TÀI CHÍNH HỢP ĐỒNG (${s.finance.scope === "project" ? "toàn bộ hợp đồng của dự án" : "hợp đồng thực hiện trong kỳ"})`);
    L.push(
      `- ${f.count} hợp đồng; giá trị ${vnd(f.value)}; chi phí ${vnd(f.totalCost)} (tỷ lệ ${f.costRatio}%); lợi nhuận gộp ${vnd(f.profit)} (tỷ suất ${f.margin}%${f.estimated ? `, ${f.estimated} HĐ ước tính` : ""}); đã thu ${vnd(f.collected)}; còn phải thu ${vnd(f.receivable)}`,
    );
    s.finance.byProject.forEach((p) =>
      L.push(
        `  - ${p.name}${p.progress === null ? "" : ` (tiến độ công việc ${p.progress}%)`}: giá trị ${vnd(p.totals.value)}, chi phí ${vnd(p.totals.totalCost)}, lợi nhuận ${vnd(p.totals.profit)} (${p.totals.margin}%), còn phải thu ${vnd(p.totals.receivable)}`,
      ),
    );
  }
  L.push("");
  L.push("3. NHÂN SỰ (công việc được giao trong kỳ)");
  if (!s.people.length) L.push("- (Không có dữ liệu)");
  s.people.slice(0, 10).forEach((p) =>
    L.push(`- ${p.name}${p.jobTitle ? ` (${p.jobTitle})` : ""}: giao ${p.assigned}, xong ${p.done}, đang làm ${p.inProgress}, quá hạn ${p.overdue}; ${p.reports} báo cáo, ${p.hours} giờ`),
  );
  if (s.upcoming.length) {
    L.push("");
    L.push("4. HẠN CHÓT TRONG 14 NGÀY TỚI");
    s.upcoming.forEach((u) =>
      L.push(`- ${new Date(u.dueDate).toLocaleDateString("vi-VN")}: ${u.title} (${u.projectName}${u.assigneeName ? `, PIC: ${u.assigneeName}` : ""}; ưu tiên ${u.priority})`),
    );
  }
  if (s.recentReports.length) {
    L.push("");
    L.push("5. TRÍCH BÁO CÁO GẦN ĐÂY CỦA NGƯỜI THỰC HIỆN");
    s.recentReports.slice(0, 8).forEach((r) => L.push(`- ${r.authorName} · ${r.taskTitle} (${r.progress}%): "${r.content}"`));
  }
  L.push("");
  L.push("YÊU CẦU ĐẦU RA:");
  L.push("- Viết hoàn toàn bằng tiếng Việt, văn phong chuyên nghiệp.");
  L.push("- Chỉ dùng số liệu ở trên; không bịa thêm số liệu, tên người hay sự kiện.");
  L.push("- Khi suy luận nguyên nhân hoặc đề xuất, ghi rõ đó là nhận định/đề xuất.");
  L.push("- Nếu chỉ số bằng 0 hoặc thiếu, nêu rõ thay vì suy diễn.");
  return L.join("\n");
}
