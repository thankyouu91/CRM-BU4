// Encrypt small secrets (e.g. the Claude API key) before they are stored in the
// database. AES-256-GCM via Web Crypto, so it runs the same in Node and Workers.
// The key is derived (HKDF) from SETTINGS_SECRET, or JWT_SECRET when that is not
// set: rotating that secret makes stored values unreadable, and the admin then
// enters them again.
//
// Format: "v1.<iv base64url>.<ciphertext+tag base64url>"

const VERSION = "v1";
const INFO = "workhub-settings-v1";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** The server secret the encryption key is derived from. */
export function settingsSecret(): string {
  const secret = process.env.SETTINGS_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("SETTINGS_SECRET or JWT_SECRET must be set to at least 32 characters.");
  return secret;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(INFO), info: enc.encode(INFO) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealSecret(plaintext: string, secret = settingsSecret()): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)));
  return `${VERSION}.${b64url(iv)}.${b64url(cipher)}`;
}

/** The plaintext, or null when the value is malformed, tampered with, or sealed with another secret. */
export async function openSecret(sealed: string, secret = settingsSecret()): Promise<string | null> {
  const [version, iv, cipher] = sealed.split(".");
  if (version !== VERSION || !iv || !cipher) return null;
  try {
    const key = await deriveKey(secret);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, key, fromB64url(cipher));
    return dec.decode(plain);
  } catch {
    return null;
  }
}
