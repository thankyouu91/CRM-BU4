if (process.platform !== "linux") {
  throw new Error("Build production releases on Linux. Deploy the CI artifact from other platforms; see docs/production-release.md.");
}
