// Polyfill crypto.randomUUID for non-secure contexts (e.g. accessing via local network IP over HTTP like http://192.168.0.10:5555)
if (typeof globalThis !== "undefined") {
  const gCrypto = globalThis.crypto || ((globalThis as any).crypto = {});
  if (typeof gCrypto.randomUUID !== "function") {
    gCrypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
      if (typeof gCrypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        gCrypto.getRandomValues(bytes);
        bytes[6] = (bytes[6]! & 0x0f) | 0x40; // RFC 4122 version 4
        bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant 1
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as any;
      }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as any;
    };
  }
}
