import { afterEach, describe, expect, it, vi } from "vitest";

import { clearedSessionCookie, sessionCookie } from "./session-cookie.js";

describe("session cookies", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses Secure by default in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(sessionCookie("token", new Date("2026-08-01T00:00:00.000Z"))).toContain("; Secure");
    expect(clearedSessionCookie()).toContain("; Secure");
  });

  it("allows a trusted intranet HTTP deployment to explicitly disable Secure", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "false");

    expect(sessionCookie("token", new Date("2026-08-01T00:00:00.000Z"))).not.toContain("; Secure");
    expect(clearedSessionCookie()).not.toContain("; Secure");
  });

  it("allows Secure to be explicitly enabled outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("COOKIE_SECURE", "true");

    expect(sessionCookie("token", new Date("2026-08-01T00:00:00.000Z"))).toContain("; Secure");
  });
});
