"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api, ApiError, useApi } from "@/lib/client";
import {
  MAX_FILE_BYTES,
  MAX_FILES_PER_CONTRACT,
  formatFileSize,
  looksLikePdfName,
  type ContractFileDto,
} from "@/lib/contract-files";
import { cn, formatDateTime } from "@/lib/utils";

interface FilesResponse {
  files: ContractFileDto[];
  storage: { used: number; limit: number };
}

const LIMITS_HINT = `Chỉ file PDF, tối đa ${formatFileSize(MAX_FILE_BYTES)} mỗi file, ${MAX_FILES_PER_CONTRACT} file mỗi hợp đồng.`;

function Reminder() {
  return (
    <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
      Hợp đồng đã hoàn thành — hãy đính kèm bản PDF đã ký để lưu trữ và báo cáo.
    </p>
  );
}

/** Instant check before sending; the server checks again, including the PDF signature. */
export function precheckPdf(file: File): string | null {
  if (!looksLikePdfName(file)) return `“${file.name}” không phải file PDF`;
  if (file.size === 0) return `“${file.name}” là file rỗng`;
  if (file.size > MAX_FILE_BYTES) return `“${file.name}” (${formatFileSize(file.size)}) vượt mức ${formatFileSize(MAX_FILE_BYTES)} mỗi file`;
  return null;
}

/** One PDF per request, with upload progress (XHR: fetch reports none). */
export function uploadContractFile(contractId: string, file: File, onProgress?: (pct: number) => void): Promise<ContractFileDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/contracts/${contractId}/files`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const data = (xhr.response ?? {}) as { files?: ContractFileDto[]; error?: string };
      if (xhr.status === 401) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      if (xhr.status >= 200 && xhr.status < 300 && data.files?.[0]) resolve(data.files[0]);
      else reject(new ApiError(data.error ?? "Không thể tải file lên", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Mất kết nối khi tải file lên", 0));
    const form = new FormData();
    form.append("files", file, file.name);
    xhr.send(form);
  });
}

/** Upload files one by one; failures are shown as toasts. Returns how many were stored. */
export async function uploadContractFiles(contractId: string, files: File[], onProgress?: (index: number, pct: number) => void) {
  let stored = 0;
  for (const [i, file] of files.entries()) {
    try {
      await uploadContractFile(contractId, file, (pct) => onProgress?.(i, pct));
      stored++;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : `Không thể tải “${file.name}” lên`);
    }
  }
  return stored;
}

/** Valid files from a pick or a drop; the rest are reported. */
function acceptPdfs(list: FileList | File[]): File[] {
  const ok: File[] = [];
  for (const f of Array.from(list)) {
    const problem = precheckPdf(f);
    if (problem) toast.error(problem);
    else ok.push(f);
  }
  return ok;
}

/** Drop zone + "Chọn file" button. */
function PdfDrop({ onFiles, busy, disabled, compact }: { onFiles: (files: File[]) => void; busy?: boolean; disabled?: boolean; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(acceptPdfs(e.dataTransfer.files));
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors sm:flex-row sm:gap-3",
        compact ? "py-3" : "py-5",
        over ? "border-primary bg-primary/5" : "border-border bg-muted/20",
        disabled && "opacity-60",
      )}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
      <p className="text-xs text-muted-foreground">
        Kéo thả file PDF vào đây hoặc{" "}
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="font-medium text-primary hover:underline disabled:cursor-not-allowed"
        >
          chọn file
        </button>
        <span className="block text-[11px]">{LIMITS_HINT}</span>
      </p>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles(acceptPdfs(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function FileRow({ file, onDelete }: { file: ContractFileDto; onDelete?: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <FileText className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0 flex-1">
        <a href={file.url} target="_blank" rel="noopener" className="block truncate text-sm font-medium hover:text-primary hover:underline" title={file.name}>
          {file.name}
        </a>
        <p className="truncate text-[11px] text-muted-foreground">
          {formatFileSize(file.size)} · {file.uploadedBy.name} · {formatDateTime(file.createdAt)}
        </p>
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden text-xs text-danger sm:inline">Xoá file này?</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete?.();
              } finally {
                setBusy(false);
                setConfirming(false);
              }
            }}
          >
            Xoá
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5">
          <a href={file.url} target="_blank" rel="noopener" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Mở trong tab mới">
            <ExternalLink className="h-4 w-4" />
          </a>
          <a href={`${file.url}?download=1`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Tải về">
            <Download className="h-4 w-4" />
          </a>
          {onDelete && (
            <button onClick={() => setConfirming(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger" title="Xoá file">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

interface UploadItem {
  key: string;
  name: string;
  pct: number;
  file: File;
}

/** A saved contract's PDFs: list, open, delete, upload more. */
export function ContractFiles({ contractId, onChanged, remind }: { contractId: string; onChanged?: () => void; remind?: boolean }) {
  const { data, loading, error, reload, setData } = useApi<FilesResponse>(`/api/contracts/${contractId}/files`);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const files = data?.files ?? [];
  const full = files.length >= MAX_FILES_PER_CONTRACT;

  const upload = async (picked: File[]) => {
    const room = MAX_FILES_PER_CONTRACT - files.length - uploads.length;
    if (picked.length > room) toast.error(`Mỗi hợp đồng lưu tối đa ${MAX_FILES_PER_CONTRACT} file PDF`);
    const queue = picked.slice(0, Math.max(0, room)).map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, pct: 0, file: f }));
    if (!queue.length) return;
    setUploads((u) => [...u, ...queue]);
    let stored = 0;
    for (const item of queue) {
      try {
        const saved = await uploadContractFile(contractId, item.file, (pct) => setUploads((u) => u.map((x) => (x.key === item.key ? { ...x, pct } : x))));
        setData((d) => (d ? { ...d, files: [...d.files, saved], storage: { ...d.storage, used: d.storage.used + saved.size } } : d));
        stored++;
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : `Không thể tải “${item.name}” lên`);
      } finally {
        setUploads((u) => u.filter((x) => x.key !== item.key));
      }
    }
    if (stored) {
      toast.success(stored === 1 ? "Đã lưu file hợp đồng" : `Đã lưu ${stored} file hợp đồng`);
      onChanged?.();
    }
  };

  const remove = async (f: ContractFileDto) => {
    try {
      await api(f.url, { method: "DELETE" });
      setData((d) => (d ? { ...d, files: d.files.filter((x) => x.id !== f.id), storage: { ...d.storage, used: d.storage.used - f.size } } : d));
      toast.success("Đã xoá file");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Không thể xoá file");
      void reload();
    }
  };

  return (
    <div className="space-y-3">
      {!data && loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error && !data ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        (files.length > 0 || uploads.length > 0) && (
          <ul className="divide-y rounded-xl border">
            {files.map((f) => (
              <FileRow key={f.id} file={f} onDelete={() => remove(f)} />
            ))}
            {uploads.map((u) => (
              <li key={u.key} className="flex items-center gap-3 px-3 py-2.5">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{u.name}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${u.pct}%` }} />
                  </div>
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{u.pct}%</span>
              </li>
            ))}
          </ul>
        )
      )}
      {data && files.length === 0 && uploads.length === 0 && (remind ? <Reminder /> : <p className="text-xs text-muted-foreground">Chưa có file nào cho hợp đồng này.</p>)}
      {full ? (
        <p className="text-xs text-muted-foreground">Đã đủ {MAX_FILES_PER_CONTRACT} file — xoá bớt để tải thêm.</p>
      ) : (
        <PdfDrop onFiles={upload} busy={uploads.length > 0} disabled={!data} compact={files.length > 0} />
      )}
      {data && (
        <p className="text-[11px] text-muted-foreground">
          {files.length}/{MAX_FILES_PER_CONTRACT} file · Kho lưu trữ hồ sơ: {formatFileSize(data.storage.used)} / {formatFileSize(data.storage.limit)}
        </p>
      )}
    </div>
  );
}

