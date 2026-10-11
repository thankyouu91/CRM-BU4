import { expect, it } from "vitest";
import JSZip from "jszip";
import { attachmentBlocks, readAiJson } from "../lib/ai-file-content";
import { AI_FILE_MAX_BYTES, aiAttachmentSchema, aiAttachmentsSchema } from "../lib/ai-attachments";
import { validateIntake } from "../lib/ai-intake";

const file = (name: string, data: string | Uint8Array) => ({ name, data: Buffer.from(data).toString("base64") });
const zipFile = async (name: string, entries: Record<string, string>) => {
  const zip = new JSZip(); Object.entries(entries).forEach(([path, text]) => zip.file(path, text));
  return file(name, await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
};
const textOf = (blocks: Awaited<ReturnType<typeof attachmentBlocks>>) => blocks.flatMap(b => b.type === "document" && b.source.type === "text" ? b.source.data : []).join("\n");

it("validates large base64 without recursive regex and rejects duplicate names, malformed data and aggregate limits", () => {
  const max = file("full.pdf", new Uint8Array(AI_FILE_MAX_BYTES));
  expect(aiAttachmentSchema.safeParse(max).success).toBe(true);
  expect(aiAttachmentSchema.safeParse({ ...max, data: "%%%=" }).success).toBe(false);
  expect(aiAttachmentSchema.safeParse({ ...max, data: "AAAAA" }).success).toBe(false);
  expect(aiAttachmentsSchema.safeParse([max, { ...max, name: "other.pdf" }]).success).toBe(true);
  expect(aiAttachmentsSchema.safeParse([max, { ...max, name: "other.pdf" }, file("one.txt", "1")]).success).toBe(false);
  expect(aiAttachmentsSchema.safeParse([file("one.txt", "a"), file("ONE.txt", "b")]).success).toBe(false);
});

it("sends actual PDF/image blocks, preserves UTF-8 text and rejects spoofed or unreadable files", async () => {
  const blocks = await attachmentBlocks([file("hợp đồng.pdf", "%PDF-1.7\n"), file("ảnh.png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), file("nội dung.csv", "Tên,Số hợp đồng\nDự án,00123")]);
  expect(blocks[1]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
  expect(blocks[3]).toMatchObject({ type: "image", source: { media_type: "image/png" } });
  expect(textOf(blocks)).toContain("00123");
  await expect(attachmentBlocks([file("bad.pdf", "not PDF")])).rejects.toThrow("không hợp lệ");
  await expect(attachmentBlocks([file("bad.txt", new Uint8Array([0xff]))])).rejects.toThrow("Không đọc được");
  await expect(attachmentBlocks([file("huge.txt", "x".repeat(60001))])).rejects.toThrow("quá dài");
});

it("reads Word paragraphs and tables but refuses XML entities, macro files and decompression bombs", async () => {
  const word = await zipFile("brief.docx", { "word/document.xml": '<w:document><w:body><w:p><w:r><w:t>Dự án A</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>00123</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>' });
  expect(textOf(await attachmentBlocks([word]))).toContain("Dự án A\n00123");
  await expect(attachmentBlocks([await zipFile("entity.docx", { "word/document.xml": '<!DOCTYPE doc [<!ENTITY x "unsafe">]><doc>&x;</doc>' })])).rejects.toThrow("XML");
  await expect(attachmentBlocks([await zipFile("macro.docx", { "word/vbaProject.bin": "macro" })])).rejects.toThrow("macro");
  await expect(attachmentBlocks([await zipFile("bomb.docx", { "word/document.xml": "x".repeat(3 * 1024 * 1024) })])).rejects.toThrow("giải nén quá lớn");
});

it("reads all Excel sheets with cell references, leading-zero strings, date cells and cached-formula warnings", async () => {
  const book = await zipFile("budget.xlsx", {
    "xl/workbook.xml": '<workbook><sheets><sheet name="Hợp đồng" r:id="r1"/><sheet name="Chi phí" r:id="r2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
    "xl/sharedStrings.xml": '<sst><si><t>00123</t></si></sst>',
    "xl/styles.xml": '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" s="1"><v>46114</v></c></row></sheetData></worksheet>',
    "xl/worksheets/sheet2.xml": '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>VND</t></is></c><c r="B1"><f>1+2</f><v>3</v></c></row></sheetData></worksheet>',
  });
  const text = textOf(await attachmentBlocks([book]));
  expect(text).toContain("Sheet: Hợp đồng\nA1: 00123 | B1: 2026-04-02");
  expect(text).toContain("Sheet: Chi phí\nA1: VND | B1: 3 [kết quả công thức đã lưu; cần đối chiếu]");
});

it("bounds actual streamed JSON bodies even when the content length is missing", async () => {
  expect(await readAiJson(new Request("http://local", { method: "POST", body: '{"ok":true}' }))).toEqual({ ok: true });
  await expect(readAiJson(new Request("http://local", { method: "POST", body: "invalid" }))).rejects.toThrow("không hợp lệ");
  await expect(readAiJson(new Request("http://local", { method: "POST", body: "x".repeat(12 * 1024 * 1024 + 1) }))).rejects.toThrow("quá lớn");
});

it("keeps only sourced values, requires VND, clears conflicting dates and never accepts record IDs", () => {
  const evidence = (field: string) => ({ field, file: "a.txt", location: "Dòng 1", quote: "Tên dự án, 00123, 2026-10-12" });
  const proposal = { kind: "contract", fields: { name: "Tên dự án", code: "00123", value: 1000, currency: "USD", startDate: "2026-10-12", dueDate: "2026-10-01", partner: "Không có nguồn" }, evidence: ["name", "code", "value", "currency", "startDate", "dueDate"].map(evidence), warnings: [] };
  const validated = validateIntake({ summary: "Review", proposals: [proposal] }, ["a.txt"]).proposals[0];
  expect(validated.fields).toMatchObject({ name: "Tên dự án", code: "00123", value: null, partner: null, startDate: null, dueDate: null, performedAt: null });
  expect(validated.warnings.length).toBeGreaterThan(2);
  expect(() => validateIntake({ summary: "x", proposals: [{ ...proposal, projectId: "secret" }] }, ["a.txt"])).toThrow();
  expect(validateIntake({ summary: "x", proposals: [proposal] }, ["other.txt"]).proposals[0].fields.name).toBeNull();
});
