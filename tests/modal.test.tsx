// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Drawer, Modal } from "../components/ui/modal";

afterEach(cleanup);

// Open on the first render, as the task drawer is on a /projects/<id>?task=<id> link.
it.each([
  ["drawer", <Drawer key="drawer" open onClose={() => {}}><p>Nội dung</p></Drawer>],
  ["modal", <Modal key="modal" open onClose={() => {}} title="Tiêu đề"><p>Nội dung</p></Modal>],
])("hydrates a %s that is open on the first render, then shows it", (_, dialog) => {
  const page = <main>{dialog}</main>;
  const container = document.createElement("div");
  container.innerHTML = renderToString(page);
  // The server has no document to portal into: nothing until the client takes over.
  expect(container.innerHTML).toBe("<main></main>");
  document.body.appendChild(container);
  const errors: unknown[] = [];
  render(page, { container, hydrate: true, onRecoverableError: (e) => errors.push(e) });
  expect(errors).toEqual([]);
  expect(screen.getByRole("dialog")).toHaveProperty("textContent", expect.stringContaining("Nội dung"));
});
