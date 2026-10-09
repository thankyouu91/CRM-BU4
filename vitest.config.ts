import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure logic (permissions, finance, schedules, file checks).
// They import no database or Workers code, so they run in plain Node.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Dates in the app are shown in Vietnam time; pin it so results do not depend on the machine.
    env: { TZ: "Asia/Ho_Chi_Minh" },
  },
});
