# Plan 003: Add the Firecrawl provider runtime

> **Executor instructions**: Follow the steps in order, run each verification,
> and stop on any STOP condition. This plan adds real credit-bearing network
> operations; do not substitute guessed endpoint behavior. Update the row in
> `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 9867af9 -- src/config.ts src/genos/stream.ts src/genos/store.ts src/genos/tools __tests__/tools.test.ts`
> Compare the current-state excerpts before editing.

## Status

- **Priority**: P1
- **Effort**: L (multi-day)
- **Risk**: HIGH
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `9867af9`, 2026-08-16, with uncommitted UI changes

## Why this matters

The requested Firecrawl workflows cannot be delivered by adding labels alone.
AppLess currently exposes one synchronous Exa `web_search` tool to Cerebras.
Directory extraction, lead generation, lead research, and deep research need a
real Firecrawl execution layer with provider-scoped instructions, structured
outputs, async Agent polling, cancellation, explicit credit caps, and BYOK key
handling. This is the highest-risk plan because it spends external credits and
can run for minutes.

## Current state

- `src/config.ts:14-16` supports optional public Exa and Unsplash keys, while the
  Cerebras key uses a device-backed store.
- `src/genos/tools/search.ts:25-66` hard-codes one OpenAI tool definition and one
  name switch for `web_search`.
- `src/genos/stream.ts:14` imports the search module directly.
- `src/genos/stream.ts:39-40` allows at most three tool rounds.
- `src/genos/stream.ts:249-287` awaits tool results inline before asking
  Cerebras to compose the screen.
- `src/genos/store.ts:8-33` has no workflow/provider context on a screen.
- `src/genos/store.ts:211-220` correctly refuses every tool call during
  speculative prefetch; preserve this credit-safety rule.
- Firecrawl's current API uses `POST https://api.firecrawl.dev/v2/search`,
  `POST /v2/scrape`, `POST /v2/agent`, and `GET /v2/agent/<jobId>` for status.
  Agent states include `processing`, `completed`, `failed`, and `cancelled`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run typecheck` | exit 0 |
| Unit tests | `npm test -- --runInBand --no-watchman __tests__/tools.test.ts __tests__/store.test.ts` | all pass |
| Full tests | `npm test -- --runInBand --no-watchman` | all pass |

## Suggested executor toolkit

- Read the current official Firecrawl docs before coding:
  `https://docs.firecrawl.dev/introduction` and
  `https://docs.firecrawl.dev/features/agent`.
- Use the Node/REST examples as the protocol source of truth; do not add the
  Node SDK unless it is verified to work in Expo/Hermes and materially reduces
  code. Direct `expo/fetch` matches the repository's current convention.

## Scope

**In scope**:

- `src/config.ts`
- `src/genos/providers/firecrawl/key.ts` (create; path may be
  `src/genos/tools/firecrawl/key.ts` if provider folders are not adopted)
- `src/genos/shell/ProviderKeyGate.tsx` (create)
- `src/genos/tools/index.ts` (create)
- `src/genos/tools/search.ts`
- `src/genos/tools/firecrawl.ts` (create)
- `src/genos/stream.ts`
- `src/genos/store.ts`
- `src/genos/workflows.ts` (create compact workflow contracts)
- `__tests__/tools.test.ts`
- `__tests__/store.test.ts`
- `__tests__/firecrawl.test.ts` (create)
- `README.md` and `.env` documentation, never a real key

**Out of scope**:

- Slash-command menu and command discovery (Plan 004)
- Provider favicons (Plan 002)
- Bundling local Codex `SKILL.md` files
- Automatically submitting CRM records or sending outreach
- Bypassing login walls, CAPTCHAs, robots restrictions, or paywalls
- Uploading CSV files in the first release
- A shared production Firecrawl key in an Expo public environment variable

## Git workflow

- Branch: `advisor/003-firecrawl-runtime`
- Match imperative sentence-case commit messages.
- Prefer logical commits: tool registry, Firecrawl client/key store, workflow
  context, then tests/docs.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Generalize the tool registry without changing Exa behavior

Create `src/genos/tools/index.ts` as the single source for:

- enabled OpenAI-format tool definitions;
- enabled prompt sections;
- `executeTool(name, args, signal, progress?)` dispatch;
- provider availability.

Move no Exa network behavior unless necessary. `web_search` must keep its exact
name, request shape, result formatting, error-as-string behavior, and existing
tests. Update `stream.ts` to import only from the new registry.

Avoid one global `toolsAvailable()` boolean that exposes disabled provider tools.
Build definitions from the keys/providers actually available for the active
screen.

**Verify**: existing tool tests and `npm run typecheck` pass before Firecrawl is
added.

### Step 2: Add a Firecrawl BYOK key store

