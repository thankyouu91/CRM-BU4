import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_UPLOAD_BYTES,
  R2_STORAGE_LIMIT_BYTES,
  STORAGE_LIMIT_BYTES,
  cleanFileName,
  contentDisposition,
  formatFileSize,
  isPdf,
  looksLikePdfName,
} from "@/lib/contract-files";

const KiB = 1024;
const MiB = 1024 * KiB;
const GiB = 1024 * MiB;
const bytes = (s: string) => new TextEncoder().encode(s);

describe("size limits", () => {
  it("lets one full-size file fit in one upload request", () => {
    expect(MAX_FILE_BYTES).toBeGreaterThan(0);
    expect(MAX_UPLOAD_BYTES).toBeGreaterThan(MAX_FILE_BYTES);
  });

  it("keeps the storage caps above a single file", () => {
    expect(STORAGE_LIMIT_BYTES).toBeGreaterThan(MAX_FILE_BYTES);
    expect(R2_STORAGE_LIMIT_BYTES).toBeGreaterThan(STORAGE_LIMIT_BYTES);
  });
});

describe("isPdf", () => {
  it("accepts bytes starting with %PDF-", () => {
    expect(isPdf(bytes("%PDF-1.7\n..."))).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["only the magic itself", "%PDF-"],
    ["lowercase", "%pdf-1.4"],
    ["missing dash", "%PDF1.4"],
    ["leading whitespace", " %PDF-1.4"],
    ["PNG", "\x89PNG\r\n\x1a\n"],
    ["HTML", "<html><body>%PDF-1.4</body></html>"],
  ])("rejects %s", (_name, s) => {
    expect(isPdf(bytes(s))).toBe(false);
  });
});

describe("looksLikePdfName", () => {
  it.each([
    [{ name: "hop-dong.pdf", type: "" }, true],
    [{ name: "HOP-DONG.PDF", type: "" }, true],
    [{ name: "scan", type: "application/pdf" }, true],
    [{ name: "hop-dong.pdf.exe", type: "application/octet-stream" }, false],
    [{ name: "pdf", type: "text/plain" }, false],
    [{ name: "anh.png", type: "image/png" }, false],
  ])("%j -> %s", (file, expected) => {
    expect(looksLikePdfName(file)).toBe(expected);
  });
});

