import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type SaasProvider = "airtable" | "google";
export const providerIds: SaasProvider[] = ["airtable", "google"];
export const stateCookie = (p: SaasProvider) => `crux_${p}_oauth_state`;
export const tokenCookie = (p: SaasProvider) => `crux_${p}_connection`;

const secrets = () => {
  const value = process.env.CRUX_SAAS_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("CRUX SaaS session encryption is not configured.");
  return createHash("sha256").update(value).digest();
};
export function seal(payload: unknown): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secrets(), nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function unseal<T>(value: string): T | null {
  try {
    const data = Buffer.from(value, "base64url");
    if (data.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", secrets(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString()) as T;
  } catch { return null; }
}
export const transientCookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
export const connectionCookie = { ...transientCookie, maxAge: 2700 };

export function oauthConfig(provider: SaasProvider) {
  const prefix = provider === "airtable" ? "AIRTABLE" : "GOOGLE";
  const clientId = process.env[`CRUX_${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`CRUX_${prefix}_CLIENT_SECRET`];
  const appUrl = process.env.CRUX_PUBLIC_ORIGIN;
  if (!clientId || !clientSecret || !appUrl || !/^https:\/\//.test(appUrl)) return null;
  const origin = new URL(appUrl).origin;
  return { clientId, clientSecret, redirectUri: `${origin}/api/saas/${provider}/callback`, origin };
}
export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function randomVerifier() { return randomBytes(32).toString("base64url"); }
export const safeReturn = (origin: string, provider: SaasProvider, status: string) =>
  new URL(`/author?saas=${provider}&saas_status=${encodeURIComponent(status)}#connect`, origin);
export function allowedOrigin(request: Request, expected: string) {
  return new URL(request.url).origin === expected;
}
