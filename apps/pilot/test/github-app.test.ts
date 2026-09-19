import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createGithubAppJwt,
  decodeGithubConnection,
  encodeGithubConnection,
  githubConnectionAllowsRepository,
} from "../lib/github-app";

describe("GitHub App connection helpers", () => {
  it("round-trips a signed repo-scoped installation connection and rejects tampering", () => {
    const secret = "test-secret";
    const encoded = encodeGithubConnection({
      version: 1,
      installations: [
        { id: 12, repository_ids: [101, 102, 101] },
        { id: 34, repository_ids: [201] },
      ],
      expires_at: 2_000,
    }, secret);

    const decoded = decodeGithubConnection(encoded, secret, 1_000);
    expect(decoded).toEqual({
      version: 1,
      installations: [
        { id: 12, repository_ids: [101, 102] },
        { id: 34, repository_ids: [201] },
      ],
      expires_at: 2_000,
    });
    expect(decoded && githubConnectionAllowsRepository(decoded, 12, 102)).toBe(true);
    expect(decoded && githubConnectionAllowsRepository(decoded, 12, 201)).toBe(false);
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
