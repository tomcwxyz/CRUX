# CRUX SaaS pilot connections: Airtable and Google Workspace

The user journey is **choose a product → check possible AI uses → describe them**. Account checks are optional. Only limited, read-only technical evidence is collected, and the UI never treats supplier capability as confirmed organisational use.

## Required Vercel environment settings

Set the following for the environment where you intend to test OAuth:

```text
CRUX_PUBLIC_ORIGIN=https://YOUR-STABLE-CRUX-HOST
CRUX_SAAS_SESSION_SECRET=<a cryptographically random secret of at least 32 characters>
CRUX_AIRTABLE_CLIENT_ID=<Airtable OAuth integration client ID>
CRUX_AIRTABLE_CLIENT_SECRET=<Airtable OAuth integration client secret>
CRUX_GOOGLE_CLIENT_ID=<Google OAuth web application client ID>
CRUX_GOOGLE_CLIENT_SECRET=<Google OAuth web application client secret>
```

Use a **stable hostname**: OAuth redirect URLs must match exactly and the callback rejects a different request origin. Do not use deployment-specific preview URLs that change on every commit. Never commit credentials to Git.

### Airtable

1. Register an OAuth integration in Airtable Builder Hub; choose only the **Base schema: read** permission (`schema.bases:read`).
2. Register `https://YOUR-STABLE-CRUX-HOST/api/saas/airtable/callback`.
3. Configure the client ID and secret as encrypted Vercel environment variables.
4. Authorise only the base(s) you wish to test.
5. CRUX checks `GET /v0/meta/bases`. **Seeing a base does not demonstrate that Airtable AI ran**. AI consumption audit logs are available to Enterprise Scale administrators separately and are not accessed with this scope.

### Google Workspace

1. Enable the **Admin SDK API** in a Google Cloud project.
2. Create an OAuth web application with the authorised redirect URI `https://YOUR-STABLE-CRUX-HOST/api/saas/google/callback`.
3. Configure OAuth consent/testing users and request exactly `https://www.googleapis.com/auth/admin.reports.audit.readonly`. This may require Google verification before a public rollout.
4. Configure the Google OAuth client ID and client secret.
5. Authorise using a Google Workspace administrator with permission to view audit reports.
6. CRUX calls the Admin Reports activity endpoint for `gemini_in_workspace_apps`, filtering for `feature_utilization` across the past 30 days, inspecting at most 100 activity items. Only counts grouped by application are returned. The API is not used to read emails, documents or prompts.

## Session and evidence boundaries

- Provider access tokens live in authenticated-encryption, HTTP-only, same-site cookies for up to 45 minutes. No refresh tokens are retained.
- One-time OAuth states expire after 10 minutes. Airtable uses PKCE.
- The server returns fixed, aggregate metadata only. Raw audit payloads are not returned to the client and are not stored.
- A disconnected cookie does not itself revoke a supplier's OAuth grant. Users should revoke the integration in the supplier's account permissions when permanent revocation is required.
- Scans are **samples**, not comprehensive inventories. Empty results are unknown, never proof of absence.
- This is an ephemeral pilot, not an account-connected multi-user production platform. Before general release add identity-bound token storage, rate limiting, audit instrumentation and robust provider error handling.

## Smoke test

1. Deploy on the stable hostname with all settings configured.
2. Open the SaaS discovery route, connect Airtable, grant one test base and click **Check connected account**. Confirm the base count and no record data.
3. Disconnect; the same check should return 401.
4. Connect Google Workspace with a suitably privileged test admin, then check the aggregated Gemini counts.
5. Test cancelled consent, expired sessions, mismatched states and inaccessible resources.
6. Confirm no OAuth tokens, source prompts or personal identifiers appear in browser responses, analytics or server logs.
7. Run `pnpm check` and `pnpm build` in the repository and verify Vercel deployment is Ready.
