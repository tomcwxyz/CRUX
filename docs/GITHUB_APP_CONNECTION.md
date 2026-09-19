# GitHub App connection

**Status:** implementation ready for configuration  
**Updated:** 19 September 2026

The CRUX discovery pilot can work without GitHub authentication for public repositories. The GitHub App connection adds a repository chooser and bounded read access to private repositories.

The connection is intentionally separate from organisational meaning:

```text
GitHub App says:
this browser/user can access this installed repository

CRUX discovery says:
these technical AI/workflow signals are present

A person says:
this is a real organisational AI use and this is what it means
```

## Security model

CRUX does not put GitHub access tokens into client-side state.

The browser flow is:

```text
Connect GitHub
   ↓
GitHub user authorisation
   ↓
CRUX receives a short-lived user access token server-side
   ↓
CRUX asks GitHub which CRUX App installations that user can access
   ↓
CRUX discards the user token
   ↓
CRUX stores only the verified installation IDs in a signed HttpOnly cookie
   ↓
When a repository is read, CRUX mints a short-lived installation token server-side
```

GitHub warns that the `installation_id` supplied to an App setup URL can be spoofed. CRUX therefore ignores that value and sends the browser back through user authorisation before accepting any installation.

The connection cookie contains only installation IDs plus an expiry. It is HMAC-signed, HttpOnly, SameSite=Lax and Secure in production. It expires after eight hours.

## Registering the GitHub App

For the current pilot, use:

- **Homepage URL:** `https://crux-ashy.vercel.app`
- **Callback URL:** `https://crux-ashy.vercel.app/api/github/callback`
- **Setup URL:** `https://crux-ashy.vercel.app/api/github/installed`
- **Redirect on update:** optional
- **Request user authorization during installation:** off; CRUX runs the explicit user-authorisation flow itself
- **Webhooks:** not required for this slice

Repository permissions:

- **Metadata:** read
- **Contents:** read

Install the App only on repositories the user wants CRUX to inspect. GitHub's selected-repository installation option is preferred.

## Vercel environment

Set these as production secrets:

```text
GITHUB_APP_ID
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_SLUG
GITHUB_CONNECTION_SECRET
```

`GITHUB_APP_PRIVATE_KEY` may be stored with escaped newlines; the pilot normalises `\\n` to real newlines at runtime.

`GITHUB_CONNECTION_SECRET` should be an independent high-entropy secret used only to sign CRUX's browser-scoped installation cookie.

## What private discovery reads

After a person selects a repository, CRUX:

1. verifies the requested installation ID is in the signed connection cookie;
2. mints a short-lived GitHub installation token;
3. reads the repository metadata and recursive tree;
4. selects at most 80 likely source/config files;
5. excludes docs, tests, fixtures, build output and dependencies from primary evidence;
6. reads selected private files through GitHub's blob API;
7. passes the bounded snapshot into the same `crux-discovery/0.1` producer-neutral discovery logic used by public GitHub.

The installation token remains server-side.

## Deliberate limits

This first App connection is **read-only**.

It does not yet:

- create branches;
- change source files;
- open pull requests;
- subscribe to repository webhooks;
- persist GitHub account/workspace identity in CRUX.

The next observation-PR step should be a deliberate permission upgrade. It should request only the extra GitHub permissions needed to create a branch/commit and open a pull request, and it should still require an explicit user action before creating the PR. CRUX should never silently merge it.

## Test bar

Before enabling this on production:

- normal CRUX CI must pass;
- signed-cookie tampering/expiry tests must pass;
- public discovery must still return the Open Recs regression candidates;
- private scanning must remain impossible without a verified installation cookie;
- the connection UI must remain usable when the GitHub App is not configured;
- a real private repository should be tested only after the App and Vercel secrets are configured.
