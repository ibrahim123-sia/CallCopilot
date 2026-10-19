import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default OpenNext config. Every page in CallCopilot is dynamic (data comes from the API),
// so no incremental cache (R2/KV) is needed.
export default defineCloudflareConfig();
