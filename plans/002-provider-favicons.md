# Plan 002: Add Raycast-compatible provider favicons

> **Executor instructions**: Follow this plan step by step and run every
> verification gate. Stop on any listed STOP condition. Update the matching row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 9867af9 -- src/genos/apps.ts src/genos/GenOS.tsx src/genos/shell/HomeScreen.tsx src/genos/shell/Switcher.tsx`
> Compare the excerpts below against the working tree because these paths have
> pre-existing uncommitted UI changes.

## Status

- **Priority**: P1
- **Effort**: S (hours)
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `9867af9`, 2026-08-16, with uncommitted UI changes

## Why this matters

Provider-backed commands need recognizable, consistent branding in the command
menu, minimized home tiles, and app switcher. Raycast's `getFavicon` establishes
the desired behavior, but the helper cannot be imported into Expo because it
returns `@raycast/api` image types. A tiny app-native resolver can use the same
Raycast favicon service and provide deterministic fallbacks without adding an
incompatible runtime.

## Current state

- `src/genos/apps.ts:1-9` defines `AppDef` with only `id`, `name`, `emoji`, tile
  colors, and a generation request.
- `src/genos/GenOS.tsx` copies only `name`, `emoji`, and `tile` into `AppMeta` and
  `RunningApp`.
- `src/genos/shell/HomeScreen.tsx:127-190` maps emoji and keywords to Phosphor
  icons; it has no provider concept.
- `src/genos/shell/Switcher.tsx:10-15` defines the same minimal `RunningApp`
  metadata and renders the emoji in a gradient.
- Raycast's open-source implementation normalizes a host and constructs
  `https://api.ray.so/favicon?url=<hostname>&size=<size>`, defaulting to 64px and
  a link-icon fallback.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test -- --runInBand --no-watchman` | all pass |
| Dependency audit | `npm ls @raycast/api @raycast/utils` | both absent; a nonzero npm result is acceptable only because they are not installed |

## Suggested executor toolkit

- Reference Raycast's official docs:
  `https://developers.raycast.com/utilities/icons/getfavicon`.
- Reference the open-source implementation:
  `https://github.com/raycast/utils/blob/main/src/icon/favicon.ts`.

## Scope

**In scope**:

- `src/genos/providers.ts` (create)
- `src/genos/ui/ProviderIcon.tsx` (create)
- `src/genos/apps.ts`
- `src/genos/GenOS.tsx`
- `src/genos/shell/HomeScreen.tsx`
- `src/genos/shell/Switcher.tsx`
- `__tests__/providers.test.tsx` (create)

**Out of scope**:

- Installing `@raycast/api` or `@raycast/utils`
- Scraping arbitrary pages to discover `<link rel="icon">`
- Changing built-in app icons that already use Phosphor glyphs
- Storing provider credentials
- Adding slash-command UI or Firecrawl network calls (Plans 003 and 004)

## Git workflow

- Branch: `advisor/002-provider-favicons`
- Match the repository's imperative sentence-case commit messages.
- Do not push or open a PR unless instructed.
- Preserve the current uncommitted typography changes.

## Steps

### Step 1: Create a typed provider registry

Create `src/genos/providers.ts` with:

```ts
export interface ProviderDef {
  id: string;
  name: string;
  domain: string;
  homepage: string;
  tile: [string, string];
  fallbackGlyph: string;
}
```

Add a `firecrawl` entry for `firecrawl.dev`. Export a lookup that returns
`undefined` for unknown IDs. Keep provider metadata separate from slash command
metadata so more commands can share one provider.

Add a pure `raycastFaviconUrl(domainOrUrl, size = 64)` function that:

- accepts a bare host or HTTPS URL;
- normalizes with `new URL`, adding `https://` when missing;
- uses only `.hostname` in the request;
- clamps size to a small safe range such as 16-256;
- returns `https://api.ray.so/favicon?url=${encodeURIComponent(hostname)}&size=${size}`;
- returns `null` for malformed input instead of throwing.

**Verify**: `npm run typecheck` -> exit 0.

### Step 2: Add a React Native provider icon with fallback

Create `src/genos/ui/ProviderIcon.tsx`. It should accept `providerId`, `size`, and
an optional corner radius. Resolve the provider, render a React Native `Image`
for the Raycast URL, and switch to a local Phosphor `Globe`/`Link` style glyph on
load error or invalid metadata. Reset the error state when `providerId` changes.
Give the image an accessibility label such as `Firecrawl provider`.

Do not block app launch on icon fetches. Do not render a blank square while the
favicon is unavailable.

**Verify**: focused tests can render success metadata and force the error path
without network access.

### Step 3: Carry provider identity through session metadata

Add optional `providerId?: string` to `AppDef`, the internal `AppMeta`, and
`RunningApp`. Ensure `launch`, deep-link metadata, the `runningApps` memo, home
resume state, and switcher state preserve it. Existing built-in apps must behave
unchanged when no provider is present.

Use `ProviderIcon` in:

- the home/minimized tile when `providerId` exists;
- the switcher header icon and empty preview when `providerId` exists.

Keep the existing Phosphor/emoji fallback for all non-provider apps.

**Verify**: `npm run typecheck` -> exit 0.

### Step 4: Add resolver and rendering tests

Create `__tests__/providers.test.tsx` covering:

- bare domain and full URL normalization;
- path/query removal;
- size default and clamp;
- malformed input returns `null`;
- known and unknown provider lookup;
- provider icon fallback after an image error;
- built-in app metadata remains provider-free.

**Verify**: `npm test -- --runInBand --no-watchman __tests__/providers.test.tsx`
-> the new suite passes.

## Test plan

- Pure URL and registry tests in `__tests__/providers.test.tsx`.
- Component fallback test using `react-test-renderer`; invoke the `Image` error
  handler directly rather than making a network request.
- Existing full render suites must continue to pass.
- Manual offline check: Firecrawl session shows a local fallback icon and all
  navigation remains usable.

## Done criteria

- [ ] No Raycast package is installed.
- [ ] The resolver matches Raycast's `api.ray.so/favicon` hostname/size shape.
- [ ] Invalid URLs and image errors produce a visible local fallback.
- [ ] Provider ID survives launch, minimize, resume, switcher, and close flows.
- [ ] Built-in app icons are visually unchanged.
- [ ] `npm run typecheck` and the complete no-Watchman test suite pass.
- [ ] `plans/README.md` status is updated.

## STOP conditions

Stop and report if:

- Raycast changes the official provider URL or prohibits this use;
- `api.ray.so` cannot be loaded by React Native on either iOS or Android;
- provider identity would require persisting arbitrary remote image URLs instead
  of a trusted registry ID;
- required edits expand into generated OpenUI component files.

## Maintenance notes

- Centralize the service URL in the resolver so a future provider/fallback can
  be swapped without touching UI components.
- Reviewers should check URL parsing, encoding, image error loops, offline
  behavior, and accessibility labels.
- Treat favicons as decoration, never as proof of provider identity or auth.

