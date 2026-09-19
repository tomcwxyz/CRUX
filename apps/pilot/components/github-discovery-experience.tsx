"use client";

import { useEffect, useState } from "react";
import { discoveryConnectors } from "@crux/core";
import { DiscoveryReportSchema, type DiscoveryReport } from "@crux/schemas";
import { DiscoveryOnboarding } from "./discovery-onboarding";

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
};

const styles = `
.gh-connect{border:1px solid var(--line);border-radius:24px;background:var(--chalk);overflow:hidden;margin-bottom:18px}.gh-top{padding:clamp(22px,4vw,38px);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:28px}.gh-top h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(34px,4vw,52px);font-weight:400;line-height:1.02;letter-spacing:-.035em;margin:5px 0 10px}.gh-top p{color:var(--muted);line-height:1.55;margin:0}.gh-form{display:grid;gap:10px;margin-top:22px}.repo-row{display:flex;gap:8px}.repo-input,.repo-select{flex:1;min-width:0;border:1px solid var(--line);border-radius:14px;background:white;padding:13px 14px;font:inherit}.repo-input:focus,.repo-select:focus{outline:2px solid rgba(64,88,74,.18);border-color:var(--moss)}.example-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--muted)}.example{border:0;background:transparent;text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:inherit;padding:0}.boundary{border-left:3px solid var(--moss);padding-left:14px;font-size:12px;line-height:1.55;color:var(--muted)}.boundary strong{color:var(--ink)}.connector-mini{display:grid;gap:8px;margin-top:16px}.connector-line{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line)}.connector-line:first-child{border-top:0}.connector-line span{font-size:12px}.connector-line small{font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.scan-note{padding:14px 18px;border-top:1px solid var(--line);background:rgba(64,88,74,.035);display:flex;justify-content:space-between;gap:14px;align-items:center;font-size:12px;color:var(--muted)}.scan-error{padding:12px 14px;border-radius:12px;background:rgba(168,76,50,.08);color:var(--rust);font-size:12px;line-height:1.45}.scan-summary{padding:12px 18px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.35);display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:14px}.scan-summary strong{display:block}.scan-summary small{display:block;color:var(--muted);margin-top:3px}.connection-box{margin-top:20px;border:1px solid var(--line);border-radius:17px;padding:16px;background:rgba(64,88,74,.035)}.connection-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.connection-head strong{font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:400}.connection-head small{display:block;color:var(--muted);margin-top:3px}.connection-actions{display:flex;gap:8px;flex-wrap:wrap}.connection-box .repo-row{margin-top:13px}.or-divider{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin:18px 0 4px}.or-divider:before,.or-divider:after{content:'';height:1px;background:var(--line);flex:1}@media(max-width:760px){.gh-top{grid-template-columns:1fr}.repo-row,.connection-head{flex-direction:column;align-items:stretch}.scan-summary{align-items:flex-start;flex-direction:column}}
`;

export function GithubDiscoveryExperience() {
  const [repo, setRepo] = useState("tomcwxyz/open-recs-local");
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [scan, setScan] = useState<ScanResponse["scan"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [repositories, setRepositories] = useState<ConnectedRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState("");

  const loadConnection = async () => {
    setConnectionLoading(true);
    try {
      const statusResponse = await fetch("/api/github/status", { cache: "no-store" });
      const statusResult = (await statusResponse.json()) as GithubStatus;
      setStatus(statusResult);

      if (statusResult.configured && statusResult.connected) {
        const repoResponse = await fetch("/api/github/repositories", { cache: "no-store" });
        const repoResult = (await repoResponse.json()) as {
          ok: boolean;
          repositories?: ConnectedRepository[];
        };
        const nextRepositories = repoResult.ok ? repoResult.repositories ?? [] : [];
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
    } catch {
      setStatus(null);
    } finally {
      setConnectionLoading(false);
    }
  };

  useEffect(() => {
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
      const response = await fetch("/api/discover/github", {
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CRUX could not scan this repository.");
    } finally {
      setLoading(false);
    }
  };

  const scanConnected = async () => {
    const selected = repositories.find((item) => item.full_name === selectedRepository);
    if (!selected) return;
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
                : "GitHub discovery"}
              {scan?.tree_truncated ? " · GitHub reported a truncated repository tree" : ""}
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
            : "Public GitHub · bounded hosted probe · deeper scanning available through Ship Check"}
          initialStage="discover"
          showConnectorChoices={false}
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
          <p>Connect GitHub to choose a repository you already use, including private repositories the CRUX App is allowed to read. Or paste any public GitHub repository without connecting an account.</p>

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
                        : "GitHub App connection is not configured on this deployment yet."}
                </small>
              </div>
              <div className="connection-actions">
                {status?.connected
                  ? <button className="btn ghost" type="button" onClick={() => void disconnect()}>Disconnect</button>
                  : status?.configured
                    ? <a className="btn primary" href="/api/github/connect">Connect GitHub</a>
                    : null}
              </div>
            </div>

            {status?.connected && (
              <div className="repo-row">
                <select
                  className="repo-select"
                  value={selectedRepository}
                  onChange={(event) => setSelectedRepository(event.target.value)}
                  aria-label="Connected GitHub repository"
                >
                  {repositories.map((item) => (
                    <option key={`${item.installation_id}:${item.full_name}`} value={item.full_name}>
                      {item.full_name}{item.private ? " · private" : ""}
                    </option>
                  ))}
                </select>
                <button className="btn primary" type="button" onClick={() => void scanConnected()} disabled={loading || !selectedRepository}>
                  {loading ? "Looking for AI…" : "Discover AI uses"}
                </button>
              </div>
            )}
          </div>

          <div className="or-divider">or use a public repository</div>

          <div className="gh-form">
            <div className="repo-row">
              <input
                className="repo-input"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !loading) void scanRepo(); }}
                placeholder="owner/repository or https://github.com/owner/repository"
                aria-label="Public GitHub repository"
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
            <div className="connector-line"><span>Private repository access</span><small>{status?.configured ? "GitHub App" : "needs app config"}</small></div>
            <div className="connector-line"><span>Ship Check deeper/local scan</span><small>helper</small></div>
          </div>
        </div>
      </div>
      <div className="scan-note">
        <span>{loading ? "Reading the repository map and a bounded set of likely source/config files…" : "CRUX reads only the selected repository. Docs, tests and fixtures are excluded from primary evidence."}</span>
        <span>No prompts or model outputs are requested.</span>
      </div>
    </section>
  );
}
