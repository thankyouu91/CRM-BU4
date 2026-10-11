# Reliability changes

This change keeps the existing task completion policy and adds no database migration of its own. It is integrated with the upstream R2, backup and audit-log change, whose audit-log migration still applies.

- Task edits, progress reports and manager approvals use a shared compare-and-swap service. A stale snapshot returns HTTP 409 and dependent database writes roll back. Metadata-only edits do not write task state.
- Report drafts remain dirty until submission succeeds. Failed sends retain notes for retry or save-on-leave; newer edits made during submission are saved afterwards.
- Weekly reports and task details use progress computed from the full task tree. Pure progress calculations live separately from database queries.
- Task lists and report inboxes expose 100-row cursor pages. Search runs on the server and task KPI counts cover the matching dataset, not just the visible page. Inbox bulk review explicitly acts on the current page.
- Uploads reserve metadata and quota under a PostgreSQL transaction-scoped advisory lock before writing files. Limits follow the storage backend (Postgres or R2). A failed batch cleans up its files and reservations. A process crash after reservation can leave metadata requiring reconciliation; the quota remains conservatively reserved.

## Verification

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run cf:build` are the primary checks. CI also audits production dependencies and performs a Worker dry-run bundle without deploying.

`tests/database.integration.test.ts` requires `TEST_DATABASE_URL` pointing to a local PostgreSQL database with a name ending in `_test`; otherwise those tests are skipped. Apply Prisma migrations to that disposable database first. CI provisions PostgreSQL and runs these tests automatically. Never set this variable to a production database.

The integration tests exercise actual stale-update rollback and concurrent file reservation; unit and hook tests cover failure recovery, progress, pagination and upload validation. They supplement the upstream test suite.
