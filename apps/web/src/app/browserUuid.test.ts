import { describe, expect, it } from "vitest";

import { createBrowserUuid } from "./browserUuid.js";

describe("createBrowserUuid", () => {
  it("uses randomUUID when the browser provides it", () => {
    const browserCrypto = {
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    } as unknown as Crypto;

    expect(createBrowserUuid(browserCrypto)).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("creates a version 4 UUID when only getRandomValues is available", () => {
    const browserCrypto = {
      getRandomValues: (values: Uint8Array) => {
        values.fill(0xab);
        return values;
      },
    } as unknown as Crypto;
    const id = createBrowserUuid(browserCrypto);

    expect(id).toBe("abababab-abab-4bab-abab-abababababab");
  });

  it("falls back when the browser exposes no crypto API", () => {
    expect(createBrowserUuid(undefined)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