Model the existing Cerebras key store but keep provider status separate. Store a
user-entered key in SecureStore on iOS/Android and localStorage on web under a
Firecrawl-specific key. Support `loading`, `missing`, `present`, and `rejected`.
Clear only the exact key rejected by a 401/403 response.

An optional development-only environment key may be supported for local builds,
but document that any `EXPO_PUBLIC_*` secret is bundled into the client and must
not be used as a shared production credential.

Do not make Firecrawl mandatory for ordinary AppLess use. Missing Firecrawl
credentials disable Firecrawl tools but leave Cerebras and Exa flows intact.

Add a reusable, non-global `ProviderKeyGate` for entering/replacing the key. It
must identify Firecrawl, explain on-device storage and credit usage, link to the
official key page, and be shown only when a Firecrawl action needs it. It must
never replace the existing Cerebras startup gate.

**Verify**: unit tests mock SecureStore and cover hydrate, set, reject-current,
do-not-reject-replaced-key, and key-gate dismissal without affecting Cerebras.

### Step 3: Implement Firecrawl primitives

In `src/genos/tools/firecrawl.ts`, implement small typed clients using
`expo/fetch`:

- `firecrawl_search`: `POST /v2/search` with query, a bounded limit, and optional
  scrape formats;
- `firecrawl_scrape`: `POST /v2/scrape` for one validated HTTP(S) URL and bounded
  markdown/JSON output;
- `firecrawl_agent`: `POST /v2/agent` with prompt, optional trusted schema/model/
  URLs, and an explicit `maxCredits` supplied by the workflow contract;
- `getFirecrawlAgentStatus`: `GET /v2/agent/<jobId>`.

For every endpoint:

- attach `Authorization: Bearer <user key>` and JSON headers;
- validate arguments before network access;
- allow only `http:` and `https:` URLs;
- cap result counts and text passed back to Cerebras to stay within context;
- never log the key, authorization headers, or raw sensitive result bodies;
- mark the current key rejected on 401/403;
- map 429 and credit-limit errors to actionable error text;
- preserve source URLs and explicit missing fields;
- return error strings to the model rather than inventing data.

Do not expose arbitrary JSON schema supplied verbatim by the model. Choose a
schema from a trusted `workflowId` registry or validate it against a strict size
and depth budget.

**Verify**: mocked fetch tests assert endpoint, method, sanitized body, auth
presence without snapshotting the secret, and response/error handling.

### Step 4: Make Agent execution asynchronous, cancellable, and bounded

Implement polling as a dedicated helper, not an unbounded loop inside
`executeTool`:

- poll only while status is `processing`;
- use a 2-5 second delay with a documented maximum elapsed time based on the
  workflow depth;
- stop immediately when the screen's AbortSignal fires;
- call the documented Agent cancellation endpoint on user cancellation if the
  current API supports it; otherwise stop local polling and document that the
  remote job may continue consuming credits;
- return `completed` data plus `creditsUsed` and source metadata;
- map `failed` and `cancelled` distinctly;
- time out with the job ID retained in a safe error so a later status check can
  recover it;
- never silently retry a new Agent job after a timeout.

Expose progress states such as `starting`, `processing`, and elapsed time to the
screen store. Replace the current boolean-only `searching` state with a backwards
compatible tool-progress shape or add a new optional field. The shell must still
be usable while the job runs.

**Verify**: fake-timer tests cover processing -> completed, processing -> failed,
timeout, abort, and no duplicate POST on retry/status recovery.

### Step 5: Persist workflow context through screen navigation

Add `workflowId?: string` to `AppDef`, `Screen`, and `LaunchInput`. `openApp`
copies it to the first screen; `resolveAction`, prefetch children, retry, and deep
navigation inherit it from the parent. Do not paste the full workflow prompt into
every user request.

Build a compact trusted workflow contract from `workflowId` and append it to the
system prompt for that screen. The runtime is not complete until it has contracts
for the full catalog below. Related workflows may share primitives and output
helpers, but each ID needs its own input requirements, collection policy, result
shape, and tests:

- `firecrawl-company-directories`: visible fields, dedupe, pagination progress,
  and blanks for unavailable data;
- `firecrawl-competitive-intel`: current pricing/features/changelog evidence,
  timestamped comparisons, and explicit conflicting or missing claims;
- `firecrawl-dashboard-reporting`: authorized dashboard/session boundaries,
  metric definitions, reporting period, and no credential capture in output;
- `firecrawl-deep-research`: explicit quick/thorough/exhaustive depth, citations,
  synthesis, risks, and open questions;
- `firecrawl-demo-walkthrough`: bounded product flow, observed UX evidence, and
  no state-changing action without explicit permission;
- `firecrawl-knowledge-base` and `firecrawl-knowledge-ingest`: scoped sources,
  crawl boundaries, provenance, dedupe, update timestamp, and login limitations;
- `firecrawl-lead-gen`: legitimately accessible fields only, dedupe, data gaps,
  and no access-control bypass;
