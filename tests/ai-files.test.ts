import { expect, it } from "vitest";
import JSZip from "jszip";
import { attachmentBlocks, attachmentContent, readAiJson } from "../lib/ai-file-content";
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
});

it("sends the start of a text file that is too long, with a note for Claude and the person", async () => {
  const long = Array.from({ length: 30_000 }, (_, i) => `Dòng ${i + 1}: nội dung báo cáo`).join("\n");
  const { blocks, notices } = await attachmentContent([file("dai.txt", long)]);
  const text = textOf(blocks);
  expect(text.length).toBeLessThanOrEqual(200_000);
  expect(text).toContain("Dòng 1: nội dung");
  expect(text).toMatch(/\[ĐÃ LƯỢC BỚT: chỉ gửi khoảng \d+% đầu/);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toContain("“dai.txt” lớn nên AI chỉ nhận một phần");
  expect((await attachmentContent([file("ngan.txt", "ngắn")])).notices).toEqual([]);
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
  expect(text).toContain("Sheet: Hợp đồng\nHàng 1: A=00123 | B=2026-04-02");
  expect(text).toContain("Sheet: Chi phí\nHàng 1: A=VND | B=3 [CT]");
  expect(text).toContain("“[CT]” = kết quả công thức đã lưu");
});

const workbook = (sheets: Record<string, string>, shared = "") => zipFile("bao-cao.xlsx", {
  "xl/workbook.xml": `<workbook><sheets>${Object.keys(sheets).map((name, i) => `<sheet name="${name}" r:id="r${i + 1}"/>`).join("")}</sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<Relationships>${Object.keys(sheets).map((_, i) => `<Relationship Id="r${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`,
  ...(shared ? { "xl/sharedStrings.xml": `<sst>${shared}</sst>` } : {}),
  ...Object.fromEntries(Object.values(sheets).map((xml, i) => [`xl/worksheets/sheet${i + 1}.xml`, `<worksheet><sheetData>${xml}</sheetData></worksheet>`])),
});
const dataRows = (from: number, to: number, cells = 12) => Array.from({ length: to - from + 1 }, (_, k) => {
  const r = from + k;
  return `<row r="${r}">${Array.from({ length: cells }, (_, c) => `<c r="${String.fromCharCode(65 + c)}${r}" t="inlineStr"><is><t>Khoá đào tạo ${r}-${c} Hà Nội</t></is></c>`).join("")}</row>`;
}).join("");

it("decodes numeric character references, skips empty bordered cells and rows, and names cells without references", async () => {
  const text = textOf(await attachmentBlocks([await workbook({
    "Đào tạo": '<row r="1"><c r="A1" t="inlineStr"><is><t>B&#193;O C&#193;O T&#7892;NG H&#7906;P</t></is></c><c r="B1" s="3"/><c r="C1" s="3"><v></v></c></row>'
      + '<row r="2"><c r="A2" s="3"/><c r="B2" s="3"/></row>'
      + '<row r="3"><c t="inlineStr"><is><t>STT</t></is></c><c/><c t="inlineStr"><is><t>Đơn vị</t></is></c></row>',
  })]));
  expect(text).toContain("Hàng 1: A=BÁO CÁO TỔNG HỢP\n");
  expect(text).not.toContain("Hàng 2");
  expect(text).toContain("Hàng 3: A=STT | C=Đơn vị");
  expect(text).not.toContain("&#");
});

it("fits a large workbook: small sheets whole, large ones keep their first and last rows, with notices", async () => {
  const total = '<row r="2000"><c r="A2000" t="inlineStr"><is><t>TỔNG CỘNG</t></is></c><c r="B2000"><f>SUM(B2:B1999)</f><v>123456</v></c></row>';
  const { blocks, notices } = await attachmentContent([await workbook({
    "Đào tạo": dataRows(1, 1999) + total,
    "Khảo thí": dataRows(1, 1500),
    "Tổng hợp": dataRows(1, 12, 3),
  })]);
  const text = textOf(blocks);
  expect(text.length).toBeLessThanOrEqual(200_000);
  expect(text).toContain("Hàng 1: A=Khoá đào tạo 1-0");
  expect(text).toContain("Hàng 2000: A=TỔNG CỘNG | B=123456 [CT]");
  expect(text).toContain("Hàng 12: A=Khoá đào tạo 12-0");
  expect(text).toMatch(/\[ĐÃ LƯỢC BỚT: \d+ hàng có dữ liệu \(hàng \d+–1997\)/);
  expect(text).toContain("LƯU Ý: file quá lớn nên chỉ gửi một phần");
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatch(/sheet “Đào tạo” \d+\/2000 hàng; sheet “Khảo thí” \d+\/1500 hàng/);
  expect(notices[0]).not.toContain("Tổng hợp");
  // A workbook that fits is sent whole, without notices.
  const small = await attachmentContent([await workbook({ "Một": dataRows(1, 50) })]);
  expect(small.notices).toEqual([]);
  expect(textOf(small.blocks)).toContain("Hàng 50:");
});

it("reads an oversized worksheet up to the XML limit, cut after a whole row, instead of refusing it", async () => {
  const { blocks, notices } = await attachmentContent([await workbook({ "Lớn": dataRows(1, 9000) })]);
  const text = textOf(blocks);
  expect(text).toMatch(/\[ĐÃ LƯỢC BỚT: phần sau hàng \d+ của sheet không được đọc/);
  expect(text).toContain("chưa đọc hết");
  expect(notices[0]).toMatch(/sheet “Lớn”/);
  const last = [...text.matchAll(/^Hàng (\d+): /gm)].map(m => Number(m[1])).at(-1)!;
  expect(last).toBeGreaterThan(1000);
  expect(last).toBeLessThan(9000);
});

it("shares the text budget between text files and still refuses a workbook with only empty sheets", async () => {
  const one = await workbook({ "A": dataRows(1, 1500) });
  const two = { ...(await workbook({ "B": dataRows(1, 1500) })), name: "khac.xlsx" };
  const { blocks, notices } = await attachmentContent([one, two]);
  const sizes = blocks.flatMap(b => b.type === "document" && b.source.type === "text" ? [b.source.data.length] : []);
  expect(sizes).toHaveLength(2);
  expect(sizes.every(n => n <= 150_000)).toBe(true);
  expect(notices).toHaveLength(2);
  await expect(attachmentBlocks([await workbook({ "Trống": '<row r="1"><c r="A1" s="1"/></row>' })])).rejects.toThrow("không có văn bản đọc được");
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
