// Contract PDFs ("Hồ sơ hợp đồng"): limits, checks and the API shape, shared by
// the API routes and the UI (no server-only imports). Bytes are kept by
// lib/file-storage.ts, apart from the ContractFile rows.

/**
 * Per-file cap. Bytes go through the Worker (128 MB memory, 100 MB request body):
 * an upload holds the multipart body and the file's bytes, so 25 MB per file
 * stays well inside the Worker's memory. Downloads are streamed.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_CONTRACT = 20;
/** One upload request (the UI sends one file per request): one file plus multipart overhead. */
export const MAX_UPLOAD_BYTES = MAX_FILE_BYTES + 1024 * 1024;
/**
 * All contract files together while they live in the Supabase database (500 MB
 * on the free plan, shared with the app's data), so uploads stop well before
 * the database fills up.
 */
export const STORAGE_LIMIT_BYTES = 300 * 1024 * 1024;
/** All contract files together in Cloudflare R2 (10 GB free), with headroom left. */
export const R2_STORAGE_LIMIT_BYTES = 9 * 1024 * 1024 * 1024;

export interface ContractFileDto {
  id: string;
  contractId: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  /** Opens the PDF inline; add ?download=1 to save it instead. */
  url: string;
}

export const contractFileUrl = (contractId: string, fileId: string) => `/api/contracts/${contractId}/files/${fileId}`;

/** The columns of a file listing; never the bytes (ContractFileBlob). */
export const contractFileSelect = {
  id: true,
  contractId: true,
  name: true,
  size: true,
  mimeType: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
} as const;

export function contractFileDto(f: {
  id: string;
  contractId: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
}): ContractFileDto {
  return { ...f, createdAt: f.createdAt.toISOString(), url: contractFileUrl(f.contractId, f.id) };
}

/** A real PDF starts with "%PDF-", whatever its name or declared type says. */
export function isPdf(bytes: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return bytes.length > magic.length && magic.every((b, i) => bytes[i] === b);
}

export function looksLikePdfName(file: { name: string; type: string }) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** Display/storage name: base name only, NFC (macOS sends decomposed Vietnamese), no control or bidi characters, ends in .pdf. */
export function cleanFileName(raw: string): string {
  let name = (raw.normalize("NFC").split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/\.pdf$/i.test(name)) name = `${name}.pdf`;
  if (name.length > 180) name = `${name.slice(0, 176).trimEnd()}.pdf`;
  return name === ".pdf" ? "hop-dong.pdf" : name;
}

/** "1,2 MB", "850 KB" */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB`;
}

/**
 * Content-Disposition with an ASCII fallback and the exact name as RFC 5987
 * `filename*`, so Vietnamese names survive in every browser.
 */
export function contentDisposition(name: string, type: "inline" | "attachment"): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
