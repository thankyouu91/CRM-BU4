import { z } from "zod";
import { aiFileName } from "./ai-attachments";

const nullableText = (max: number) => z.string().trim().max(max).nullable().default(null);
const money = z.number().int().min(0).max(1_000_000_000_000_000).nullable().default(null);
const date = z.iso.date().nullable().default(null);
export const INTAKE_FIELDS = {
  name: "Tên dự án / hợp đồng", description: "Nội dung", projectName: "Dự án liên quan", code: "Số hợp đồng", partner: "Đối tác",
  value: "Giá trị hợp đồng", currency: "Đơn vị tiền tệ", startDate: "Ngày bắt đầu", dueDate: "Deadline", performedAt: "Ngày thực hiện",
  trainingCost: "Chi phí đào tạo", examCost: "Chi phí khảo thí", otherCost: "Chi phí khác", collected: "Đã thu", note: "Ghi chú",
} as const;
export type IntakeField = keyof typeof INTAKE_FIELDS;
export const intakeFieldsSchema = z.object({
  name: nullableText(300), description: nullableText(4000), projectName: nullableText(300), code: nullableText(120), partner: nullableText(200),
  value: money, currency: nullableText(20), startDate: date, dueDate: date, performedAt: date,
  trainingCost: money, examCost: money, otherCost: money, collected: money, note: nullableText(2000),
}).strict();
export const intakeProposalSchema = z.object({
  kind: z.enum(["project", "contract"]),
  fields: intakeFieldsSchema,
  evidence: z.array(z.object({ field: z.enum(Object.keys(INTAKE_FIELDS) as [IntakeField, ...IntakeField[]]), file: z.string().min(1).max(180), location: z.string().min(1).max(200), quote: z.string().min(1).max(1000) }).strict()).max(40),
  warnings: z.array(z.string().max(500)).max(20),
}).strict();
export const aiIntakeSchema = z.object({ summary: z.string().min(1).max(6000), proposals: z.array(intakeProposalSchema).max(10) }).strict();
export type IntakeProposal = z.infer<typeof intakeProposalSchema>;
export type AiIntake = z.infer<typeof aiIntakeSchema>;

/** An extraction can propose field values, never record IDs, permission changes or writes. */
export function validateIntake(value: unknown, files: string[]): AiIntake {
  const result = aiIntakeSchema.parse(value);
  const names = new Set(files.map(aiFileName));
  for (const p of result.proposals) {
    p.evidence = p.evidence.filter(e => names.has(aiFileName(e.file)));
    const supported = new Set(p.evidence.map(e => e.field));
    for (const field of Object.keys(INTAKE_FIELDS) as IntakeField[]) {
      if (p.fields[field] !== null && !supported.has(field)) {
        p.fields[field] = null;
        p.warnings.push(`${INTAKE_FIELDS[field]} chưa có nguồn trong file; để trống để kiểm tra.`);
      }
    }
    const currency = p.fields.currency?.trim().toUpperCase();
    if (!["VND", "VNĐ", "Đ", "ĐỒNG"].includes(currency ?? "")) {
      const fields = ["value", "trainingCost", "examCost", "otherCost", "collected"] as const;
      if (fields.some(f => p.fields[f] !== null)) p.warnings.push("Chưa xác nhận đơn vị VND; số tiền chưa được điền. Hãy đối chiếu đơn vị tiền tệ trước khi nhập.");
      fields.forEach(field => { p.fields[field] = null; });
    }
    if (p.fields.startDate && p.fields.dueDate && p.fields.startDate > p.fields.dueDate) {
      p.warnings.push("Ngày bắt đầu nằm sau deadline; cần kiểm tra lại.");
      p.fields.startDate = null; p.fields.dueDate = null;
    }
    if (!p.fields.name) p.warnings.push("Cần bổ sung tên trước khi lưu.");
    if (p.kind === "contract" && (p.fields.value === null || !p.fields.performedAt)) p.warnings.push("Cần xác nhận giá trị hợp đồng và ngày thực hiện trước khi lưu.");
    p.warnings = [...new Set(p.warnings)];
  }
  return result;
}