/** Files picked for a contract that is not saved yet; they upload right after it is created. */
export function PendingFiles({ files, onChange, remind }: { files: File[]; onChange: (files: File[]) => void; remind?: boolean }) {
  return (
    <div className="space-y-3">
      {remind && files.length === 0 && <Reminder />}
      {files.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatFileSize(f.size)} · tải lên khi lưu hợp đồng</p>
              </div>
              <button onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Bỏ file">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length < MAX_FILES_PER_CONTRACT && (
        <PdfDrop compact={files.length > 0} onFiles={(picked) => onChange([...files, ...picked].slice(0, MAX_FILES_PER_CONTRACT))} />
      )}
    </div>
  );
}

/** The files of one contract in their own dialog (from a table row). */
export function ContractFilesModal({
  contract,
  onClose,
  onChanged,
}: {
  contract: { id: string; name: string; code: string | null } | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  return (
    <Modal open={!!contract} onClose={onClose} title="Hồ sơ hợp đồng (PDF)" description={contract ? `${contract.name}${contract.code ? ` · ${contract.code}` : ""}` : undefined}>
      {contract && <ContractFiles contractId={contract.id} onChanged={onChanged} />}
    </Modal>
  );
}

/** Paperclip + count for table rows; amber when a completed project's contract has none. */
export function FileCountButton({ count, onClick, warn }: { count: number; onClick: () => void; warn?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={count ? `${count} file PDF — bấm để xem` : "Chưa có file PDF — bấm để tải lên"}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors",
        count
          ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300"
          : warn
            ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
            : "text-muted-foreground hover:bg-muted",
      )}
    >
      <Paperclip className="h-3.5 w-3.5" />
      {count || "Chưa có"}
    </button>
  );
}

/** One click: pick PDFs and upload them to the contract. */
export function UploadPdfButton({ contractId, onUploaded, label = "Tải PDF lên" }: { contractId: string; onUploaded: () => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="outline" loading={busy !== null} onClick={() => input.current?.click()}>
        {busy === null && <Upload className="h-3.5 w-3.5" />}
        {busy ?? label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={async (e) => {
          const picked = e.target.files ? acceptPdfs(e.target.files) : [];
          e.target.value = "";
          if (!picked.length) return;
          setBusy("0%");
          const stored = await uploadContractFiles(contractId, picked, (i, pct) => setBusy(picked.length > 1 ? `${i + 1}/${picked.length} · ${pct}%` : `${pct}%`));
          setBusy(null);
          if (stored) {
            toast.success(stored === 1 ? "Đã lưu file hợp đồng" : `Đã lưu ${stored} file hợp đồng`);
            onUploaded();
          }
        }}
      />
    </>
  );
}
