// Builds structured, ready-to-paste prompts in Vietnamese from dashboard data.
// Feature #8: the dashboard packages project/report numbers into a high-quality
// prompt that the user copies into Claude.ai / Claude Code to generate a report —
// no Claude API key or usage cost required.

import { PROJECT_STATUS } from "./constants";

export interface AIPromptProject {
  name: string;
  status: string;
  progress: number;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  members: number;
}

export interface AIPromptStats {
  periodLabel: string;
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  reportsCount: number;
  hoursLogged: number;
}

export type AIPromptKind = "executive-summary" | "status-report" | "slide-deck" | "risk-analysis";

const KIND_INSTRUCTIONS: Record<AIPromptKind, string> = {
  "executive-summary":
    "Viết một BÁO CÁO TÓM TẮT CHO BAN LÃNH ĐẠO (executive summary) khoảng 250-350 từ. Nêu bật tiến độ tổng thể, thành tựu chính, rủi ro và đề xuất hành động. Văn phong trang trọng, súc tích.",
  "status-report":
    "Viết một BÁO CÁO TIẾN ĐỘ chi tiết có cấu trúc: (1) Tổng quan, (2) Tiến độ theo từng dự án, (3) Công việc đã hoàn thành, (4) Công việc đang thực hiện, (5) Vấn đề & rủi ro, (6) Kế hoạch giai đoạn tới. Dùng gạch đầu dòng khi phù hợp.",
  "slide-deck":
    "Tạo DÀN Ý TRÌNH CHIẾU (slide deck) 6-8 slide. Mỗi slide gồm tiêu đề ngắn gọn và 3-5 bullet. Slide mở đầu là tổng quan, các slide giữa theo từng chủ đề/dự án, slide cuối là đề xuất & bước tiếp theo. Định dạng rõ ràng theo từng slide.",
  "risk-analysis":
    "Phân tích RỦI RO & ĐIỂM NGHẼN dựa trên các task quá hạn và tiến độ chậm. Với mỗi rủi ro: mô tả, mức độ ảnh hưởng, nguyên nhân khả dĩ, và biện pháp giảm thiểu đề xuất.",
};

export function buildReportPrompt(
  kind: AIPromptKind,
  stats: AIPromptStats,
  projects: AIPromptProject[],
): string {
  const lines: string[] = [];
  lines.push("Bạn là một trợ lý phân tích & báo cáo quản lý dự án chuyên nghiệp.");
  lines.push("");
  lines.push(`NHIỆM VỤ: ${KIND_INSTRUCTIONS[kind]}`);
  lines.push("");
  lines.push(`KỲ BÁO CÁO: ${stats.periodLabel}`);
  lines.push("");
  lines.push("SỐ LIỆU TỔNG HỢP:");
  lines.push(`- Tổng số dự án: ${stats.totalProjects} (đang hoạt động: ${stats.activeProjects})`);
  lines.push(`- Tổng số công việc: ${stats.totalTasks}`);
  lines.push(`- Đã hoàn thành: ${stats.doneTasks}`);
  lines.push(`- Đang thực hiện: ${stats.inProgressTasks}`);
  lines.push(`- Quá hạn: ${stats.overdueTasks}`);
  lines.push(`- Tỷ lệ hoàn thành chung: ${stats.completionRate}%`);
  lines.push(`- Số báo cáo tiến độ đã ghi nhận: ${stats.reportsCount}`);
  lines.push(`- Tổng giờ công đã ghi: ${stats.hoursLogged} giờ`);
  lines.push("");
  lines.push("CHI TIẾT THEO DỰ ÁN:");
  if (projects.length === 0) {
    lines.push("- (Không có dữ liệu dự án trong kỳ này)");
  } else {
    projects.forEach((p, i) => {
      const statusLabel =
        PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS]?.label ?? p.status;
      lines.push(
        `${i + 1}. ${p.name} — Trạng thái: ${statusLabel}; Tiến độ: ${p.progress}%; ` +
          `Công việc: ${p.doneTasks}/${p.totalTasks} hoàn thành, ${p.overdueTasks} quá hạn; ` +
          `Thành viên: ${p.members}`,
      );
    });
  }
  lines.push("");
  lines.push("YÊU CẦU ĐẦU RA:");
  lines.push("- Viết hoàn toàn bằng tiếng Việt, văn phong chuyên nghiệp.");
  lines.push("- Chỉ sử dụng số liệu được cung cấp ở trên, không bịa thêm.");
  lines.push("- Nếu một chỉ số bằng 0 hoặc thiếu, hãy nêu rõ thay vì suy diễn.");
  return lines.join("\n");
}

export const AI_PROMPT_KINDS: { value: AIPromptKind; label: string; desc: string }[] = [
  { value: "executive-summary", label: "Tóm tắt lãnh đạo", desc: "Báo cáo ngắn gọn cho ban lãnh đạo" },
  { value: "status-report", label: "Báo cáo tiến độ", desc: "Báo cáo chi tiết có cấu trúc đầy đủ" },
  { value: "slide-deck", label: "Dàn ý trình chiếu", desc: "Dàn ý 6-8 slide để thuyết trình" },
  { value: "risk-analysis", label: "Phân tích rủi ro", desc: "Phân tích điểm nghẽn & rủi ro" },
];
