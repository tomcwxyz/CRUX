import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createGithubAppJwt,
  decodeGithubConnection,
  encodeGithubConnection,
} from "../lib/github-app";

describe("GitHub App connection helpers", () => {
  it("round-trips a signed installation connection and rejects tampering", () => {
    const secret = "test-secret";
    const encoded = encodeGithubConnection({
      version: 1,
      installation_ids: [12, 34, 12],
      expires_at: 2_000,
    }, secret);

    expect(decodeGithubConnection(encoded, secret, 1_000)).toEqual({
      version: 1,
      installation_ids: [12, 34],
      expires_at: 2_000,
    });
    expect(decodeGithubConnection(encoded + "x", secret, 1_000)).toBeNull();
    expect(decodeGithubConnection(encoded, secret, 3_000)).toBeNull();
  });

  it("creates an RS256 app JWT with the app id as issuer", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = createGithubAppJwt({
      appId: "12345",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      nowSeconds: 1_700_000_000,
    });
    const [, payload] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")) as {
      iss: string;
      iat: number;
      exp: number;
    };
    expect(decoded.iss).toBe("12345");
    expect(decoded.iat).toBe(1_699_999_940);
    expect(decoded.exp).toBe(1_700_000_540);
  });
});
