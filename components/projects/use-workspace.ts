"use client";

import { useCallback, useRef } from "react";
import { api, useApi, type ChangeHint, type SendChange } from "@/lib/client";
import type { ProjectRoleKey } from "@/lib/permissions";
import type { ProjectDetailData } from "./types";

export interface WorkspaceData {
  project: ProjectDetailData;
  canManage: boolean;
  canContribute: boolean;
  canDelete: boolean;
  projectRole: ProjectRoleKey | null;
}

/** The change's expected effect on one task, so the list moves before the server answers. */
function applyHint(project: ProjectDetailData, { taskId, fields }: ChangeHint): ProjectDetailData {
  return {
    ...project,
    tasks: project.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const next = { ...t, ...fields } as typeof t;
      // Same rule as the server (lib/task-rules): DONE means 100%.
      if (fields.status === "DONE") {
        next.progress = 100;
        if (!t.subtaskCount) next.effectiveProgress = 100;
      }
      return next;
    }),
  };
}

const withWorkspace = (url: string) => `${url}${url.includes("?") ? "&" : "?"}include=workspace`;

/**
 * Project workspace data plus `send` for task changes. A change patches the
 * screen at once (when given a hint) and the server answers with the refreshed
 * project, so there is no second request. The newest answer wins; if answers
 * arrive out of order, or a change fails, the project is fetched again.
 */
export function useWorkspace(projectId: string, initial: WorkspaceData) {
  const ws = useApi<WorkspaceData>(`/api/projects/${projectId}`, { initial });
  const { setData, reload } = ws;
  const latest = useRef(ws.data);
  latest.current = ws.data;
  const seq = useRef(0);
  const inFlight = useRef(0);

  const send = useCallback<SendChange>(
    async <R,>(url: string, init: Parameters<SendChange>[1], hint?: ChangeHint) => {
      const before = latest.current;
      if (hint && before) setData({ ...before, project: applyHint(before.project, hint) });
      const id = ++seq.current;
      inFlight.current++;
      try {
        const res = await api<R & { workspace?: WorkspaceData | null }>(withWorkspace(url), init);
        inFlight.current--;
        if (id === seq.current && res.workspace) setData(res.workspace);
        else if (inFlight.current === 0) void reload();
        return res;
      } catch (e) {
        inFlight.current--;
        // Undo the optimistic patch if nothing newer was sent, then settle on the server's state.
        if (hint && before && id === seq.current) setData(before);
        if (inFlight.current === 0) void reload();
        throw e;
      }
    },
    [setData, reload],
  );

  return { ...ws, send };
}
