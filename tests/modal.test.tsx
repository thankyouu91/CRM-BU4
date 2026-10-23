// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { Drawer, Modal } from "../components/ui/modal";

afterEach(cleanup);

const dialogs: [string, (open: boolean) => ReactElement][] = [
  ["drawer", (open) => <main><Drawer open={open} onClose={() => {}}><p>Nội dung</p></Drawer></main>],
  ["modal", (open) => <main><Modal open={open} onClose={() => {}} title="Tiêu đề"><p>Nội dung</p></Modal></main>],
];

/** Render as the server does (it has no document), then hydrate that HTML in the browser. */
function hydrate(page: ReactElement) {
  vi.stubGlobal("document", undefined);
  let html: string;
  try {
    html = renderToString(page);
  } finally {
    vi.unstubAllGlobals();
  }
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors: unknown[] = [];
  const view = render(page, { container, hydrate: true, onRecoverableError: (e) => errors.push(e) });
  return { html, errors, view };
}

// Open on the first render, as the task drawer is on a /projects/<id>?task=<id> link.
it.each(dialogs)("hydrates a %s that is open on the first render, then shows it", (_, page) => {
  const { html, errors } = hydrate(page(true));
  expect(html).toBe("<main></main>");
  expect(errors).toEqual([]);
  expect(screen.getByRole("dialog").textContent).toContain("Nội dung");
});

it.each(dialogs)("opens a %s that was closed when the page hydrated", (_, page) => {
  const { errors, view } = hydrate(page(false));
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(page(true));
  expect(screen.getByRole("dialog").textContent).toContain("Nội dung");
  expect(errors).toEqual([]);
});
