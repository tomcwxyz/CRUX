import {
  createHmac,
  createSign,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const GITHUB_API_VERSION = "2026-03-10";
export const GITHUB_CONNECTION_COOKIE = "crux_github_installations";
export const GITHUB_OAUTH_STATE_COOKIE = "crux_github_oauth_state";

export type GithubConnection = {
  version: 1;
  installation_ids: number[];
  expires_at: number;
};

export type GithubRepository = {
  installation_id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  permissions?: {
    pull?: boolean;
    push?: boolean;
    admin?: boolean;
    maintain?: boolean;
    triage?: boolean;
  };
};

type GithubAppConfig = {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  slug: string;
  connectionSecret: string;
};

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`GitHub App connection is not configured: ${name} is missing.`);
  return value;
};

export const githubAppConfigured = () =>
  Boolean(
    process.env.GITHUB_APP_ID &&
    process.env.GITHUB_APP_CLIENT_ID &&
    process.env.GITHUB_APP_CLIENT_SECRET &&
    process.env.GITHUB_APP_PRIVATE_KEY &&
    process.env.GITHUB_APP_SLUG &&
    process.env.GITHUB_CONNECTION_SECRET,
  );

export const getGithubAppConfig = (): GithubAppConfig => ({
  appId: requireEnv("GITHUB_APP_ID"),
  clientId: requireEnv("GITHUB_APP_CLIENT_ID"),
  clientSecret: requireEnv("GITHUB_APP_CLIENT_SECRET"),
  privateKey: requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
  slug: requireEnv("GITHUB_APP_SLUG"),
  connectionSecret: requireEnv("GITHUB_CONNECTION_SECRET"),
});

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

const signValue = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

export const encodeGithubConnection = (
  connection: GithubConnection,
  secret: string,
) => {
  const body = b64url(JSON.stringify(connection));
  return `${body}.${signValue(body, secret)}`;
};

export const decodeGithubConnection = (
  value: string | undefined,
  secret: string,
  now = Date.now(),
): GithubConnection | null => {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(signValue(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<GithubConnection>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.installation_ids) ||
      !parsed.installation_ids.every((id) => Number.isSafeInteger(id) && id > 0) ||
      typeof parsed.expires_at !== "number" ||
      parsed.expires_at <= now
    ) {
      return null;
    }
    return {
      version: 1,
      installation_ids: [...new Set(parsed.installation_ids)],
      expires_at: parsed.expires_at,
    };
  } catch {
    return null;
  }
};

export const createGithubOauthState = () => randomBytes(24).toString("base64url");

export const createGithubAppJwt = ({
  appId,
  privateKey,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  appId: string;
  privateKey: string;
  nowSeconds?: number;
}) => {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60,
    iss: appId,
  }));
  const input = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey, "base64url")}`;
};

const githubHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
  "User-Agent": "crux-discovery-pilot",
});

const parseGithubError = async (response: Response) => {
  try {
    const body = await response.json() as { message?: string };
    return body.message ?? `GitHub returned HTTP ${response.status}.`;
  } catch {
    return `GitHub returned HTTP ${response.status}.`;
  }
};

export const exchangeGithubOauthCode = async ({
  code,
  redirectUri,
  config = getGithubAppConfig(),
}: {
  code: string;
  redirectUri: string;
  config?: GithubAppConfig;
}) => {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
      "User-Agent": "crux-discovery-pilot",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const body = await response.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? "GitHub did not return a user access token.");
  }
  return body.access_token;
};

export const listUserGithubInstallations = async (userToken: string) => {
  const response = await fetch("https://api.github.com/user/installations?per_page=100", {
    headers: githubHeaders(userToken),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await parseGithubError(response));
  const body = await response.json() as {
    installations?: Array<{ id: number; app_id: number; account?: { login?: string } }>;
  };
  return body.installations ?? [];
};

export const createGithubInstallationToken = async (
  installationId: number,
  config = getGithubAppConfig(),
) => {
  const jwt = createGithubAppJwt({
    appId: config.appId,
    privateKey: config.privateKey,
  });
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        ...githubHeaders(jwt),
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(await parseGithubError(response));
  const body = await response.json() as { token?: string };
  if (!body.token) throw new Error("GitHub did not return an installation access token.");
  return body.token;
};

export const listGithubInstallationRepositories = async (
  installationId: number,
  config = getGithubAppConfig(),
): Promise<GithubRepository[]> => {
  const token = await createGithubInstallationToken(installationId, config);
  const response = await fetch("https://api.github.com/installation/repositories?per_page=100", {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await parseGithubError(response));
  const body = await response.json() as {
    repositories?: Array<{
      full_name: string;
      private: boolean;
      default_branch: string;
      html_url: string;
      permissions?: GithubRepository["permissions"];
    }>;
  };
  return (body.repositories ?? []).map((repository) => ({
    installation_id: installationId,
    full_name: repository.full_name,
    private: repository.private,
    default_branch: repository.default_branch,
    html_url: repository.html_url,
    ...(repository.permissions ? { permissions: repository.permissions } : {}),
  }));
};

export const githubInstallUrl = (config = getGithubAppConfig()) =>
  `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`;

export const githubOauthUrl = ({
  origin,
  state,
  config = getGithubAppConfig(),
}: {
  origin: string;
  state: string;
  config?: GithubAppConfig;
}) => {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${origin}/api/github/callback`);
  url.searchParams.set("state", state);
  return url.toString();
};

export const connectionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});
