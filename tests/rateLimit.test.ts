import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitForTests } from "@/lib/rateLimit";

describe("In-Memory Sliding Window Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimitForTests();
  });

  it("permits requests within configured rate limit threshold", () => {
    const ip = "192.168.1.100";
    const limit = 5;

    for (let i = 0; i < limit; i++) {
      const res = checkRateLimit(ip, limit);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - (i + 1));
    }

    // Next request exceeds limit
    const exceeded = checkRateLimit(ip, limit);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.remaining).toBe(0);
    expect(exceeded.resetMs).toBeGreaterThan(0);
  });

  it("isolates rate limits between distinct IP addresses", () => {
    const ip1 = "10.0.0.1";
    const ip2 = "10.0.0.2";
    const limit = 2;

    checkRateLimit(ip1, limit);
    checkRateLimit(ip1, limit);
    expect(checkRateLimit(ip1, limit).allowed).toBe(false);

    // ip2 should still be allowed
    expect(checkRateLimit(ip2, limit).allowed).toBe(true);
  });
});
