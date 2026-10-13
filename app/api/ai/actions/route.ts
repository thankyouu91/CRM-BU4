import { NextRequest } from "next/server";
import { z } from "zod";
import { auth, handle, ok, unauthorized } from "@/lib/api";
import { auditVia } from "@/lib/audit";
import { actionRequest, ToolError, type ActionRequest } from "@/lib/ai-agent";
import { APPLY_BATCH, WRITE_TOOLS, type AgentActionResult, type WriteTool } from "@/lib/ai-actions";
import { POST as createProject } from "@/app/api/projects/route";
import { PATCH as updateProject } from "@/app/api/projects/[id]/route";
import { POST as createCategory } from "@/app/api/projects/[id]/categories/route";
import { PATCH as updateCategory } from "@/app/api/categories/[id]/route";
import { POST as createTask } from "@/app/api/tasks/route";
import { PATCH as updateTask } from "@/app/api/tasks/[id]/route";
import { POST as createContract } from "@/app/api/contracts/route";
import { PATCH as updateContract } from "@/app/api/contracts/[id]/route";
import { POST as createNote } from "@/app/api/projects/[id]/notes/route";

type Ctx = { params: Promise<{ id: string }> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<Response>;

// The same handlers the screens call: permissions, validation and audit entries are theirs.
const ROUTES: Record<ActionRequest["route"], { handler: Handler; path: (id?: string) => string }> = {
  projects: { handler: createProject as unknown as Handler, path: () => "/api/projects" },
  project: { handler: updateProject, path: (id) => `/api/projects/${id}` },
  projectCategories: { handler: createCategory, path: (id) => `/api/projects/${id}/categories` },
  category: { handler: updateCategory, path: (id) => `/api/categories/${id}` },
  tasks: { handler: createTask as unknown as Handler, path: () => "/api/tasks" },
  task: { handler: updateTask, path: (id) => `/api/tasks/${id}` },
  contracts: { handler: createContract as unknown as Handler, path: () => "/api/contracts" },
  contract: { handler: updateContract, path: (id) => `/api/contracts/${id}` },
  projectNotes: { handler: createNote, path: (id) => `/api/projects/${id}/notes` },
};

const DONE: Record<WriteTool, string> = {
  create_project: "Đã tạo dự án",
  update_project: "Đã cập nhật dự án",
  create_category: "Đã thêm hạng mục",
  update_category: "Đã cập nhật hạng mục",
  create_task: "Đã thêm công việc",
  update_task: "Đã cập nhật công việc",
  create_contract: "Đã tạo hợp đồng",
  update_contract: "Đã cập nhật hợp đồng",
  add_note: "Đã thêm ghi chú",
};

const REF = /^ref:([A-Za-z0-9_-]{1,40})$/;

const schema = z.object({
  actions: z
    .array(z.object({ id: z.string().min(1).max(100), tool: z.enum(WRITE_TOOLS), input: z.record(z.string(), z.unknown()) }))
    .min(1, "Chưa chọn thay đổi nào")
    .max(APPLY_BATCH, `Mỗi lần áp dụng tối đa ${APPLY_BATCH} thay đổi`),
  /** Items created by earlier batches of the same answer: ref name → id. */
  refs: z.record(z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), z.string().min(1).max(100)).optional(),
});

/**
 * POST /api/ai/actions { actions: [{ id, tool, input }], refs? }
 * Applies changes the AI chat proposed and the person approved, in order, each through
 * the normal API route with the person's own permissions. A later action can use
 * "ref:<name>" for an item an earlier one created. Each result says what happened;
 * a failed action does not undo the ones before it. Larger sets come in batches: each
 * answer returns `refs` (all names known so far), sent back with the next batch. A ref
 * only stands for an id; every action still goes through the route's own checks.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    const { actions, refs } = schema.parse(await req.json());

    const created = new Map<string, string>(Object.entries(refs ?? {}));
    const results: AgentActionResult[] = [];
    await auditVia.run({ via: "ai" }, async () => {
      for (const action of actions) {
        try {
          const request = actionRequest(action.tool, action.input, (value) => {
            const name = REF.exec(value)?.[1] ?? value;
            const found = created.get(name);
            if (!found) throw new ToolError(`Cần mục “${name}” được tạo trước (đề xuất đó chưa được chọn hoặc bị lỗi).`);
            return found;
          });
          const route = ROUTES[request.route];
          const res = await route.handler(
            new NextRequest(new URL(route.path(request.id), req.url), {
              method: request.method,
              headers: { "content-type": "application/json" },
              body: JSON.stringify(request.body),
            }),
            { params: Promise.resolve({ id: request.id ?? "" }) },
          );
          const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          if (!res.ok) {
            const fields = json.fields && typeof json.fields === "object" ? Object.values(json.fields as Record<string, string>) : [];
            results.push({ id: action.id, ok: false, message: [String(json.error ?? `Lỗi ${res.status}`), ...fields].join(": ") });
            continue;
          }
          const entity = (json.project ?? json.category ?? json.task ?? json.contract ?? json.note ?? null) as Record<string, unknown> | null;
          const entityId = (entity?.id as string | undefined) ?? request.id;
          const name = (entity?.name ?? entity?.title ?? action.input.name ?? action.input.title ?? "") as string;
          const ref = typeof action.input.ref === "string" ? action.input.ref : null;
          if (ref && entityId) created.set(ref, entityId);
          const projectId = (entity?.projectId as string | undefined) ?? (request.route === "projects" || request.route === "project" ? entityId : undefined) ?? (request.route === "projectNotes" ? request.id : undefined);
          results.push({
            id: action.id,
            ok: true,
            message: `${DONE[action.tool]}${name ? ` “${name}”` : ""}`,
            entityId,
            link: action.tool.endsWith("contract") ? "/contracts" : projectId ? `/projects/${projectId}` : undefined,
          });
        } catch (err) {
          if (err instanceof ToolError) results.push({ id: action.id, ok: false, message: err.message });
          else {
            console.error("[ai] apply failed", action.tool, err);
            results.push({ id: action.id, ok: false, message: "Không thực hiện được thay đổi này." });
          }
        }
      }
    });
    return ok({ results, refs: Object.fromEntries(created) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
