# GitHub App connection

**Status:** implementation ready for configuration  
**Updated:** 19 September 2026

The CRUX discovery pilot can work without GitHub authentication for public repositories. The GitHub App connection adds a repository chooser, bounded private-repository discovery, and—when separately permitted—an explicit draft-PR action for exact observation patches.

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
CRUX stores the verified installation IDs plus separate read/write repository allow-lists in a signed HttpOnly cookie
   ↓
When a repository is read, CRUX mints a short-lived installation token server-side
```

GitHub warns that the `installation_id` supplied to an App setup URL can be spoofed. CRUX therefore ignores that value and sends the browser back through user authorisation before accepting any installation.

The connection cookie contains verified installation IDs, the repository IDs this user-and-App combination could read at authorisation time, the narrower repository IDs where the user also had write access, and an expiry. It is HMAC-signed, HttpOnly, SameSite=Lax and Secure in production. It expires after one hour.

## Production wiring checklist (20 October 2026)

The GitHub App routes and private scan path are implemented, but **the production
CRUX Vercel project currently has none of the six required GITHUB_* environment
variables**. It therefore correctly reports `configured: false` and cannot
start GitHub authorisation. A connected ChatGPT GitHub account does **not**
authorise the independently deployed CRUX website to read private repositories.

1. In GitHub, register a new GitHub App from
   https://github.com/settings/apps/new (or reuse an existing dedicated CRUX
   App). Use the URLs and least-privilege permissions below. Prefer installing
   only on selected repositories. No repository webhooks are necessary.
2. Copy the **App ID**, **Client ID** and **App slug** into the matching CRUX
   Vercel environment settings. Create a **Client secret** and **Private key**
   in the App's settings and add those directly to the Vercel secrets screen.
   Do not paste either value into issues, PRs, chats or the browser console.
3. Create a strong **independent random connection signing secret**, add it as
   `GITHUB_CONNECTION_SECRET` and keep it stable across deployments.
4. Configure all six variables on the **crux** Vercel project for **Production**,
   redeploy the production branch so that server functions receive them, and
   open https://crux-ashy.vercel.app/author#connect.
5. Click **Connect GitHub**, authorise the CRUX App, select/install on the
   appropriate repositories, return to CRUX, choose a private repository
   and select **Discover AI uses**.
6. Validate that `/api/github/status` reports configured/connected in the
   authorised browser and that an unauthorised browser cannot read the same
   private repository. The response must never include tokens or private
   source content. Review and approve the stronger write permissions **only**
   if draft observation PRs are needed.

The UI now visibly distinguishes missing production setup, cancelled
authorisation, missing selected repositories and temporary GitHub connection
errors. A real private repository test remains an acceptance gate.

## Registering the GitHub App

For the current pilot, use:

- **Homepage URL:** `https://crux-ashy.vercel.app`
- **Callback URL:** `https://crux-ashy.vercel.app/api/github/callback`
- **Setup URL:** `https://crux-ashy.vercel.app/api/github/installed`
- **Redirect on update:** optional
- **Request user authorization during installation:** off; CRUX runs the explicit user-authorisation flow itself
- **Webhooks:** not required for this slice

Repository permissions for **discovery only**:

- **Metadata:** read
- **Contents:** read

To exercise the **Create draft review PR** capability, the same App installation must additionally be approved for:

- **Contents:** write
- **Pull requests:** write

CRUX still mints a read-scoped installation token for discovery. It requests a write-capable token only after the user explicitly chooses **Create draft review PR**, after the exact adapter has passed against the current base commit.

Install the App only on repositories the user wants CRUX to inspect. GitHub's selected-repository installation option is preferred. Existing installations may need to approve the App permission upgrade before PR creation becomes available.

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
4. verifies the repository ID was in the signed user-scoped allow-list captured during authorisation;
5. selects at most 80 likely source/config files;
6. excludes docs, tests, fixtures, build output and dependencies from primary evidence;
7. reads selected private files through GitHub's blob API with bounded concurrency;
8. passes the bounded snapshot into the same `crux-discovery/0.1` producer-neutral discovery logic used by public GitHub.

The installation token remains server-side. The current pilot records at most the first 100 user-accessible repositories per installation in the signed connection; pagination and large-installation UX still need further work. Repository selections above that limit should not be assumed to appear.

## Draft observation PR safety

The pilot now contains a write path, but it is deliberately narrower than the read connection.

A draft PR can be created only when all of these are true:

1. the repository is in the signed user/App read allow-list;
2. the authorising GitHub user also had repository write access when the connection was created;
3. a deterministic CRUX patch adapter exists for this exact discovered use;
4. the adapter re-reads and passes against one immutable current base commit;
5. the target review branch does not already exist;
6. the installed GitHub App can mint a token scoped to **Contents: write** and **Pull requests: write**;
7. the user explicitly presses **Create draft review PR**.

CRUX then creates four blobs, one tree, one commit, one new review branch and a **draft** pull request. It never updates or force-pushes an existing review branch and never merges the PR. If pull-request creation fails after branch creation, CRUX attempts to remove the new branch.

The first deterministic adapter is intentionally narrow: Open Recommendations Local → `source.extract`. Other discoveries remain proposal-only until a tested adapter exists.

Still out of scope:

- automatic merging;
- arbitrary AI-generated source edits;
- repository webhooks;
- persistent GitHub account/workspace identity in CRUX.

## Test bar

Before enabling this on production:

- normal CRUX CI must pass;
- signed-cookie tampering/expiry tests must pass;
- public discovery must still return the Open Recs regression candidates;
- private scanning must remain impossible without a verified installation cookie;
- the connection UI must remain usable when the GitHub App is not configured;
- a real private repository should be tested only after the App and Vercel secrets are configured;
- draft-PR creation should be live-tested only after the App's write permission upgrade has been explicitly approved.
