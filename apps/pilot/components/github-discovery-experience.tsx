"use client";

import { useEffect, useState } from "react";
import { discoveryConnectors } from "@crux/core";
import { DiscoveryReportSchema, type DiscoveryReport } from "@crux/schemas";
import { DiscoveryOnboarding } from "./discovery-onboarding";
import type { CruxPortableBundle } from "@crux/formats";

type ScanResponse = {
  ok: boolean;
  report?: unknown;
  scan?: {
    repository: string;
    private?: boolean;
    branch: string;
    tree_truncated: boolean;
    files_considered: number;
    files_read: number;
    content_chars_read: number;
    mode: string;
  };
  message?: string;
};

type GithubStatus = {
  ok: boolean;
  configured: boolean;
  connected: boolean;
  installation_count: number;
};

type ConnectedRepository = {
  installation_id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  user_can_write?: boolean;
};

const styles = `
.gh-connect{border:1px solid var(--line);border-radius:24px;background:var(--chalk);overflow:hidden;margin-bottom:18px}.gh-top{padding:clamp(22px,4vw,38px);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:28px}.gh-top h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(34px,4vw,52px);font-weight:400;line-height:1.02;letter-spacing:-.035em;margin:5px 0 10px}.gh-top p{color:var(--muted);line-height:1.55;margin:0}.gh-form{display:grid;gap:10px;margin-top:22px}.repo-row{display:flex;gap:8px}.repo-input,.repo-select{flex:1;min-width:0;border:1px solid var(--line);border-radius:14px;background:white;padding:13px 14px;font:inherit}.repo-input:focus,.repo-select:focus{outline:2px solid rgba(64,88,74,.18);border-color:var(--moss)}.example-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--muted)}.example{border:0;background:transparent;text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:inherit;padding:0}.boundary{border-left:3px solid var(--moss);padding-left:14px;font-size:12px;line-height:1.55;color:var(--muted)}.boundary strong{color:var(--ink)}.connector-mini{display:grid;gap:8px;margin-top:16px}.connector-line{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line)}.connector-line:first-child{border-top:0}.connector-line span{font-size:12px}.connector-line small{font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.scan-note{padding:14px 18px;border-top:1px solid var(--line);background:rgba(64,88,74,.035);display:flex;justify-content:space-between;gap:14px;align-items:center;font-size:12px;color:var(--muted)}.scan-error{padding:12px 14px;border-radius:12px;background:rgba(168,76,50,.08);color:var(--rust);font-size:12px;line-height:1.45}.scan-summary{padding:12px 18px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.35);display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:14px}.scan-summary strong{display:block}.scan-summary small{display:block;color:var(--muted);margin-top:3px}.connection-box{margin-top:20px;border:1px solid var(--line);border-radius:17px;padding:16px;background:rgba(64,88,74,.035)}.connection-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.connection-head strong{font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:400}.connection-head small{display:block;color:var(--muted);margin-top:3px}.connection-actions{display:flex;gap:8px;flex-wrap:wrap}.connection-box .repo-row{margin-top:13px}.or-divider{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin:18px 0 4px}.or-divider:before,.or-divider:after{content:'';height:1px;background:var(--line);flex:1}@media(max-width:760px){.gh-top{grid-template-columns:1fr}.repo-row,.connection-head{flex-direction:column;align-items:stretch}.scan-summary{align-items:flex-start;flex-direction:column}}
`;

