import { z } from "zod";

export const AI_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const AI_FILES_TOTAL_BYTES = 8 * 1024 * 1024;
export const AI_FILE_COUNT = 3;
export const AI_FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.csv,.txt,.docx";
export const aiAttachmentSchema = z.object({
  name: z.string().min(1).max(180),
  data: z.string().min(4).max(Math.ceil(AI_FILE_MAX_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Dữ liệu file không hợp lệ")
    .refine(s => s.length % 4 === 0, "Dữ liệu file không hợp lệ"),
}).strict();
export const aiAttachmentsSchema = z.array(aiAttachmentSchema).max(AI_FILE_COUNT).default([])
  .refine(files => files.reduce((n, f) => n + aiFileBytes(f), 0) <= AI_FILES_TOTAL_BYTES, "Tổng file tối đa 8 MB")
  .refine(files => new Set(files.map(f => aiFileName(f.name).toLocaleLowerCase("vi"))).size === files.length, "Các file phải có tên khác nhau để đối chiếu nguồn");
export type AiAttachment = z.infer<typeof aiAttachmentSchema>;
export const aiFileBytes = (f: AiAttachment) => f.data.length * 3 / 4 - (f.data.endsWith("==") ? 2 : f.data.endsWith("=") ? 1 : 0);

export function aiFileName(raw: string) {
  return (raw.normalize("NFC").split(/[\\/]/).pop() ?? "file")
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, 180);
}

export async function readAiAttachment(file: File): Promise<AiAttachment> {
  if (!file.size || file.size > AI_FILE_MAX_BYTES) throw new Error("Mỗi file phải có dữ liệu và không quá 4 MB.");
  const name = aiFileName(file.name);
  if (!/\.(pdf|png|jpe?g|webp|xlsx|csv|txt|docx)$/i.test(name)) throw new Error("Hỗ trợ PDF, PNG/JPG/WebP, Excel .xlsx, CSV, TXT và Word .docx.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Không đọc được file. Hãy chọn lại."));
    reader.readAsDataURL(file);
  });
  return { name, data };
}
