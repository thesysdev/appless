# GenUI Scorecard

A small, repo-local quality gate for generated UI: a corpus of exemplar
openui-lang screens scored against the native component contract and both
design-system renderer sets. Run it with:

```bash
npm run scorecard
```

This executes `__tests__/scorecard.test.tsx` under the jest-expo rig and
rewrites `scorecard/SCORECARD.md` with the score table.

## What each screen is scored on

1. **Contract validity** - the program parses to a complete (non-truncated)
   tree with a `root`, every component used exists in
   `src/genos/ui/contract.tsx`, and every component's props pass its zod
   schema. The parser wraps sub-components as `ElementNode`s while the zod
   `.ref` schemas expect plain props objects, so the harness
   (`scorecard/harness.ts`) recursively unwraps elements before calling
   `safeParse`. Parser-reported errors (`unknown-component`,
   `missing-required`, `null-required`) count as failures too.
2. **Headless render success** - each screen is rendered with
   `react-test-renderer` through the Cupertino library
   (`src/genos/library.ts`) and the Material library
   (`buildGenosLibrary(materialRenderers)`). A screen passes when rendering
   neither throws nor produces an empty tree. `react-native-webview` is
   mocked, so `MapView` renders as null under jest - map behavior is not
   covered by this score.
3. **Unknown components** - any component name the program uses that is not
   in the contract. Unknown components render as NOTHING (react-lang returns
   null), so a non-empty list always means a real user-facing gap.

The table also reports component coverage: every contract component (all 33,
including the `TabItem` / `SelectItem` / `Series` sub-components) must appear
in at least one corpus screen, and the test suite fails if any are missing.

## Adding a corpus entry

1. Add `<name>.txt` to `scorecard/corpus/` containing one complete
   openui-lang program (`root = Card(...)` required).
2. Follow the prompt's syntax rules: positional arguments, one statement per
   line, and every non-`root` variable referenced by a parent - unreferenced
   statements are dropped before rendering.
3. Optional positional arguments cannot be skipped or passed as explicit
   `null` - omit trailing arguments instead.
4. Run `npm run scorecard`. New screens are picked up automatically and must
   pass all three checks; if the screen exercises a component no other screen
   uses, the coverage check credits it.

Exemplars should read like real model output - the four original entries
(`settings`, `wallet`, `chat`, `trip`) are the prompt exemplars also used by
`__tests__/render.test.tsx` and `__tests__/render-material.test.tsx`.

## Scope

The scorecard measures whether screens the model is *expected* to emit
actually survive this app's contract and renderers. It complements the
upstream discussion in thesysdev/openui#786 on evaluating generative-UI
output quality; it is a CI-friendly smoke gate for this fork, not a general
benchmark of model quality. Pair it with `npm run check:drift`
(`scripts/check-contract-drift.mjs`), which guards the other direction: the
embedded system prompt must not document components the contract lacks.