- `firecrawl-lead-research`: concise sourced brief with facts separated from
  inferred pain points;
- `firecrawl-market-research`: dated metrics, primary-source preference,
  methodology, and uncertainty;
- `firecrawl-qa`: bounded target and charter, reproducible steps, evidence, and
  no destructive submissions;
- `firecrawl-research-papers`: paper metadata, primary PDF/source links,
  methodology, results, limitations, and no invented citations;
- `firecrawl-seo-audit`: crawl boundary, metadata/indexability evidence,
  prioritized findings, and page samples;
- `firecrawl-shop`: constraints, current price/availability evidence,
  comparisons, and no purchase action;
- `firecrawl-website-design-clone`: observed tokens/components, asset provenance,
  and a DESIGN.md-shaped result without copying protected content wholesale;
- `firecrawl-workflows`: a safe chooser that routes to one concrete contract
  rather than acting as an unbounded generic Agent;
- base `firecrawl`: an explicit search, scrape, or Agent choice, with Agent
  requiring cost/depth confirmation.

All workflow screens must preserve source URLs and must not fabricate missing
email, phone, funding, roles, or company facts.

**Verify**: store tests assert workflow inheritance across root, action child,
form child, prefetch, and retry.

### Step 6: Define cost and depth policy

Every Agent call must receive an explicit `maxCredits`; never rely on the current
API default of 2,500. Put budget ranges in workflow definitions and require the
UI/command layer to select one before execution. Recommended initial policy:

- base search/scrape: no Agent call;
- structured directory, lead, shopping, SEO, QA, knowledge, dashboard, and demo
  workflows: 150 credits by default, with requested row/page limits included in
  the prompt and schema;
- competitive and market research: 250 credits by default;
- deep research: quick = 100, thorough = 300, exhaustive = 750 credits, with
  increasing timeouts and a separate confirmation for exhaustive;
- pro model only for an explicit high-accuracy choice, never by default.

Treat these as maximums, not expected spend. Validate them with disposable
low-credit test runs before production and adjust only in the central policy,
never in individual UI components.

**Verify**: a unit test fails if any Agent definition can execute with missing or
non-positive `maxCredits`.

### Step 7: Document and verify the provider runtime

Update README setup text with Firecrawl BYOK behavior, supported primitives,
credit/cost warning, and limitations. Do not claim the specialized slash commands
exist until Plan 004 lands.

Run the full test suite and one manual smoke test per endpoint with a disposable
low-credit key. The manual test must not use real personal lead data.

**Verify**: `npm run typecheck` and
`npm test -- --runInBand --no-watchman` both exit 0.

## Test plan

- `__tests__/firecrawl.test.ts`: request validation, auth rejection, 429/credit
  error, content truncation, source retention, polling state machine, abort, and
  explicit credit cap.
- `__tests__/tools.test.ts`: registry composition with no keys, Exa only,
  Firecrawl only, and both providers.
- `__tests__/store.test.ts`: workflow context inheritance and no speculative
  credit-bearing calls.
- Manual low-credit smoke tests: search, scrape one public page, one tiny Agent
  structured extraction, status polling, and cancel.

## Done criteria

- [ ] Missing Firecrawl credentials do not affect ordinary AppLess behavior.
- [ ] No shared Firecrawl secret appears in source, public config, logs, tests, or
      snapshots.
- [ ] Every Agent run has an explicit timeout, AbortSignal, and `maxCredits`.
- [ ] Speculative prefetch never executes Firecrawl.
- [ ] Every Firecrawl catalog ID has a trusted runtime contract and tests.
- [ ] Workflow context survives every child screen.
- [ ] Facts retain source URLs; unavailable structured fields stay blank.
- [ ] `npm run typecheck` and all no-Watchman tests pass.
- [ ] README documents BYOK, cost, and current limitations.
- [ ] `plans/README.md` status is updated.

## STOP conditions

Stop and report if:

- Firecrawl's current API differs from the documented v2 endpoint/state model;
- Firecrawl does not support required cross-origin/native requests and the fix
  would require introducing a backend;
- cancellation cannot prevent or bound credit usage sufficiently for product
  approval;
- Cerebras rejects the expanded tool schema or cannot handle the tool outputs;
- real execution requires CAPTCHA/access-control bypass;
- production would require caps above the central policy without a new explicit
  product decision.

## Maintenance notes

- Firecrawl Agent was marked Research Preview in the documentation reviewed for
  this plan; endpoint shapes and pricing can change. Keep protocol code isolated.
- Reviewers should scrutinize credit caps, duplicate job creation, abort behavior,
  schema trust boundaries, secret handling, and output-size limits.
- Long research is fundamentally different from the current sub-second screen
  generation path. Preserve job IDs so future versions can resume across app
  restarts without rerunning paid work.
