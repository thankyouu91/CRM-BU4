// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useTaskMenu } from "../components/tasks/task-menu";

afterEach(cleanup);
const task = { id: "task", title: "Chuẩn bị báo cáo", status: "TODO" };
function View({ allowed = true, onOpen = vi.fn(), onToggle = vi.fn() }) {
  const menu = useTaskMenu({ onOpen, onToggle, canToggle: () => allowed });
  return <><div tabIndex={0} data-testid="row" {...menu.bind(task)}>{task.title}{menu.button(task)}</div>{menu.menu}</>;
}

it("opens by right click and only shows permitted mutations", () => {
  const onOpen = vi.fn();
  render(<View allowed={false} onOpen={onOpen} />);
  fireEvent.contextMenu(screen.getByTestId("row"), { clientX: 100, clientY: 100 });
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.queryByText("Đánh dấu hoàn thành")).toBeNull();
  fireEvent.click(screen.getByText("Mở chi tiết"));
  expect(onOpen).toHaveBeenCalledWith("task");
  expect(screen.queryByRole("menu")).toBeNull();
});

it("supports touch buttons, keyboard navigation, Escape and focus restoration", () => {
  const onToggle = vi.fn();
  render(<View onToggle={onToggle} />);
  const trigger = screen.getByRole("button", { name: /Tuỳ chọn/ });
  fireEvent.click(trigger);
  const items = screen.getAllByRole("menuitem");
  expect(document.activeElement).toBe(items[0]);
  fireEvent.keyDown(items[0], { key: "ArrowDown" });
  expect(document.activeElement).toBe(items[1]);
  fireEvent.click(items[1]);
  expect(onToggle).toHaveBeenCalledWith(task);
  expect(document.activeElement).toBe(trigger);
  fireEvent.keyDown(screen.getByTestId("row"), { key: "F10", shiftKey: true });
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByTestId("row"));
});

it("clamps the menu to the viewport and dismisses on outside interaction", () => {
  render(<View />);
  fireEvent.contextMenu(screen.getByTestId("row"), { clientX: 99999, clientY: 99999 });
  const menu = screen.getByRole("menu");
  expect(parseFloat(menu.style.left)).toBeLessThan(window.innerWidth);
  expect(parseFloat(menu.style.top)).toBeLessThan(window.innerHeight);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("menu")).toBeNull();
});
