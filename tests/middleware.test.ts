import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const env = process.env as Record<string, string | undefined>;

describe("Cloudflare Access middleware", () => {
  afterEach(() => {
    delete env.CF_ACCESS_TEAM_DOMAIN;
    delete env.CF_ACCESS_AUD;
  });

  it("does nothing when Access is not configured (local use)", async () => {
    const res = await middleware(new NextRequest("http://localhost:3000/api/clients"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects requests without an Access token when configured", async () => {
    env.CF_ACCESS_TEAM_DOMAIN = "example.cloudflareaccess.com";
    env.CF_ACCESS_AUD = "test-aud";
    const res = await middleware(new NextRequest("https://callcopilot.example.com/"));
    expect(res.status).toBe(401);
  });

  it("rejects a malformed Access token", async () => {
    env.CF_ACCESS_TEAM_DOMAIN = "example.cloudflareaccess.com";
    env.CF_ACCESS_AUD = "test-aud";
    const req = new NextRequest("https://callcopilot.example.com/", { headers: { "cf-access-jwt-assertion": "not-a-jwt" } });
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });
});
