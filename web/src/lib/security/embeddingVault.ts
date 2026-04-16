import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Server-side AES-256-GCM helpers for face *embeddings* (vectors), not raw images.
 * Store only ciphertext + iv + authTag in MongoDB; keep FACE_VAULT_KEY out of the client.
 * Rotate keys via a wrapping key in your KMS in production.
 */

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LEN);
}

export function sealEmbedding(plainUtf8: string, secret: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plainUtf8, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, enc]).toString("base64url");
}

export function openEmbedding(sealedBase64: string, secret: string): string {
  const buf = Buffer.from(sealedBase64, "base64url");
  const salt = buf.subarray(0, SALT_LEN);
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + 16);
  const data = buf.subarray(SALT_LEN + IV_LEN + 16);
  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
