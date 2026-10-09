// Contracts & costs report as a styled .xlsx in the layout of the original
// Excel sheet: title, four KPI blocks, grouped headers, rows and a totals row.
// Loaded on demand in the browser.

import { CONTRACT_STATUS, PAYMENT_STATUS, type ContractTotals } from "@/lib/finance";
import type { ContractDto } from "@/lib/contracts";

const MONEY = "#,##0";
const PCT = '0.0"%"';
const FONT = "Arial";

const GROUPS = [
  { label: "THÔNG TIN HỢP ĐỒNG", span: 5, color: "#1e3a8a" },
  { label: "LỊCH TRÌNH", span: 1, color: "#2563eb" },
  { label: "CHI PHÍ CHI TIẾT", span: 4, color: "#c2410c" },
  { label: "LỢI NHUẬN & HIỆU QUẢ", span: 3, color: "#047857" },
  { label: "DÒNG TIỀN & TRẠNG THÁI", span: 4, color: "#6d28d9" },
];
const HEADERS = [
  "STT",
  "Mã HĐ",
  "Tên hợp đồng / dự án",
  "Đối tác / khách hàng",
  "Giá trị HĐ (VNĐ)",
  "Ngày thực hiện",
  "CP đào tạo (VNĐ)",
  "CP khảo thí (VNĐ)",
  "CP khác (VNĐ)",
  "Tổng chi phí (VNĐ)",
  "Lợi nhuận gộp (VNĐ)",
  "Tỷ suất LN",
  "Đánh giá",
  "Đã thanh toán (VNĐ)",
  "Còn phải thu (VNĐ)",
  "Tiến độ thực hiện",
  "Trạng thái TT",
];
const WIDTHS = [6, 26, 44, 34, 18, 14, 16, 16, 14, 18, 18, 11, 10, 18, 18, 17, 16];

const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
};

