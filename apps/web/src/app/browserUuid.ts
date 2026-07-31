type BrowserCrypto = Pick<Crypto, "getRandomValues" | "randomUUID">;

const formatUuid = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * Generates a UUID in browsers that do not implement `crypto.randomUUID`.
 *
 * Some intranet browsers expose `crypto` over HTTP but omit randomUUID. Use
 * getRandomValues when available, with a non-cryptographic final fallback so
 * editing a dashboard never fails solely because of browser capability.
 */
export const createBrowserUuid = (browserCrypto: BrowserCrypto | undefined = globalThis.crypto): string => {
  if (typeof browserCrypto?.randomUUID === "function") return browserCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof browserCrypto?.getRandomValues === "function") {
    browserCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return formatUuid(bytes);
};
