// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HoursHeatmap } from "../components/reports/hours-heatmap";
import type { Summary } from "../lib/stats";

afterEach(cleanup);
const person = (name: string, hoursByBucket: number[]): Summary["people"][number] => ({
  userId: name, name, avatarColor: "#123456", jobTitle: null, assigned: 0, done: 0, inProgress: 0, overdue: 0, remaining: 0,
  reports: 1, hours: hoursByBucket.reduce((a, b) => a + b, 0), hoursByBucket,
});
const trend = ["12/10", "13/10", "14/10"].map((label) => ({ label, created: 0, completed: 0, projects: 0, reports: 0, hours: 0 }));

it("lists people by hours with a cell per time slot", () => {
  render(<HoursHeatmap people={[person("Quỳnh", [1, 0, 0]), person("Long", [4, 0, 2.5]), person("An", [0, 0, 0])]} trend={trend} />);
  const rows = screen.getAllByRole("row").slice(1).map((r) => r.querySelector("th")!.textContent);
  expect(rows).toEqual(["LLong", "QQuỳnh"]); // most hours first, nobody with none
  expect(screen.getByTitle("Long · 14/10: 2,5 giờ").className).toContain("bg-primary");
  expect(screen.getByTitle("Long · 13/10: 0 giờ").className).toContain("bg-muted");
  expect(screen.getByText("6,5h")).toBeTruthy();
});

it("says so when nobody reported hours", () => {
  render(<HoursHeatmap people={[person("An", [0, 0, 0])]} trend={trend} />);
  expect(screen.getByText("Chưa có giờ công nào được báo cáo trong kỳ này.")).toBeTruthy();
});
