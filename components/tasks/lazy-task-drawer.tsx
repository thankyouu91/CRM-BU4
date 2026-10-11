"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TaskDrawer as FullTaskDrawer } from "./task-drawer";
import { MountOnOpen } from "@/components/ui/mount-on-open";

const DeferredDrawer = dynamic(() => import("./task-drawer").then((m) => m.TaskDrawer), {
  loading: () => <span role="status" className="fixed bottom-4 right-4 z-50 rounded-lg border bg-card px-4 py-2 shadow-pop">Đang mở công việc…</span>,
});

/** Load on first open, then retain the instance so its exit animation still runs. */
export function TaskDrawer(props: ComponentProps<typeof FullTaskDrawer>) {
  return <MountOnOpen open={!!props.taskId}><DeferredDrawer {...props} /></MountOnOpen>;
}
