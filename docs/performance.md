# Task performance and quick actions

The existing Next.js/server-query structure remains suitable. This change extracts repeated tree/grouping logic, computes task progress once per node, defers secondary UI, and adds one shared task menu per view. It does not introduce another state or UI framework.

## Measured results

Local production builds on Node 24.13.0, with the same dependency set and upstream AI changes on both sides. Baseline: before lazy loading and the new menu. These are Next.js First Load JS estimates, not measured browser loading times.

| Route | Before | After |
| --- | ---: | ---: |
| `/tasks` | 203 kB | 187 kB |
| `/inbox` | 196 kB | 188 kB |
| `/projects/[id]` | 195 kB | 191 kB |

Task details load on first open; the weekly/monthly report loads when selected. Project dialogs and secondary panels no longer download automatically after an idle timeout. Dialogs remain mounted after first use to preserve close animations.

`npx tsx scripts/benchmark-tasks.ts` measures synthetic CPU fixtures (median of 15 runs after 3 warmups):

| Calculation | Before | After |
| --- | ---: | ---: |
| Progress for all nodes in a balanced 10,000-task tree | 3.902 ms | 2.257 ms |
| Progress for all nodes in a 1,500-level tree | 66.134 ms | 0.254 ms |
| Group 10,000 tasks into 1,000 categories | 60.273 ms | 0.399 ms |

The deep fixture demonstrates the previous quadratic worst case; it is not a typical-project speed claim. Tests also cover 20,000 levels without recursion in the indexing algorithms. Malformed progress cycles retain the previous fallback semantics.

## Queries, grouping and navigation

- Task listing uses four top-level Prisma operations instead of six: page, grouped status counts, overdue count and recently completed count. Relation loading can issue additional SQL; this is not a SQL round-trip measurement.
- All counts retain visibility, scope, search and status filters. Task action permissions derive from the existing server RBAC functions. Project membership fields used to calculate rights are excluded from the response.
- Search waits 300 ms after typing; superseded/unmounted requests are aborted. Late responses cannot overwrite active data or cache entries. Cancellation does not guarantee that an already-running database query stops.
- A shared tree index preserves server ordering and retains matching descendants' ancestors. Orphaned tasks remain visible as roots. Category/status grouping uses append operations instead of repeated array copies/scans.
- The existing cursor order (deadline, creation time, ID) remains stable. Deadline buckets and completed-date sorting are within the current 100-row page, not a global regrouping of every page.

## Task menu

Available on project task rows, Kanban cards and My Tasks: right click, the ellipsis button, or Shift+F10/ContextMenu. Actions open task details, mark complete/reopen when permitted, and copy the title. Existing backend authorization and completion policy still apply. No destructive action was added.

One portal/listener set is mounted only while a menu is open. Arrow keys and Home/End navigate; Escape closes and restores focus. Position is clamped to the viewport; outside interaction, scrolling and resizing dismiss the menu. Ellipsis buttons support touch devices.

## Validation and limits

Regression coverage includes progress equivalence, cycles, deep trees, filter ancestry, stable grouping, request cancellation, search debounce, menu permissions/keyboard handling and PostgreSQL aggregation. CI provisions an isolated database for integration tests. Local tests skip those tests when `TEST_DATABASE_URL` is absent.

No production deployment or live latency measurement is included. Full project workspaces still load their complete task tree; exceptionally large projects should be profiled with real data before adding server pagination or row virtualization. Existing OpenNext generated-bundle warnings remain.
