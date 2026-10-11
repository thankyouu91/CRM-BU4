// AI chat: options, limits and prompt templates. Shared by the chat route
// (app/api/ai/chat) and the chat screen; no server-only imports.

export const CHAT_MAX_MESSAGES = 40;
export const CHAT_MAX_CHARS = 8000;

export const CHAT_LENGTHS = {
  short: { label: "Ngắn gọn", instruction: "Trả lời ngắn gọn: tối đa khoảng 150 từ, ưu tiên gạch đầu dòng, chỉ nêu ý chính." },
  balanced: { label: "Vừa phải", instruction: "Trả lời đầy đủ nhưng súc tích, khoảng 200–400 từ, có tiêu đề khi nội dung có nhiều phần." },
  detailed: { label: "Chi tiết", instruction: "Trả lời chi tiết, có cấu trúc rõ ràng với tiêu đề và gạch đầu dòng; nêu số liệu cụ thể cho từng nhận định." },
} as const;
export type ChatLength = keyof typeof CHAT_LENGTHS;

export const CHAT_AUDIENCES = {
  general: { label: "Chung", instruction: "Văn phong rõ ràng, chuyên nghiệp." },
  leadership: { label: "Ban lãnh đạo", instruction: "Người đọc là ban lãnh đạo: nêu kết luận và đề xuất trước, tránh chi tiết kỹ thuật, nhấn mạnh rủi ro và quyết định cần đưa ra." },
  team: { label: "Nội bộ nhóm", instruction: "Người đọc là các thành viên trong nhóm: cụ thể đến từng việc, người phụ trách và hạn chót; giọng thân thiện, thẳng thắn." },
  client: { label: "Khách hàng / đối tác", instruction: "Người đọc là khách hàng hoặc đối tác bên ngoài: lịch sự, tích cực nhưng trung thực; không nêu chi phí, lợi nhuận, công nợ hay đánh giá cá nhân nhân sự." },
} as const;
export type ChatAudience = keyof typeof CHAT_AUDIENCES;

export interface ChatOptions {
  /** Attach the report numbers for the chosen scope and period. */
  includeData: boolean;
  projectId: string | null;
  period: string;
  date?: string;
  from?: string;
  to?: string;
  length: ChatLength;
  audience: ChatAudience;
}

/**
 * The history to send with a new question: completed question/answer pairs only
 * (a question whose answer failed or never arrived is dropped), newest last, and
 * at most CHAT_MAX_MESSAGES - 2 entries so the new question still fits.
 */
export function chatHistoryForApi(
  messages: { role: "user" | "assistant"; content: string; status?: string }[],
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const next = messages[i + 1];
    if (m.role === "user" && next?.role === "assistant" && next.content.trim() && next.status !== "error") {
      out.push({ role: "user", content: m.content.slice(0, CHAT_MAX_CHARS) }, { role: "assistant", content: next.content.slice(0, CHAT_MAX_CHARS) });
      i++;
    }
  }
  return out.slice(-(CHAT_MAX_MESSAGES - 2));
}

/** The per-request style line (kept out of the cached system prefix). */
export function chatStyleInstruction(o: Pick<ChatOptions, "length" | "audience">): string {
  return `CÁCH TRẢ LỜI CHO CÂU HỎI NÀY: ${CHAT_LENGTHS[o.length].instruction} ${CHAT_AUDIENCES[o.audience].instruction}`;
}

export interface ChatTemplate {
  id: string;
  group: ChatTemplateGroup;
  label: string;
  prompt: string;
  /** Needs the contract and cost numbers (the "Hợp đồng & chi phí" permission). */
  finance?: boolean;
  /** Suggested options for this template. */
  length?: ChatLength;
  audience?: ChatAudience;
}

export const CHAT_TEMPLATE_GROUPS = {
  report: "Báo cáo",
  analysis: "Phân tích",
  plan: "Kế hoạch",
  write: "Soạn thảo",
  finance: "Tài chính",
} as const;
export type ChatTemplateGroup = keyof typeof CHAT_TEMPLATE_GROUPS;

