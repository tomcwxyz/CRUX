"use client";

import { useEffect, useState } from "react";
import type { CruxPortableBundle } from "@crux/formats";
import { GithubDiscoveryExperience } from "./github-discovery-experience";
import { PlatformDiscoveryExperience } from "./platform-discovery-experience";

export function DiscoverySourceChoice({
  onReviewConfirmedUse,
  onBeforeGithubConnect,
}: {
  onReviewConfirmedUse?: (bundle: CruxPortableBundle) => void;
  onBeforeGithubConnect?: () => boolean;
} = {}) {
  const [source, setSource] = useState<"platform" | "git">("platform");

  // A GitHub OAuth callback returns to /author?github=...#connect.
  // Recover the Git flow without changing server-rendered initial markup.
  useEffect(() => {
    const fromGithub = new URLSearchParams(window.location.search).has("github");
    if (fromGithub) setSource("git");
  }, []);

  return (
    <section aria-label="Choose discovery source">
      <div style={{
        display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center",
        marginTop: 20, marginBottom: 16,
      }}>
        <strong style={{ marginRight: 10, fontSize: 13 }}>Where does the AI live?</strong>
        <button type="button" aria-pressed={source === "platform"}
          className={source === "platform" ? "btn primary" : "btn"}
          onClick={() => setSource("platform")}>
          SaaS tools and platforms
        </button>
        <button type="button" aria-pressed={source === "git"}
          className={source === "git" ? "btn primary" : "btn"}
          onClick={() => setSource("git")}>
          Git repositories
        </button>
      </div>
      {source === "platform" ? (
        <PlatformDiscoveryExperience
          {...(onReviewConfirmedUse ? { onReviewConfirmedUse } : {})}
        />
      ) : (
        <GithubDiscoveryExperience
          {...(onReviewConfirmedUse ? { onReviewConfirmedUse } : {})}
          {...(onBeforeGithubConnect ? { onBeforeGithubConnect } : {})}
        />
      )}
    </section>
  );
}