export async function exportContractsXlsx(rows: ContractDto[], totals: ContractTotals, periodLabel: string, filename: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  type Cell = Record<string, unknown> | null;
  const base = { fontFamily: FONT, fontSize: 10 };
  const border = { borderColor: "#cbd5e1", borderStyle: "thin" as const };
  const cols = HEADERS.length;
  const blank = (n: number): Cell[] => Array.from({ length: n }, () => null);

  const title: Cell[] = [
    {
      ...base,
      value: `BÁO CÁO TỔNG HỢP THEO DÕI HỢP ĐỒNG & CHI PHÍ (${periodLabel.toUpperCase()})`,
      fontSize: 14,
      fontWeight: "bold",
      textColor: "#ffffff",
      backgroundColor: "#1e3a8a",
      align: "center",
      alignVertical: "center",
      height: 30,
      columnSpan: cols,
    },
    ...blank(cols - 1),
  ];

  // KPI blocks: label row + value row + note row, four blocks spanning the width.
  const kpis = [
    { label: "TỔNG GIÁ TRỊ HỢP ĐỒNG", value: totals.value, note: `Tổng số: ${totals.count} hợp đồng`, color: "#1e3a8a", bg: "#eff6ff", span: 5 },
    { label: "TỔNG CHI PHÍ THỰC HIỆN", value: totals.totalCost, note: `Tỷ lệ CP: ${totals.costRatio}%`, color: "#c2410c", bg: "#fff7ed", span: 5 },
    { label: "LỢI NHUẬN GỘP DỰ KIẾN", value: totals.profit, note: `Tỷ suất LN TB: ${totals.margin}%`, color: "#047857", bg: "#ecfdf5", span: 3 },
    { label: "SỐ DƯ CÒN PHẢI THU", value: totals.receivable, note: `Đã thu: ${totals.collected.toLocaleString("vi-VN")} đ`, color: "#6d28d9", bg: "#f5f3ff", span: 4 },
  ];
  const kpiRow = (pick: (k: (typeof kpis)[number]) => Cell): Cell[] => kpis.flatMap((k) => [pick(k), ...blank(k.span - 1)]);
  const kpiLabels = kpiRow((k) => ({ ...base, value: k.label, fontWeight: "bold", textColor: k.color, backgroundColor: k.bg, align: "center", columnSpan: k.span }));
  const kpiValues = kpiRow((k) => ({
    ...base,
    value: k.value,
    type: Number,
    format: `${MONEY} "đ"`,
    fontSize: 14,
    fontWeight: "bold",
    textColor: k.color,
    backgroundColor: k.bg,
    align: "center",
    height: 24,
    columnSpan: k.span,
  }));
  const kpiNotes = kpiRow((k) => ({ ...base, value: k.note, fontStyle: "italic", textColor: "#475569", backgroundColor: k.bg, align: "center", columnSpan: k.span }));

  const groupRow: Cell[] = GROUPS.flatMap((g) => [
    { ...base, value: g.label, fontWeight: "bold", textColor: "#ffffff", backgroundColor: g.color, align: "center", columnSpan: g.span, ...border },
    ...blank(g.span - 1),
  ]);
  const groupColor = GROUPS.flatMap((g) => Array.from({ length: g.span }, () => g.color));
  const headerRow: Cell[] = HEADERS.map((h, i) => ({
    ...base,
    value: h,
    fontWeight: "bold",
    textColor: groupColor[i],
    backgroundColor: "#f1f5f9",
    align: "center",
    alignVertical: "center",
    wrap: true,
    height: 30,
    ...border,
  }));

  const money = (n: number | null, extra: Record<string, unknown> = {}): Cell =>
    n === null ? { ...base, ...border, value: "—", align: "right" } : { ...base, ...border, value: n, type: Number, format: MONEY, ...extra };
  const textCell = (v: string | null, extra: Record<string, unknown> = {}): Cell => ({ ...base, ...border, value: v ?? "", ...extra });

  const dataRows: Cell[][] = rows.map((c, i) => {
    const m = c.metrics;
    return [
      textCell(String(i + 1), { align: "center" }),
      textCell(c.code),
      textCell(c.name, { wrap: true }),
      textCell(c.partner, { wrap: true }),
      money(c.value),
      textCell(monthLabel(c.performedAt), { align: "center" }),
      money(c.trainingCost),
      money(c.examCost),
      money(c.otherCost),
      money(m.totalCost),
      money(m.profit, { textColor: m.profit !== null && m.profit < 0 ? "#dc2626" : "#047857", ...(m.basis === "estimate" ? { fontStyle: "italic" } : {}) }),
      m.margin === null ? textCell("—", { align: "right" }) : { ...base, ...border, value: m.margin, type: Number, format: PCT, fontWeight: "bold" },
      textCell(m.rating ?? "", { align: "center" }),
      money(c.collected),
      money(m.receivable, { textColor: m.receivable > 0 ? "#dc2626" : "#334155" }),
      textCell(CONTRACT_STATUS[c.status as keyof typeof CONTRACT_STATUS]?.label ?? c.status, { align: "center" }),
      textCell(PAYMENT_STATUS[m.paymentStatus].label, { align: "center" }),
    ];
  });

  const totalStyle = { fontWeight: "bold", backgroundColor: "#e2e8f0" };
  const totalRow: Cell[] = [
    { ...base, ...border, ...totalStyle, value: "TỔNG CỘNG", columnSpan: 4, align: "center" },
    ...blank(3),
    money(totals.value, totalStyle),
    textCell("", totalStyle),
    money(totals.trainingCost, totalStyle),
    money(totals.examCost, totalStyle),
    money(totals.otherCost, totalStyle),
    money(totals.totalCost, totalStyle),
    money(totals.profit, totalStyle),
    { ...base, ...border, ...totalStyle, value: totals.margin, type: Number, format: PCT },
    textCell("", totalStyle),
    money(totals.collected, totalStyle),
    money(totals.receivable, totalStyle),
    textCell("", totalStyle),
    textCell("", totalStyle),
  ];

  const note: Cell[] = [
    {
      ...base,
      value:
        "Lợi nhuận gộp = Giá trị HĐ − (CP đào tạo + CP khảo thí + CP khác). Hợp đồng chưa nhập chi phí được ước tính theo tỷ suất LN dự kiến (chữ nghiêng). Còn phải thu = Giá trị HĐ − Đã thanh toán.",
      fontStyle: "italic",
      textColor: "#64748b",
      columnSpan: cols,
      wrap: true,
    },
    ...blank(cols - 1),
  ];

  const data = [title, blank(cols), kpiLabels, kpiValues, kpiNotes, blank(cols), groupRow, headerRow, ...dataRows, totalRow, blank(cols), note];
  await writeXlsxFile(data as never, {
    sheet: "Hợp đồng & chi phí",
    orientation: "landscape",
    columns: WIDTHS.map((width) => ({ width })),
    stickyRowsCount: 8,
  }).toFile(filename);
}
