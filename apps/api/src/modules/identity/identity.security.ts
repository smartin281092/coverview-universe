import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { IdentityErrorCode } from "@coverview/contracts";

export class IdentityError extends Error {
  constructor(
    readonly code: IdentityErrorCode,
    readonly statusCode: number,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "IdentityError";
  }
}

export function randomSecret() {
  return randomBytes(32).toString("base64url");
}
export function secretHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function csrfToken(secret: string, sessionToken: string) {
  return createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`csrf:${sessionToken}`)
    .digest("base64url");
}
export function matchesSecret(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function encryptVerifier(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(secret, "base64"), iv);
  cipher.setAAD(Buffer.from("coverview:pkce:v1"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function decryptVerifier(value: string, secret: string) {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(secret, "base64"),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from("coverview:pkce:v1"));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8");
}
