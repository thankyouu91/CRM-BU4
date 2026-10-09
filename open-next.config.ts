import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page in this app is dynamic (session-based), so no incremental cache
// binding is needed.
export default defineCloudflareConfig();