export const CHAT_TEMPLATES: ChatTemplate[] = [
  {
    id: "exec-summary",
    group: "report",
    label: "Tóm tắt cho lãnh đạo",
    prompt: "Viết báo cáo tóm tắt cho ban lãnh đạo (250–350 từ): tiến độ tổng thể, kết quả nổi bật, rủi ro chính và 2–3 đề xuất hành động cụ thể.",
    audience: "leadership",
    length: "balanced",
  },
  {
    id: "status-report",
    group: "report",
    label: "Báo cáo tiến độ chi tiết",
    prompt:
      "Viết báo cáo tiến độ gồm 6 phần: (1) Tổng quan, (2) Tiến độ theo từng dự án, (3) Công việc đã hoàn thành, (4) Công việc đang thực hiện, (5) Vấn đề & rủi ro, (6) Kế hoạch giai đoạn tới.",
    length: "detailed",
  },
  {
    id: "slides",
    group: "report",
    label: "Dàn ý trình chiếu",
    prompt:
      "Tạo dàn ý trình chiếu 6–8 slide. Dùng đúng định dạng cho mỗi slide:\n## Slide 1: <tiêu đề ngắn>\n- <ý chính>\nMỗi slide 3–5 gạch đầu dòng, mỗi dòng không quá 20 từ. Slide đầu là tổng quan, slide cuối là đề xuất & bước tiếp theo. Không thêm lời dẫn ngoài các slide.",
    audience: "leadership",
    length: "detailed",
  },
  {
    id: "late-projects",
    group: "analysis",
    label: "Dự án nào đang trễ?",
    prompt: "Dự án và hạng mục nào đang chậm so với kế hoạch hoặc có công việc quá hạn? Xếp theo mức độ nghiêm trọng, nêu nguyên nhân khả dĩ (ghi rõ là giả định) và việc cần làm ngay.",
    length: "balanced",
  },
  {
    id: "risks",
    group: "analysis",
    label: "Rủi ro & điểm nghẽn",
    prompt: "Phân tích rủi ro và điểm nghẽn. Với mỗi rủi ro nêu: mô tả, mức độ ảnh hưởng (Cao/Trung bình/Thấp), nguyên nhân khả dĩ, biện pháp giảm thiểu và người nên phụ trách.",
    length: "detailed",
  },
  {
    id: "people",
    group: "analysis",
    label: "Khối lượng nhân sự",
    prompt: "Ai đang quá tải, ai còn dư sức dựa trên số việc được giao, đang làm và quá hạn? Đề xuất cách phân bổ lại công việc cho cân bằng.",
    audience: "team",
    length: "balanced",
  },
  {
    id: "forecast",
    group: "analysis",
    label: "Dự báo hoàn thành",
    prompt: "Với tốc độ hiện tại, các dự án có kịp hạn không? Ước lượng dự án nào có khả năng trễ và cần tăng tốc bao nhiêu (nêu rõ giả định).",
    length: "balanced",
  },
  {
    id: "next-week",
    group: "plan",
    label: "Kế hoạch tuần tới",
    prompt: "Lập kế hoạch ưu tiên cho tuần tới: các việc cần hoàn thành theo thứ tự ưu tiên, người phụ trách và mốc thời gian, dựa trên hạn chót sắp tới và việc đang dở dang.",
    audience: "team",
    length: "balanced",
  },
  {
    id: "priorities",
    group: "plan",
    label: "Việc nào cần làm trước?",
    prompt: "Liệt kê 5 việc quan trọng nhất cần xử lý ngay và giải thích ngắn gọn vì sao.",
    length: "short",
  },
  {
    id: "client-email",
    group: "write",
    label: "Email cập nhật khách hàng",
    prompt: "Soạn email cập nhật tiến độ gửi khách hàng: lời chào, tiến độ chính, kết quả đã đạt, các mốc sắp tới và lời kết. Không nêu thông tin tài chính nội bộ.",
    audience: "client",
    length: "balanced",
  },
  {
    id: "team-notice",
    group: "write",
    label: "Thông báo nội bộ",
    prompt: "Soạn thông báo nội bộ gửi cả nhóm: tình hình chung, ghi nhận kết quả tốt, những việc quá hạn cần xử lý và lời nhắc hạn chót trong tuần.",
    audience: "team",
    length: "short",
  },
  {
    id: "meeting",
    group: "write",
    label: "Nội dung họp giao ban",
    prompt: "Chuẩn bị nội dung họp giao ban: các điểm cần báo cáo, vấn đề cần thảo luận, quyết định cần đưa ra và danh sách việc sau họp.",
    audience: "team",
    length: "balanced",
  },
  {
    id: "finance-overview",
    group: "finance",
    label: "Tình hình hợp đồng & công nợ",
    prompt: "Phân tích tình hình hợp đồng: giá trị, chi phí, lợi nhuận gộp, tỷ suất và công nợ còn phải thu theo từng dự án. Chỉ ra hợp đồng lãi thấp và khoản cần đôn đốc thu.",
    finance: true,
    audience: "leadership",
    length: "detailed",
  },
  {
    id: "finance-files",
    group: "finance",
    label: "Hồ sơ hợp đồng còn thiếu",
    prompt: "Dự án nào đã hoàn thành nhưng còn thiếu file PDF hợp đồng? Lập danh sách việc cần bổ sung hồ sơ.",
    finance: true,
    length: "short",
  },
];

/** Templates this person can use (finance ones need the finance permission). */
export function chatTemplatesFor(canFinance: boolean): ChatTemplate[] {
  return CHAT_TEMPLATES.filter((t) => canFinance || !t.finance);
}
