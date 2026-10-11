import { performance } from "node:perf_hooks";
import { effectiveProgress, indexChildren, progressIndex, type ProgressNode } from "../lib/task-progress";
import { groupBy } from "../lib/task-tree";

function medianMs(run: () => unknown) {
  for (let i = 0; i < 3; i++) run();
  const samples = Array.from({ length: 15 }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return Number(samples[7].toFixed(3));
}

function progressCase(name: string, tasks: ProgressNode[]) {
  const children = indexChildren(tasks);
  const previous = () => tasks.map((task) => effectiveProgress(task, children));
  const current = () => progressIndex(tasks, children);
  const values = current();
  if (previous().some((value, i) => Math.abs(value - values.get(tasks[i].id)!) > 1e-8)) throw new Error("Progress changed");
  return { name, nodes: tasks.length, beforeMs: medianMs(previous), afterMs: medianMs(current) };
}

const node = (i: number, parentId: string | null): ProgressNode => ({ id: String(i), parentId, status: "IN_PROGRESS", progress: i % 101 });
const tasks = Array.from({ length: 10000 }, (_, i) => ({ category: i % 1000 }));
console.log(JSON.stringify({
  runtime: process.version,
  method: "Synthetic fixtures; median of 15 runs after 3 warmups. CPU only, not production page latency.",
  progress: [
    progressCase("balanced", Array.from({ length: 10000 }, (_, i) => node(i, i ? String(Math.floor((i - 1) / 4)) : null))),
    progressCase("deep", Array.from({ length: 1500 }, (_, i) => node(i, i ? String(i - 1) : null))),
  ],
  categories: {
    tasks: tasks.length, categories: 1000,
    beforeMs: medianMs(() => Array.from({ length: 1000 }, (_, id) => tasks.filter((task) => task.category === id))),
    afterMs: medianMs(() => groupBy(tasks, (task) => task.category)),
  },
}, null, 2));
