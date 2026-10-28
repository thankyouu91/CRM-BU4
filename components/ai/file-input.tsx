"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AI_FILE_ACCEPT, aiAttachmentsSchema, readAiAttachment, type AiAttachment } from "@/lib/ai-attachments";

export function AiFileInput({ files, onChange, disabled, reading, onReading }: {
  files: AiAttachment[]; onChange: (files: AiAttachment[]) => void; disabled: boolean;
  reading: boolean; onReading: (reading: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" multiple accept={AI_FILE_ACCEPT} className="sr-only" aria-label="Chọn tài liệu cho AI" disabled={disabled || reading} onChange={async e => {
        const selected = Array.from(e.target.files ?? []); e.target.value = "";
        if (!selected.length) return;
        if (selected.length + files.length > 3) { toast.error("Tối đa 3 file mỗi lần. Hãy bỏ bớt file đã chọn."); return; }
        onReading(true);
        try {
          const next = [...files, ...await Promise.all(selected.map(readAiAttachment))];
          const valid = aiAttachmentsSchema.safeParse(next);
          if (!valid.success) throw new Error(valid.error.issues[0].message);
          onChange(valid.data);
        } catch (error) { toast.error(error instanceof Error ? error.message : "Không đọc được file"); }
        finally { onReading(false); }
      }} />
      <Button type="button" size="sm" variant="outline" loading={reading} disabled={disabled} onClick={() => input.current?.click()}><Paperclip className="h-3.5 w-3.5" /> Đính kèm file</Button>
      <span className="text-xs text-muted-foreground">PDF, ảnh, Excel, Word, CSV/TXT · 3 file · 4 MB/file · tổng 8 MB</span>
    </div>
    {files.length > 0 && <>
      <ul className="flex flex-wrap gap-2" aria-label="Tài liệu đang đính kèm">{files.map(f => <li key={f.name} className="flex min-w-0 max-w-full items-center gap-1 rounded-lg border bg-muted/40 py-1 pl-2 text-xs">
        <span className="truncate" title={f.name}>{f.name}</span>
        <button type="button" disabled={disabled || reading} aria-label={`Bỏ file ${f.name}`} className="shrink-0 rounded p-1 hover:bg-muted disabled:opacity-40" onClick={() => onChange(files.filter(x => x !== f))}><X className="h-3.5 w-3.5" /></button>
      </li>)}</ul>
      <p className="text-xs text-muted-foreground">File được gửi đến Claude khi bạn gửi câu hỏi hoặc trích xuất. File tiếp tục dùng cho câu hỏi sau đến khi bạn bỏ file; cần chọn lại sau khi tải lại trang.</p>
    </>}
  </div>;
}
