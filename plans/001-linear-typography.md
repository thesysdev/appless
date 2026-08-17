# Plan 001: Finish and verify Linear-style global typography

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report it rather than improvising. When done,
> update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 9867af9 -- App.tsx package.json package-lock.json app.json src/genos/typography.tsx src/genos/GenOS.tsx src/genos/shell src/genos/ui`
> The plan was written against uncommitted typography changes, so a non-empty
> diff is expected. Compare the current-state excerpts below before editing. If
> they no longer match in substance, stop and report drift.

## Status

- **Priority**: P1
- **Effort**: S (hours)
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `9867af9`, 2026-08-16, with uncommitted UI changes

## Why this matters

The requested Linear-style font rollout is already mostly present in the working
tree, but it lacks direct typography tests and a documented definition of
"Linear font." Linear's current public CSS uses Inter Variable as its regular
UI family. AppLess now loads static Inter weight files through Expo, which is the
portable React Native equivalent, but the change should not be considered done
until every native `Text`/`TextInput` path and weight fallback is verified.

## Current state

- `App.tsx:2-25` imports Inter 300 through 800 from
  `@expo-google-fonts/inter` and loads them with `useFonts`.
- `App.tsx:31-39` waits for loading or an error, then supplies the loaded state
  through `TypographyProvider`.
- `src/genos/typography.tsx:12-66` maps numeric weights to named Inter font
  families and wraps React Native `Text` and `TextInput`.
- `src/genos/typography.tsx:69-131` defines a `linearType` scale.
- All current JSX text imports have been moved to `src/genos/typography.tsx`;
  `react-native-svg` text remains separate by design.
- `package.json` already contains `@expo-google-fonts/inter` and `expo-font`, and
  `app.json` already lists the `expo-font` plugin.
- Current verification: `npm run typecheck` passes and
  `npm test -- --runInBand --no-watchman` passes 22 tests.

Reference evidence:

- Linear currently declares `--font-regular: "Inter Variable", ...` and uses
  weights around 400/510/590/680.
- Linear also declares Berkeley Mono for monospace, but this app has no
  monospace semantic role. Do not add it globally.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run typecheck` | exit 0, no TypeScript errors |
| Tests | `npm test -- --runInBand --no-watchman` | all suites and tests pass |
| Raw text audit | `rg -n '(^|[,{ ])Text(Input)?([, }]| as )' src App.tsx -g '*.tsx'` | only typography wrapper aliases or intentional SVG text remain |

## Scope

**In scope**:

- `App.tsx`
- `app.json`
- `package.json`
- `package-lock.json`
- `src/genos/typography.tsx`
- Existing `.tsx` files already changed to import the typography wrappers
- `__tests__/typography.test.tsx` (create)
- `README.md` only for a short typography note if needed

**Out of scope**:

- Changing colors, spacing, layout, icons, or wallpaper
- Adding Berkeley Mono to regular UI text
- Downloading fonts from Linear's CDN
- Replacing SVG chart text; SVG text does not accept React Native `Text`
- Reworking the generated OpenUI component contract

## Git workflow

- Branch: `advisor/001-linear-typography`
- Existing commits use imperative sentence case, for example
  `Add anonymous run analytics (PostHog) (#4)`; use the same style.
- Do not push or open a PR unless instructed.
- Preserve all pre-existing uncommitted changes; this plan finishes them rather
  than recreating or reverting them.

## Steps

### Step 1: Lock the semantic font behavior with tests

Create `__tests__/typography.test.tsx`. Render `Text` and `TextInput` inside
`TypographyProvider` with `react-test-renderer` and assert:

- loaded + no weight selects `Inter_400Regular`;
- weights 300, 500, 600, 700, and 800 select the matching named family;
- a style array is flattened correctly;
- an explicit `fontFamily` is preserved;
- `loaded={false}` selects the platform system fallback;
- the wrapper writes `fontWeight: "normal"` after selecting the correct file so
  React Native does not synthetically re-weight a named font file.

Do not export private implementation details solely for testing unless rendering
cannot observe the final style.

**Verify**:
`npm test -- --runInBand --no-watchman __tests__/typography.test.tsx` -> the new
suite passes.

### Step 2: Finish the global import audit

Audit every `.tsx` file under `src/` and `App.tsx`. Ordinary text must import
`Text` and `TextInput` from `src/genos/typography.tsx` (using the correct relative
path). The only permitted exceptions are:

- `NativeText` and `NativeTextInput` aliases inside `typography.tsx`;
- `SvgText` from `react-native-svg` in chart rendering.

Keep existing size and weight values unless a value is moved to an already
defined `linearType` token without changing rendered hierarchy.

**Verify**:
`rg -n 'Text(Input)?[^\n]*from "react-native"' src App.tsx -g '*.tsx'` -> no
ordinary UI imports are returned.

### Step 3: Verify loading and fallback behavior

Confirm `App.tsx` never displays a partially loaded mixed-font UI. Keep the
current behavior of returning `null` while fonts are loading, but allow the app
to render with system fonts when `useFonts` reports an error. Add a focused test
only if this requires logic beyond the existing condition.

Check `app.json` has exactly one `expo-font` plugin entry and that package and
lockfile versions agree.

**Verify**: `npm run typecheck` -> exit 0.

### Step 4: Run cross-renderer regression tests

Run the complete render suites because the wrapper touches both Cupertino and
Material component libraries.

**Verify**: `npm test -- --runInBand --no-watchman` -> all suites pass, including
the new typography suite.

## Test plan

- New `__tests__/typography.test.tsx` coverage as described in Step 1.
- Existing `__tests__/render.test.tsx` verifies Cupertino components still
  render through the OpenUI pipeline.
- Existing `__tests__/render-material.test.tsx` verifies Material components.
- Manual device check after automated tests: one iOS and one Android launch,
  checking home, key gate, generated list, form input, chart labels, switcher,
  and error/retry state for missing glyphs or synthetic bold.

## Done criteria

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand --no-watchman` exits 0.
- [ ] Typography tests cover regular, all used weights, explicit family, style
      arrays, and unloaded fallback.
- [ ] No ordinary UI component imports `Text` or `TextInput` directly from
      `react-native`.
- [ ] Inter is used for global UI copy on iOS, Android, and web.
- [ ] No unrelated visual values were changed.
- [ ] `plans/README.md` status is updated.

## STOP conditions

Stop and report if:

- the current Inter wrapper or `App.tsx` loading code no longer matches the
  current-state description;
- a platform cannot resolve the named Inter families loaded by `useFonts`;
- completing the audit requires changing generated OpenUI source or SVG text;
- tests still fail twice when run with `--no-watchman`.

## Maintenance notes

- If AppLess later adds code blocks or structured raw data, introduce a separate
  monospace token; Berkeley Mono requires its own redistribution/license review.
- Reviewers should scrutinize `fontWeight` ordering in style arrays. The wrapper
  intentionally converts requested weight to a concrete family, then resets
  native weight to normal.
- React Native variable-font behavior differs by platform, so do not replace
  the named files with a single variable font without device-level proof.

