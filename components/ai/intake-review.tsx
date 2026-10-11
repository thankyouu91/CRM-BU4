"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { INTAKE_FIELDS, type AiIntake, type IntakeField } from "@/lib/ai-intake";
import { SWATCHES } from "@/lib/constants";
import { fromInputDate } from "@/lib/dates";
import type { ProjectFormValues } from "@/components/projects/project-form";
import type { Directory } from "@/components/projects/types";
import type { ContractFormState, ProjectOption } from "@/components/contracts/contract-form";

const ProjectForm = dynamic(() => import("@/components/projects/project-form").then(m => m.ProjectFormModal), { ssr: false });
const ContractForm = dynamic(() => import("@/components/contracts/contract-form").then(m => m.ContractModal), { ssr: false });
const normal = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("vi");

/** Only the existing, permission-checked forms can persist reviewed values. */
export function IntakeReview({ result, projects, canProject, canFinance, onProjectCreated }: {
  result: AiIntake; projects: ProjectOption[]; canProject: boolean; canFinance: boolean;
  onProjectCreated: (project: ProjectOption) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [directory, setDirectory] = useState<Directory>([]);
  const [loading, setLoading] = useState<number | null>(null);
  const proposal = active === null ? null : result.proposals[active];
  const initial = useMemo<ProjectFormValues | undefined>(() => proposal?.kind === "project" ? {
    name: proposal.fields.name ?? "", description: proposal.fields.description, status: "PLANNING", color: SWATCHES[0],
    startDate: fromInputDate(proposal.fields.startDate ?? ""), dueDate: fromInputDate(proposal.fields.dueDate ?? "", "end"), members: [],
  } : undefined, [proposal]);
  const defaults = useMemo<Partial<ContractFormState>>(() => {
    if (!proposal) return {};
    const f = proposal.fields;
    const matches = projects.filter(p => f.projectName && normal(p.name) === normal(f.projectName));
    return { name: f.name ?? "", code: f.code ?? "", partner: f.partner ?? "", value: f.value, performedAt: f.performedAt ?? "",
      trainingCost: f.trainingCost, examCost: f.examCost, otherCost: f.otherCost, collected: f.collected,
      projectId: matches.length === 1 ? matches[0].id : "", note: f.note ?? f.description ?? "" };
  }, [proposal, projects]);
  const open = async (index: number) => {
    if (result.proposals[index].kind === "project") {
      setLoading(index);
      try { const data = await api<{ users: (Directory[number] & { active?: boolean })[] }>("/api/users"); setDirectory(data.users.filter(u => u.active !== false)); }
      catch { toast.error("Không tải được danh sách nhân sự. Hãy thử lại."); return; }
      finally { setLoading(null); }
    }
    setActive(index);
  };
  return <div className="mt-3 space-y-3">
    {result.proposals.length > 0 && <p className="text-xs text-muted-foreground">Bản nháp từ AI · Đối chiếu nguồn, sau đó mở biểu mẫu để chỉnh sửa và lưu. File gốc chưa được lưu vào hồ sơ.</p>}
    {result.proposals.map((p, i) => {
      const allowed = p.kind === "project" ? canProject : canFinance;
      const matches = p.kind === "project" && p.fields.name ? projects.filter(x => normal(x.name) === normal(p.fields.name!)) : [];
      return <section key={i} className="overflow-hidden rounded-xl border bg-card" aria-label={`Đề xuất ${i + 1}`}>
        <div className="border-b bg-muted/30 px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">{p.kind === "project" ? "DỰ ÁN" : "HỢP ĐỒNG & CHI PHÍ"} · {i + 1}</p>
          <h3 className="mt-1 break-words text-sm font-semibold">{p.fields.name ?? "Chưa tìm thấy tên trong tài liệu"}</h3>
        </div>
        <dl className="divide-y px-3">{(Object.keys(INTAKE_FIELDS) as IntakeField[]).filter(f => p.fields[f] !== null).map(field => <div key={field} className="grid gap-1 py-2 text-xs sm:grid-cols-[140px_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{INTAKE_FIELDS[field]}</dt><dd className="min-w-0 break-words whitespace-pre-wrap">{typeof p.fields[field] === "number" ? p.fields[field].toLocaleString("vi-VN") + " đ" : p.fields[field]}</dd>
        </div>)}</dl>
        <div className="space-y-3 border-t p-3">
          {p.warnings.length > 0 && <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700 dark:text-amber-300">{p.warnings.map((w, j) => <li key={j}>{w}</li>)}</ul>}
          {matches.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">Đã có dự án trùng tên: {matches.map(p => <Link key={p.id} href={`/projects/${p.id}`} className="mr-2 underline">{p.name}</Link>)}. Kiểm tra trước khi tạo thêm.</p>}
          {p.kind === "contract" && <p className="text-xs text-muted-foreground">Kiểm tra số hợp đồng để tránh nhập trùng. Chi phí / đã thu để trống sẽ được lưu là 0 theo biểu mẫu hợp đồng.</p>}
          <details className="text-xs"><summary className="cursor-pointer font-medium">Đối chiếu nguồn ({p.evidence.length})</summary>
            <ul className="mt-2 space-y-2">{p.evidence.map((e, j) => <li key={j} className="break-words rounded-lg bg-muted/40 p-2"><p className="font-medium">{INTAKE_FIELDS[e.field]} · {e.file} · {e.location}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">“{e.quote}”</p></li>)}</ul>
          </details>
          {saved[i] ? <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Đã lưu · <Link className="underline" href={saved[i]}>Mở hồ sơ</Link></p> : <Button size="sm" variant="outline" disabled={!allowed || loading !== null} loading={loading === i} onClick={() => void open(i)}>Kiểm tra và điền {p.kind === "project" ? "dự án" : "hợp đồng"}</Button>}
          {!allowed && <p className="text-xs text-muted-foreground">Bạn cần quyền {p.kind === "project" ? "tạo dự án" : "quản lý hợp đồng & chi phí"} để nhập thông tin này.</p>}
        </div>
      </section>;
    })}
    {active !== null && initial && <ProjectForm open onClose={() => setActive(null)} directory={directory} initial={initial} onSaved={id => {
      setSaved(v => ({ ...v, [active]: `/projects/${id}` })); setActive(null);
      // Fetch the saved name, since the person may have changed it in the form.
      void api<{ project: { id: string; name: string; color: string } }>(`/api/projects/${id}`).then(r => onProjectCreated(r.project)).catch(() => onProjectCreated({ id, name: initial.name, color: initial.color }));
    }} />}
    {active !== null && proposal?.kind === "contract" && <ContractForm open contract={null} defaultDate="" projects={projects} defaults={defaults} onClose={() => setActive(null)} onDelete={() => {}} onSaved={() => { setSaved(v => ({ ...v, [active]: "/contracts" })); setActive(null); }} />}
  </div>;
}
