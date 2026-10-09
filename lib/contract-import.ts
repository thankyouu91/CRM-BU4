// Parse rows copied from Excel (tab-separated) into contracts. Columns are
// matched by a header row when one is included, otherwise by the layout of the
// "Báo cáo tổng hợp theo dõi hợp đồng & chi phí" sheet:
//   STT | Mã HĐ | Tên HĐ | Đối tác | Giá trị HĐ | Ngày thực hiện | CP đào tạo |
//   CP khảo thí | Tổng giá trị | LN gộp | Tỷ suất LN | Đánh giá | Đã thanh toán |
//   Còn phải thu | Tiến độ thực hiện | Trạng thái TT
// Profit, receivable and payment status are recomputed, so those columns are ignored.

import { parseVnd, type ContractStatusKey } from "./finance";

type Field =
  | "code"
  | "name"
  | "partner"
  | "value"
  | "performedAt"
  | "trainingCost"
  | "examCost"
  | "otherCost"
  | "margin"
  | "collected"
  | "status"
  | "note";

const SHEET_LAYOUT: (Field | null)[] = [
  null, // STT
  "code",
  "name",
  "partner",
  "value",
  "performedAt",
  "trainingCost",
  "examCost",
  null, // Tổng giá trị
  null, // Lợi nhuận gộp
  "margin",
  null, // Đánh giá
  "collected",
  null, // Còn phải thu
  "status",
  null, // Trạng thái TT
];

/** Header text -> field; the first matching rule wins. */
const HEADER_RULES: [RegExp, Field | null][] = [
  [/^stt$/i, null],
  [/tổng\s*(giá trị|chi phí)|lợi nhuận|còn phải thu|đánh giá|trạng thái\s*tt|thanh toán\s*$/i, null],
  [/mã/i, "code"],
  [/tên/i, "name"],
  [/đối tác|khách hàng/i, "partner"],
  [/giá trị/i, "value"],
  [/ngày|thời gian|tháng/i, "performedAt"],
  [/đào tạo/i, "trainingCost"],
  [/khảo thí/i, "examCost"],
  [/khác/i, "otherCost"],
  [/tỷ suất|tỉ suất/i, "margin"],
  [/đã (thanh toán|thu)/i, "collected"],
  [/tiến độ/i, "status"],
  [/ghi chú/i, "note"],
];

export interface ImportedContract {
  code: string | null;
  name: string;
  partner: string | null;
  value: number;
  /** yyyy-mm-dd */
  performedAt: string;
  status: ContractStatusKey;
  trainingCost: number;
  examCost: number;
  otherCost: number;
  expectedMargin: number | null;
  collected: number;
}

export interface ParsedRow {
  line: number;
  data: ImportedContract | null;
  errors: string[];
  warnings: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Tháng 9", "T9", "09/2026", "15/09/2026", "2026-09-15" -> yyyy-mm-dd. */
export function parseMonthCell(input: string, defaultYear: number): string | null {
  const s = input.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${pad(+m[1])}-01`;
  m = /^(?:tháng|th|t)\s*(\d{1,2})(?:\s*(?:[/.-]|năm)\s*(\d{4}))?$/i.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2] ?? defaultYear}-${pad(+m[1])}-01`;
  return null;
}

export function parseStatusCell(input: string): ContractStatusKey | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("hoàn thành") || s.includes("hoàn tất")) return "COMPLETED";
  if (s.includes("khảo thí")) return "TESTING";
  if (s.includes("chưa")) return "PLANNED";
  if (s.includes("triển khai") || s.includes("đang")) return "IN_PROGRESS";
  return null;
}

/** "24.2%", "24,2 %", "0.242" -> 24.2 */
function parsePercent(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const n = Number(s.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return null;
  return !s.includes("%") && Math.abs(n) <= 1 ? Math.round(n * 1000) / 10 : n;
}

function headerMap(cells: string[]): (Field | null)[] | null {
  const looksLikeHeader = cells.some((c) => /mã\s*hđ|mã hợp đồng|tên hợp đồng|giá trị\s*h/i.test(c));
  if (!looksLikeHeader) return null;
  return cells.map((c) => {
    const text = c.trim();
    if (!text) return null;
    for (const [re, field] of HEADER_RULES) if (re.test(text)) return field;
    return null;
  });
}

export function parseContractPaste(text: string, defaultYear: number, defaultDate: string): ParsedRow[] {
  const lines = text.replace(/\r/g, "").split("\n");
  let layout: (Field | null)[] = SHEET_LAYOUT;
  const rows: ParsedRow[] = [];

  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const cells = raw.split("\t");
    const header = headerMap(cells);
    if (header) {
      layout = header;
      return;
    }
    const get = (f: Field) => {
      const idx = layout.indexOf(f);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const name = get("name");
    const valueText = get("value");
    // Group-header rows, blank spacer rows and the totals row carry no contract.
    if (!name && !valueText) return;
    if (/^tổng/i.test(name) || /^tổng/i.test(cells[0]?.trim() ?? "")) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const value = parseVnd(valueText);
    if (!name) errors.push("Thiếu tên hợp đồng");
    if (value === null) errors.push("Thiếu giá trị hợp đồng");
    else if (value < 0) errors.push("Giá trị hợp đồng âm");

    let performedAt = parseMonthCell(get("performedAt"), defaultYear);
    if (!performedAt) {
      performedAt = defaultDate;
      warnings.push(get("performedAt") ? `Không đọc được ngày “${get("performedAt")}”, dùng kỳ đang chọn` : "Chưa có ngày thực hiện, dùng kỳ đang chọn");
    }
    const money = (f: Field) => Math.max(0, parseVnd(get(f)) ?? 0);
    const trainingCost = money("trainingCost");
    const examCost = money("examCost");
    const otherCost = money("otherCost");
    const margin = parsePercent(get("margin"));
    const statusText = get("status");
    const status = parseStatusCell(statusText);
    if (statusText && !status) warnings.push(`Không rõ tiến độ “${statusText}”, đặt “Đang triển khai”`);

    rows.push({
      line: i + 1,
      errors,
      warnings,
      data: errors.length
        ? null
        : {
            code: get("code") || null,
            name,
            partner: get("partner") || null,
            value: value!,
            performedAt,
            status: status ?? "IN_PROGRESS",
            trainingCost,
            examCost,
            otherCost,
            // The sheet's margin is kept as an estimate only while no cost is entered.
            expectedMargin: trainingCost + examCost + otherCost === 0 && margin !== null ? Math.max(-100, Math.min(100, margin)) : null,
            collected: money("collected"),
          },
    });
  });
  return rows;
}