describe("cleanFileName", () => {
  it("keeps a plain name", () => {
    expect(cleanFileName("Hop dong 01.pdf")).toBe("Hop dong 01.pdf");
    expect(cleanFileName("Report.PDF")).toBe("Report.PDF");
  });

  it("strips Windows and POSIX paths", () => {
    expect(cleanFileName("C:\\Users\\an\\Desktop\\HD.pdf")).toBe("HD.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd.pdf");
    expect(cleanFileName("a/b\\c.pdf")).toBe("c.pdf");
  });

  it("normalises decomposed Vietnamese to NFC", () => {
    const decomposed = "Ho\u031B\u0323p \u0111o\u0302\u0300ng.pdf"; // "Hợp đồng.pdf" as macOS sends it
    expect(decomposed).not.toBe("Hợp đồng.pdf");
    const cleaned = cleanFileName(decomposed);
    expect(cleaned).toBe("Hợp đồng.pdf");
    expect(cleaned).toBe(cleaned.normalize("NFC"));
  });

  it("removes control and bidi characters", () => {
    expect(cleanFileName("a\u0000b\u001fc\u007f.pdf")).toBe("abc.pdf");
    // Right-to-left override used to disguise "fdp.exe" style names.
    expect(cleanFileName("invoice\u202Eexe.pdf")).toBe("invoiceexe.pdf");
    expect(cleanFileName("\u200e\u200fx\u2066\u2069.pdf")).toBe("x.pdf");
  });

  it("collapses whitespace (including newlines) and trims", () => {
    expect(cleanFileName("  a \t\n  b  .pdf  ")).toBe("a b .pdf");
    expect(cleanFileName("  a   b  ")).toBe("a b.pdf");
  });

  it("appends .pdf when missing", () => {
    expect(cleanFileName("contract")).toBe("contract.pdf");
    expect(cleanFileName("contract.docx")).toBe("contract.docx.pdf");
  });

  it("caps the length at 180 and keeps the .pdf ending", () => {
    const long = cleanFileName("a".repeat(300));
    expect(long).toHaveLength(180);
    expect(long.endsWith(".pdf")).toBe(true);

    const longPdf = cleanFileName(`${"b".repeat(200)}.pdf`);
    expect(longPdf).toHaveLength(180);
    expect(longPdf).toBe(`${"b".repeat(176)}.pdf`);

    expect(cleanFileName(`${"c".repeat(176)}.pdf`)).toHaveLength(180);
  });

  it("does not leave a trailing space before .pdf after cutting", () => {
    const name = cleanFileName(`${"d".repeat(175)} ${"e".repeat(50)}`);
    expect(name).toBe(`${"d".repeat(175)}.pdf`);
  });

  it.each(["", "   ", ".pdf", "/", "C:\\folder\\", "\u202E\u0000"])("falls back for empty name %j", (raw) => {
    expect(cleanFileName(raw)).toBe("hop-dong.pdf");
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [500, "500 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1100, "1 KB"],
    [850 * KiB, "850 KB"],
    [MiB, "1 MB"],
    [1.2 * MiB, "1,2 MB"],
    [10 * MiB, "10 MB"],
    [GiB, "1 GB"],
    [1.5 * GiB, "1,5 GB"],
    [9 * GiB, "9 GB"],
  ])("%d -> %s", (n, text) => {
    expect(formatFileSize(n)).toBe(text);
  });

  it("formats the configured limits in their units", () => {
    expect(formatFileSize(MAX_FILE_BYTES)).toBe(`${(MAX_FILE_BYTES / MiB).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`);
    expect(formatFileSize(R2_STORAGE_LIMIT_BYTES)).toBe(
      `${(R2_STORAGE_LIMIT_BYTES / GiB).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB`,
    );
  });
});

describe("contentDisposition", () => {
  it("passes a plain ASCII name through", () => {
    expect(contentDisposition("contract.pdf", "inline")).toBe(`inline; filename="contract.pdf"; filename*=UTF-8''contract.pdf`);
  });

  it("gives Vietnamese names an ASCII fallback and an exact UTF-8 filename*", () => {
    const name = "Hợp đồng Đà Nẵng.pdf";
    expect(contentDisposition(name, "attachment")).toBe(
      `attachment; filename="Hop dong Da Nang.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
  });

  it("decodes filename* back to the exact name", () => {
    const name = "Báo cáo (bản 2) * it's.pdf";
    const header = contentDisposition(name, "attachment");
    const encoded = header.split("filename*=UTF-8''")[1];
    expect(encoded).not.toMatch(/['()*]/);
    expect(encoded).toContain("%27");
    expect(encoded).toContain("%28");
    expect(encoded).toContain("%29");
    expect(encoded).toContain("%2A");
    expect(decodeURIComponent(encoded)).toBe(name);
  });

  it("cannot break out of the quoted filename or inject header lines", () => {
    const header = contentDisposition('a"b\\c\r\nSet-Cookie: x=1.pdf', "attachment");
    expect(header).not.toMatch(/[\r\n]/);
    const ascii = /filename="([^"]*)"/.exec(header)![1];
    expect(ascii).toBe("a_b_c__Set-Cookie: x=1.pdf");
    // Only printable ASCII in the whole header value.
    expect(header).toMatch(/^[\x20-\x7e]+$/);
  });

  it("replaces characters without an ASCII form", () => {
    expect(contentDisposition("合同.pdf", "inline")).toContain(`filename="__.pdf"`);
  });
});
