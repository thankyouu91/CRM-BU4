# Production release

Build release artifacts on Linux. OpenNext's Prisma patches are platform-sensitive: a Windows build can pass compilation and a Wrangler dry-run but fail on workerd because it tries to load the Windows native query engine. `npm run deploy` rejects non-Linux builds for this reason. See [OpenNext Windows support](https://opennext.js.org/cloudflare) and [Prisma integration](https://opennext.js.org/cloudflare/howtos/db).

CI on Linux builds and bundles the Worker, packages `.release/worker-release.tar.gz`, then starts that exact bundle in local workerd. An isolated PostgreSQL test database is used to verify real login/session handling, authenticated project/task rendering and all three deadline APIs. Only successful runs upload the artifact. The test rejects non-local databases and cleans up its fixtures.

Download the successful run's `cloudflare-worker-*` artifact, extract the ZIP and its tarball into a fresh release directory, and check `release.json`: source head, Git tree and Worker SHA-256. The deployed source tree must match the tree that CI verified. Do not rebuild OpenNext on the deploying machine.

Before deploying, use `wrangler deployments list --name crm` and `wrangler versions view <version> --name crm` to record the active version and bindings. Preserve existing secrets and variables (`--keep-vars`). The current production account has Hyperdrive and rate-limit bindings but no R2 bindings; remove the two R2 entries from the extracted deployment config when targeting that existing setup. Do not provision storage or change database credentials as part of an application release.

Deploy the extracted `wrangler.json` with `wrangler deploy --config <release>/wrangler.json --keep-vars --autoconfig=false --tag <commit>`. Its `no_bundle` configuration keeps the tested Linux JavaScript/WASM intact, including additional WASM modules and static assets. Verify the production project calendar and each task deadline filter in an authenticated browser. If the smoke check fails, immediately restore the recorded version with `wrangler rollback <version> --name crm --yes` before investigating.
