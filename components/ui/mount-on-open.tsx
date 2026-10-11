"use client";
import { useState, type ReactNode } from "react";

/** Defer hidden dialogs until first use; retain them afterwards for exit animations. */
export function MountOnOpen({ open, children }: { open: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open ? children : null;
}
