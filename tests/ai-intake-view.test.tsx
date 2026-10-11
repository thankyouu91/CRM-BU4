// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { lazy, Suspense, type ComponentType } from "react";
import { validateIntake } from "../lib/ai-intake";
import { IntakeReview } from "../components/ai/intake-review";
import { ChatView } from "../app/(app)/ai/chat-view";

vi.mock("next/dynamic", () => ({ default: (load: () => Promise<ComponentType>) => {
  const C = lazy(async () => ({ default: await load() }));
  return (props: object) => <Suspense fallback={null}><C {...props} /></Suspense>;
} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("../components/deck/export-actions", () => ({ DeckActions: () => null }));
vi.mock("../components/projects/project-form", () => ({ ProjectFormModal: ({ initial, onSaved }: { initial: { name: string }; onSaved: (id: string) => void }) => <div role="dialog">Form: {initial.name}<button onClick={() => onSaved("saved")}>Lưu bản nháp đã sửa</button></div> }));
vi.mock("../components/contracts/contract-form", () => ({ ContractModal: ({ defaults }: { defaults: { code: string; value: number | null; projectId: string } }) => <div role="dialog">Code: {defaults.code}; value: {String(defaults.value)}; project: {defaults.projectId}</div> }));
const result = validateIntake({ summary: "Review file", proposals: [{ kind: "project", fields: { name: "Dự án từ file" }, evidence: [{ field: "name", file: "a.txt", location: "Dòng 1", quote: "Dự án từ file" }], warnings: [] }, { kind: "contract", fields: { code: "00123", projectName: "Đào tạo" }, evidence: [{ field: "code", file: "a.txt", location: "Dòng 2", quote: "00123" }, { field: "projectName", file: "a.txt", location: "Dòng 3", quote: "Đào tạo" }], warnings: [] }] }, ["a.txt"]);
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it("shows evidence and permission gates without writing records; only explicit form save consumes a proposal", async () => {
  const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => url === "/api/users" ? { users: [] } : { project: { id: "saved", name: "Tên đã sửa", color: "#000" } } })); vi.stubGlobal("fetch", fetch);
  const onCreated = vi.fn();
  const view = render(<IntakeReview result={result} projects={[]} canProject={false} canFinance={false} onProjectCreated={onCreated} />);
  expect((screen.getByRole("button", { name: "Kiểm tra và điền dự án" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetch).not.toHaveBeenCalled(); expect(screen.getByText(/Dòng 1/)).toBeTruthy();
  view.rerender(<IntakeReview result={result} projects={[]} canProject canFinance onProjectCreated={onCreated} />);
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và điền dự án" }));
  expect(await screen.findByRole("dialog")).toBeTruthy(); expect(fetch.mock.calls[0][0]).toBe("/api/users");
  expect(onCreated).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Lưu bản nháp đã sửa"));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "saved", name: "Tên đã sửa", color: "#000" }));
  expect(screen.queryByRole("button", { name: "Kiểm tra và điền dự án" })).toBeNull();
});
it("preserves contract codes and missing amounts and links only an unambiguous visible project", async () => {
  render(<IntakeReview result={result} projects={[{ id: "visible", name: "Đào tạo", color: "#000" }]} canProject canFinance onProjectCreated={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra và điền hợp đồng" }));
  expect(await screen.findByText("Code: 00123; value: null; project: visible")).toBeTruthy();
});
it("attaches files, extracts drafts and clears them in a new chat without storing base64 in session storage", async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ...result, remaining: 9 }) })); vi.stubGlobal("fetch", fetch);
  render(<ChatView userId="tester" userName="Người dùng" projects={[]} builtIn={{ ready: true, limit: 10, remaining: 10, modelLabel: "Test" }} canProject canFinance initialProjectId="" />);
  fireEvent.change(screen.getByLabelText("Chọn tài liệu cho AI"), { target: { files: [new File(["Dự án từ file"], "a.txt", { type: "text/plain" })] } });
  const extract = await screen.findByRole("button", { name: "Trích xuất để nhập liệu" });
  fireEvent.click(extract);
  await screen.findByText("Review file");
  expect(fetch).toHaveBeenCalledTimes(1);
  const request = (fetch.mock.calls as unknown as [string, RequestInit][])[0];
  expect(request[0]).toBe("/api/ai/intake");
  const data = JSON.parse(request[1].body as string); expect(data.attachments[0].name).toBe("a.txt");
  expect(sessionStorage.getItem("workhub.ai-chat.v1.tester")).not.toContain(data.attachments[0].data);
  fireEvent.click(screen.getByRole("button", { name: "Cuộc trò chuyện mới" }));
  expect(screen.queryByRole("button", { name: "Trích xuất để nhập liệu" })).toBeNull();
  expect(screen.queryByText("Review file")).toBeNull();
});
