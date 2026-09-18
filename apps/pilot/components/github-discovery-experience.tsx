"use client";

import { useState } from "react";
import { discoveryConnectors } from "@crux/core";
import { DiscoveryReportSchema, type DiscoveryReport } from "@crux/schemas";
import { DiscoveryOnboarding } from "./discovery-onboarding";

type ScanResponse = {
  ok: boolean;
  report?: unknown;
  scan?: {
    repository: string;
    branch: string;
    tree_truncated: boolean;
    files_considered: number;
    files_read: number;
    content_chars_read: number;
    mode: string;
  };
  message?: string;
};

const styles = `
.gh-connect{border:1px solid var(--line);border-radius:24px;background:var(--chalk);overflow:hidden;margin-bottom:18px}.gh-top{padding:clamp(22px,4vw,38px);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:28px}.gh-top h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(34px,4vw,52px);font-weight:400;line-height:1.02;letter-spacing:-.035em;margin:5px 0 10px}.gh-top p{color:var(--muted);line-height:1.55;margin:0}.gh-form{display:grid;gap:10px;margin-top:22px}.repo-row{display:flex;gap:8px}.repo-input{flex:1;min-width:0;border:1px solid var(--line);border-radius:14px;background:white;padding:13px 14px;font:inherit}.repo-input:focus{outline:2px solid rgba(64,88,74,.18);border-color:var(--moss)}.example-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--muted)}.example{border:0;background:transparent;text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:inherit;padding:0}.boundary{border-left:3px solid var(--moss);padding-left:14px;font-size:12px;line-height:1.55;color:var(--muted)}.boundary strong{color:var(--ink)}.connector-mini{display:grid;gap:8px;margin-top:16px}.connector-line{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line)}.connector-line:first-child{border-top:0}.connector-line span{font-size:12px}.connector-line small{font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.scan-note{padding:14px 18px;border-top:1px solid var(--line);background:rgba(64,88,74,.035);display:flex;justify-content:space-between;gap:14px;align-items:center;font-size:12px;color:var(--muted)}.scan-error{padding:12px 14px;border-radius:12px;background:rgba(168,76,50,.08);color:var(--rust);font-size:12px;line-height:1.45}.scan-summary{padding:12px 18px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.35);display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:14px}.scan-summary strong{display:block}.scan-summary small{display:block;color:var(--muted);margin-top:3px}@media(max-width:760px){.gh-top{grid-template-columns:1fr}.repo-row{flex-direction:column}.scan-summary{align-items:flex-start;flex-direction:column}}
`;

export function GithubDiscoveryExperience() {
  const [repo, setRepo] = useState("tomcwxyz/open-recs-local");
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [scan, setScan] = useState<ScanResponse["scan"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scanRepo = async () => {
    setLoading(true);
    setError("");
    setReport(null);
    setScan(null);
    try {
      const response = await fetch("/api/discover/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo }),
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

  const github = discoveryConnectors.find((connector) => connector.id === "github-ship-check");

  if (report) {
    return (
      <>
        <style>{styles}</style>
        <div className="scan-summary">
          <div>
            <strong>{scan?.repository ?? report.source.label}</strong>
            <small>
              {scan ? `${scan.branch} · ${scan.files_read} bounded source/config files read` : "Public GitHub discovery"}
              {scan?.tree_truncated ? " · GitHub reported a truncated repository tree" : ""}
            </small>
          </div>
          <button className="btn ghost" type="button" onClick={() => { setReport(null); setScan(null); }}>Scan another repository</button>
        </div>
        <DiscoveryOnboarding
          key={report.source.label}
          reportData={report}
          connectionName={scan?.repository ?? report.source.label}
          connectionMeta="Public GitHub · bounded hosted probe · deeper scanning available through Ship Check"
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
          <p>For this pilot, give CRUX a public GitHub repository. It reads a bounded set of source and configuration files, looks for AI boundaries and workflow clues, and returns candidates for you to review.</p>

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
              <button className="btn primary" type="button" onClick={() => void scanRepo()} disabled={loading || !repo.trim()}>
                {loading ? "Looking for AI…" : "Discover AI uses"}
              </button>
            </div>
            <div className="example-row">
              <span>Try the first test:</span>
              <button className="example" type="button" onClick={() => setRepo("tomcwxyz/open-recs-local")}>tomcwxyz/open-recs-local</button>
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
            <div className="connector-line"><span>Ship Check deeper/local scan</span><small>helper</small></div>
            <div className="connector-line"><span>Private repositories</span><small>GitHub App next</small></div>
          </div>
        </div>
      </div>
      <div className="scan-note">
        <span>{loading ? "Reading the repository map and a bounded set of likely source/config files…" : "Public repositories only in this hosted slice. Docs, tests and fixtures are excluded from primary evidence."}</span>
        <span>No prompts or model outputs are requested.</span>
      </div>
    </section>
  );
}
