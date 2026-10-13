// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { lazy, Suspense, type ComponentType } from "react";
import type { ProjectListItemData } from "../components/projects/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: (load: () => Promise<ComponentType>) => {
  const C = lazy(async () => ({ default: await load() }));
  return (props: object) => <Suspense fallback={null}><C {...props} /></Suspense>;
} }));
import { ProjectFromTemplateModal } from "../components/projects/project-from-template-modal";
import { SaveTemplateModal } from "../components/projects/save-template-modal";
import { ProjectsView } from "../app/(app)/projects/projects-view";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockReset(); });
const templates = [
  { id: "tpl1", name: "Khảo thí tiếng Anh ACB", description: "Ba đợt thi", categories: 12, tasks: 48, createdBy: { id: "me", name: "Nguyễn An" }, updatedAt: "2026-10-12T03:00:00Z", canDelete: true },
  { id: "tpl2", name: "Đào tạo PCCC cho UEH", description: null, categories: 3, tasks: 9, createdBy: { id: "x", name: "Lê Cường" }, updatedAt: "2026-10-01T03:00:00Z", canDelete: false },
];
type Call = [string, RequestInit | undefined];
const stubFetch = (list = templates) => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/project-templates") return { ok: true, status: 200, json: async () => ({ templates: list }) };
    if (url === "/api/projects/from-template") return { ok: true, status: 201, json: async () => ({ project: { id: "new1", name: JSON.parse(String(init?.body)).name } }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
};
const calls = (fetch: ReturnType<typeof stubFetch>) => fetch.mock.calls as unknown as Call[];

it("picks a template, previews the counts and start day, then creates the project", async () => {
  const fetch = stubFetch();
  const onCreated = vi.fn();
  render(<ProjectFromTemplateModal open onClose={() => {}} onCreated={onCreated} />);
  const create = screen.getByRole("button", { name: "Tạo dự án" }) as HTMLButtonElement;
  fireEvent.click(await screen.findByRole("radio", { name: /Khảo thí tiếng Anh ACB/ }));
  // The template's name is suggested until the person types their own.
  const name = screen.getByLabelText("Tên dự án") as HTMLInputElement;
  expect(name.value).toBe("Khảo thí tiếng Anh ACB");
  fireEvent.change(name, { target: { value: "Khảo thí ACB đợt 2" } });
  fireEvent.click(screen.getByRole("radio", { name: /Đào tạo PCCC/ }));
  expect(name.value).toBe("Khảo thí ACB đợt 2");
  fireEvent.click(screen.getByRole("radio", { name: /Khảo thí tiếng Anh ACB/ }));
  fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-10-20" } });
  expect(screen.getByRole("status").textContent).toBe("12 hạng mục, 48 công việc; ngày tính lại từ 20/10/2026");
  expect(screen.getByText(/12 hạng mục, 48 công việc · Nguyễn An/)).toBeTruthy();
  // Only the creator (or an admin) gets a delete button.
  expect(screen.queryByRole("button", { name: "Xoá mẫu Đào tạo PCCC cho UEH" })).toBeNull();

  expect(create.disabled).toBe(false);
  fireEvent.click(create);
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith("new1"));
  const [url, init] = calls(fetch).find(([u]) => u === "/api/projects/from-template")!;
  expect(url).toBe("/api/projects/from-template");
  expect(JSON.parse(String(init?.body))).toEqual({ templateId: "tpl1", name: "Khảo thí ACB đợt 2", startDate: "2026-10-20" });
});

it("explains how to make a template when there is none", async () => {
  stubFetch([]);
  render(<ProjectFromTemplateModal open onClose={() => {}} onCreated={() => {}} />);
  expect(await screen.findByText("Chưa có mẫu dự án nào")).toBeTruthy();
  expect(screen.getByText(/Mở một dự án → Lưu làm mẫu/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Tạo dự án" }) as HTMLButtonElement).disabled).toBe(true);
});

it("deletes a template after confirmation", async () => {
  const fetch = stubFetch();
  render(<ProjectFromTemplateModal open onClose={() => {}} onCreated={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Xoá mẫu Khảo thí tiếng Anh ACB" }));
  const dialog = screen.getAllByRole("dialog").at(-1)!;
  expect(within(dialog).getByText(/không bị ảnh hưởng/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Xoá mẫu" }));
  await waitFor(() => expect(screen.queryByRole("radio", { name: /Khảo thí tiếng Anh ACB/ })).toBeNull());
  expect(calls(fetch).some(([u, i]) => u === "/api/project-templates/tpl1" && i?.method === "DELETE")).toBe(true);
  expect(screen.getByRole("radio", { name: /Đào tạo PCCC/ })).toBeTruthy();
});

it("saves the open project as a template with its name prefilled", async () => {
  const fetch = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ template: { id: "tpl9", name: "Mẫu PCCC" } }) }));
  vi.stubGlobal("fetch", fetch);
  const onClose = vi.fn();
  render(<SaveTemplateModal open onClose={onClose} project={{ id: "p1", name: "Đào tạo PCCC cho UEH", categories: 3, tasks: 9 }} />);
  const name = screen.getByLabelText("Tên mẫu") as HTMLInputElement;
  expect(name.value).toBe("Đào tạo PCCC cho UEH");
  expect(screen.getByText(/Không lưu người phụ trách/)).toBeTruthy();
  fireEvent.change(name, { target: { value: "Mẫu PCCC" } });
  fireEvent.change(screen.getByLabelText("Mô tả (tuỳ chọn)"), { target: { value: "  Hai buổi  " } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu mẫu" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  const [url, init] = (fetch.mock.calls as unknown as Call[])[0];
  expect(url).toBe("/api/project-templates");
  expect(JSON.parse(String(init?.body))).toEqual({ projectId: "p1", name: "Mẫu PCCC", description: "Hai buổi" });
});

it("blocks saving a project past the limits", () => {
  render(<SaveTemplateModal open onClose={() => {}} project={{ id: "p1", name: "Lớn", categories: 3, tasks: 501 }} />);
  expect(screen.getByText("Dự án có 501 công việc; một mẫu chứa tối đa 500.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Lưu mẫu" }) as HTMLButtonElement).disabled).toBe(true);
});

it("offers “Tạo từ mẫu” next to “Tạo dự án” and opens the new project", async () => {
  stubFetch();
  const props = { initial: [] as ProjectListItemData[], directory: [], canFinance: false, initialView: "month" as const, initialAnchor: "2026-10-01", now: "2026-10-11T00:00:00Z" };
  const view = render(<ProjectsView {...props} canCreate={false} />);
  expect(screen.queryByRole("button", { name: "Tạo từ mẫu" })).toBeNull();
  view.rerender(<ProjectsView {...props} canCreate />);
  fireEvent.click(screen.getByRole("button", { name: "Tạo từ mẫu" }));
  fireEvent.click(await screen.findByRole("radio", { name: /Đào tạo PCCC/ }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tạo dự án" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/new1"));
});