export function GithubDiscoveryExperience({ onReviewConfirmedUse, onBeforeGithubConnect }: { onReviewConfirmedUse?: (bundle: CruxPortableBundle) => void; onBeforeGithubConnect?: () => boolean } = {}) {
  const [repo, setRepo] = useState("tomcwxyz/open-recs-local");
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [scan, setScan] = useState<ScanResponse["scan"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [repositories, setRepositories] = useState<ConnectedRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState("");
  const [activeRepository, setActiveRepository] = useState<ConnectedRepository | null>(null);

  const loadConnection = async () => {
    setConnectionLoading(true);
    setConnectionError("");
    try {
      const statusResponse = await fetch("/api/github/status", { cache: "no-store" });
      const statusResult = (await statusResponse.json()) as GithubStatus;
      if (!statusResponse.ok || !statusResult.ok) throw new Error("CRUX could not check the GitHub connection.");
      setStatus(statusResult);

      if (statusResult.configured && statusResult.connected) {
        const repoResponse = await fetch("/api/github/repositories", { cache: "no-store" });
        const repoResult = (await repoResponse.json()) as {
          ok: boolean;
          repositories?: ConnectedRepository[];
        };
        if (!repoResponse.ok || !repoResult.ok) throw new Error("CRUX could not load accessible GitHub repositories. Reconnect your account and try again.");
        const nextRepositories = repoResult.repositories ?? [];
        setRepositories(nextRepositories);
        setSelectedRepository((current) =>
          nextRepositories.some((item) => item.full_name === current)
            ? current
            : nextRepositories[0]?.full_name ?? "",
        );
      } else {
        setRepositories([]);
        setSelectedRepository("");
      }
    } catch (cause) {
      setConnectionError(cause instanceof Error ? cause.message : "CRUX could not check the GitHub connection.");
      setRepositories([]);
      setSelectedRepository("");
    } finally {
      setConnectionLoading(false);
    }
  };

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("github");
    const notices: Record<string, string> = {
      connected: "GitHub authorised. You can now choose an accessible repository.",
      "no-repositories": "CRUX is authorised, but no repositories are available to this GitHub account and App installation. Check the App's selected repositories and reconnect.",
      "invalid-state": "GitHub authorisation did not complete securely. Please try connecting again.",
      error: "GitHub authorisation failed. Check that the App is installed and its callback URL is configured correctly.",
      denied: "GitHub authorisation was cancelled. No repositories were connected.",
    };
    if (result && notices[result]) {
      setConnectionNotice(notices[result]);
      const url = new URL(window.location.href);
      url.searchParams.delete("github");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    void loadConnection();
  }, []);

  const scanRepo = async ({
    repository = repo,
    installationId,
  }: {
    repository?: string;
    installationId?: number;
  } = {}) => {
    setLoading(true);
    setError("");
    setReport(null);
    setScan(null);
    try {
      const endpoint = installationId || !/^https:\/\//i.test(repository.trim()) || /^https:\/\/github\.com\//i.test(repository.trim())
        ? "/api/discover/github" : "/api/discover/git";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo: repository,
          ...(installationId ? { installation_id: installationId } : {}),
        }),
      });
      const result = (await response.json()) as ScanResponse;
      if (!response.ok || !result.ok || !result.report) {
        throw new Error(result.message ?? "CRUX could not scan this repository.");
      }
      setReport(DiscoveryReportSchema.parse(result.report));
      setScan(result.scan ?? null);
      if (!installationId) setActiveRepository(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CRUX could not scan this repository.");
    } finally {
      setLoading(false);
    }
  };

  const scanConnected = async () => {
    const selected = repositories.find((item) => item.full_name === selectedRepository);
    if (!selected) return;
    setActiveRepository(selected);
    await scanRepo({
      repository: selected.full_name,
      installationId: selected.installation_id,
    });
  };

  const disconnect = async () => {
    await fetch("/api/github/disconnect", { method: "POST" });
    await loadConnection();
  };

  const github = discoveryConnectors.find((connector) => connector.id === "github-ship-check");

  if (report) {
    return (
      <>
        <style>{styles}</style>
        <div className="scan-summary">
          <div>
            <strong>{scan?.repository ?? report.source.label}</strong>
            <small>
              {scan
                ? `${scan.branch} · ${scan.files_read} bounded source/config files read · ${scan.private ? "private" : "public"} repository`
                : "Git repository discovery"}
              {scan?.tree_truncated ? " · Provider reported a truncated repository tree" : ""}
            </small>
          </div>
          <button className="btn ghost" type="button" onClick={() => { setReport(null); setScan(null); }}>Scan another repository</button>
        </div>
        <DiscoveryOnboarding
          key={report.source.label}
          reportData={report}
          connectionName={scan?.repository ?? report.source.label}
          connectionMeta={scan?.mode === "github-app"
            ? "GitHub App · bounded server-side repository read · deeper scanning available through Ship Check"
            : "Public Git repository · bounded hosted probe · deeper scanning available through Ship Check"}
          initialStage="discover"
          showConnectorChoices={false}
          githubInstallationId={activeRepository?.installation_id}
          githubUserCanWrite={Boolean(activeRepository?.user_can_write)}
          {...(onReviewConfirmedUse ? { onReviewConfirmedUse } : {})}
        />
      </>
    );
  }

  return (
    <section className="gh-connect">
      <style>{styles}</style>
      <div className="gh-top">
        <div>
          <div className="eyebrow">01 · Connect</div>
          <h2>Start with a project you already have.</h2>
          <p>Use the GitHub App for authorised private repositories, or paste a public repository URL from GitHub, Framagit, GitLab, Codeberg, Gitea or Bitbucket.</p>

          <div className="connection-box">
            <div className="connection-head">
              <div>
                <strong>{status?.connected ? "GitHub connected" : "Choose from GitHub"}</strong>
                <small>
                  {connectionLoading
                    ? "Checking this browser connection…"
                    : status?.connected
                      ? `${repositories.length} accessible repositor${repositories.length === 1 ? "y" : "ies"} · browser-scoped connection`
                      : status?.configured
                        ? "Authorise CRUX, then choose which repositories the GitHub App may access."
                        : "Private GitHub access requires one-time administrator setup."}
                </small>
              </div>
              <div className="connection-actions">
                {status?.connected
                  ? <button className="btn ghost" type="button" onClick={() => void disconnect()}>Disconnect</button>
                  : status?.configured
                    ? <a className="btn primary" href="/api/github/connect" onClick={(event) => { if (onBeforeGithubConnect && !onBeforeGithubConnect()) event.preventDefault(); }}>Connect GitHub</a>
                    : null}
              </div>
            </div>

            {connectionNotice && <p role="status" className="scan-note">{connectionNotice}</p>}
            {connectionError && <p role="alert" className="scan-error">{connectionError}</p>}
            {!connectionLoading && status && !status.configured && (
              <p role="status" className="scan-error">
                Private GitHub access is not enabled on this deployment. A CRUX administrator needs to register a GitHub App and add its credentials in Vercel. See the{" "}
                <a href="https://github.com/tomcwxyz/CRUX/blob/main/docs/GITHUB_APP_CONNECTION.md" target="_blank" rel="noreferrer">GitHub App setup guide</a>.
                Public repository scanning still works.
              </p>
            )}
            {status?.connected && repositories.length === 0 && !connectionLoading && (
              <p className="scan-error" role="status">No accessible repositories were returned. Check which repositories the CRUX App is installed on, then reconnect.</p>
            )}
            {status?.connected && repositories.length > 0 && (
              <div className="repo-row">
                <select
                  className="repo-select"
                  value={selectedRepository}
                  onChange={(event) => setSelectedRepository(event.target.value)}
                  aria-label="Connected GitHub repository"
                >
                  {repositories.map((item) => (
                    <option key={`${item.installation_id}:${item.full_name}`} value={item.full_name}>
                      {item.full_name}{item.private ? " · private" : ""}{item.user_can_write ? " · can create PR" : ""}
                    </option>
                  ))}
                </select>
                <button className="btn primary" type="button" onClick={() => void scanConnected()} disabled={loading || !selectedRepository}>
                  {loading ? "Looking for AI…" : "Discover AI uses"}
                </button>
              </div>
            )}
          </div>

          <div className="or-divider">or scan a public repository on another forge</div>

          <div className="gh-form">
            <div className="repo-row">
              <input
                className="repo-input"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !loading) void scanRepo(); }}
                placeholder="https://framagit.org/group/project or https://codeberg.org/owner/repo"
                aria-label="Public Git repository URL"
              />
              <button className="btn" type="button" onClick={() => void scanRepo()} disabled={loading || !repo.trim()}>
                {loading ? "Looking for AI…" : "Scan public repo"}
              </button>
            </div>
            <div className="example-row">
              <span>Try the first regression:</span>
              <button className="example" type="button" onClick={() => setRepo("tomcwxyz/open-recs-local")}>tomcwxyz/open-recs-local</button>
              <span>or</span>
              <button className="example" type="button" onClick={() => setRepo("tomcwxyz/soundings")}>tomcwxyz/soundings</button>
            </div>
            {error && <div className="scan-error">{error}</div>}
          </div>
        </div>

        <div>
          <div className="boundary">
            <strong>Discovery, not declaration.</strong><br/>
            CRUX may recognise model calls, SDKs, providers and workflow boundaries. It will not infer why the organisation uses AI, who is affected or who has authority.
          </div>
          <div className="connector-mini">
            <div className="connector-line"><span>{github?.name ?? "GitHub project"}</span><small>working pilot</small></div>
            <div className="connector-line"><span>Public GitLab / Framagit / Codeberg / Gitea / Bitbucket</span><small>read-only</small></div>
            <div className="connector-line"><span>Private GitHub access</span><small>{status?.configured ? "GitHub App" : "needs app config"}</small></div>
            <div className="connector-line"><span>Ship Check deeper/local scan</span><small>helper</small></div>
          </div>
        </div>
      </div>
      <div className="scan-note">
        <span>{loading ? "Reading the repository map and a bounded set of likely source/config files…" : "CRUX reads only a bounded public snapshot or an authorised GitHub repository. Docs, tests and fixtures are excluded from primary evidence."}</span>
        <span>No prompts or model outputs are requested.</span>
      </div>
    </section>
  );
}
