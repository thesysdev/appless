# applessOS native — no apps. just ask. (React Native)

The React Native / Expo port of the appless-os web app: a phone with **no
apps** where every screen is generated the moment you ask, rendered with the
`<Renderer>` from `@openuidev/react-lang` — here on real iOS/Android UI
primitives instead of the DOM. Built on Expo SDK 54, pinned to match the Expo
Go version on the Play Store — if your Expo Go reports a different SDK,
`npx expo install expo@^<version> && npx expo install --fix` and re-run.

Two native design systems, one contract: **Cupertino on iOS, Material 3 on
Android** — every screen is generated from the same shared system prompt and
rendered in the platform's own design language. There is **no server**: the
app talks straight to the Cerebras API on your own key (BYOK), resolves
semantic `/api/img?q=…` image queries itself (LoremFlickr keyless, Unsplash
when keyed), and can run model-decided web searches (Exa, optional).

## Run it

```bash
npm install                             # postinstall applies the react-lang patch
npm run ios                             # or: npm start, then open in Expo Go
```

On first launch the app asks for a Cerebras API key (free at
[cloud.cerebras.ai](https://cloud.cerebras.ai)) and stores it on-device
(SecureStore on iOS/Android). To skip the prompt during development, put keys
in `.env.local`:

```bash
EXPO_PUBLIC_CEREBRAS_API_KEY=csk-...    # skip the first-launch key screen
# EXPO_PUBLIC_UNSPLASH_ACCESS_KEY=      # real semantic photos (else LoremFlickr)
# EXPO_PUBLIC_EXA_API_KEY=              # enables @Search live web data
# EXPO_PUBLIC_GENOS_MODEL=gemma-4-31b
# EXPO_PUBLIC_CEREBRAS_BASE_URL=        # any OpenAI-compatible endpoint
```

The system prompt ships pre-generated in
[src/genos/generated/system-prompt.ts](src/genos/generated/system-prompt.ts);
regenerate it with `npm run generate:prompt` when the component contract
changes.

### Tools run in the app

- **Images** — the model references every image as a declarative
  `/api/img?q=keywords&seed=N&w=W&h=H` query; [tools/images.ts](src/genos/tools/images.ts)
  resolves it to LoremFlickr (no key) or an Unsplash search (with key).
- **Web search** — real tool calling (OpenAI-compatible `tools`). With an Exa
  key set, the model gets a `web_search` tool and calls it mid-conversation
  when a screen needs real facts — famous hotels, latest news, live prices;
  [stream.ts](src/genos/stream.ts) executes the calls and feeds results back
  as `tool` messages until the model streams the screen, composed from the
  results with a sources footnote. Tool use is model-decided — no keyword
  heuristics — and refused for speculative prefetches so quota only burns on
  screens the user actually opens.

## How the port maps to the web app

| Web | Native |
| --- | --- |
| `@openuidev/react-lang` 0.2.8 | **0.1.5 pinned** (0.2.x has a bug under React Native) + a `patch-package` patch swapping the Renderer's two DOM `<div>` wrappers for Fragments |
| `tagSchemaId(s, "ActionExpression")` | one shared `z.any()` registered in `z.globalRegistry` under that id (in [contract.tsx](src/genos/ui/contract.tsx)) — it must be a **single instance**, duplicate ids break JSON-schema conversion |
| `cupertino.css` / `genos.css` | per-design-system token files ([cupertino/theme.ts](src/genos/ui/cupertino/theme.ts), [material/theme.ts](src/genos/ui/material/theme.ts)), light/dark via `useColorScheme()` |
| Cupertino components (DOM) | contract + per-platform renderers (see **Design systems** below) |
| recharts via `@openuidev/react-ui` | shared `react-native-svg` chart geometry, themed per design system ([shared/charts.tsx](src/genos/ui/shared/charts.tsx)) |
| react-ui form machinery | RN forms wired through react-lang's form context (per design system) |
| `MapView` keyless Google iframe | same embed in a `react-native-webview` |
| SSE via browser `fetch` | `expo/fetch` streaming ([src/genos/stream.ts](src/genos/stream.ts)) |
| drag-drop / paste an image | dropped in v1 (like voice) |
| phone bezel + fake status bar + touch cursor | the device is the phone |
| Esc key | Android hardware back |
| Web Speech voice input | dropped in v1 |

Because component names, props and descriptions mirror the web library
exactly, the backend's generated system prompt drives both apps unchanged —
no prompt regeneration step here.

## Design systems

The model-facing surface and the design languages are split so platforms can
diverge visually without ever drifting the prompt:

- [`ui/contract.tsx`](src/genos/ui/contract.tsx) — the **single source of
  truth** for component names, prop schemas and descriptions (what generates
  the system prompt). `buildGenosLibrary(renderers)` composes a library from
  any renderer set. It must run once per bundle (zod registers schemas
  globally by name), which Metro's platform file resolution guarantees.
- [`ui/cupertino/`](src/genos/ui/cupertino) — iOS renderers: inset grouped
  lists, icon badges, segmented tabs, iOS switch. Used by
  [`library.ios.ts`](src/genos/library.ios.ts).
- [`ui/material/`](src/genos/ui/material) — Android renderers: Material 3
  tonal surfaces (static palette seeded from the brand indigo `#5e5ce6`),
  list rows with ripple + tonal icon circles, filter chips with checkmarks,
  underline tabs, outlined text fields, filled/tonal/text buttons, native
  Material switch. Used by
  [`library.android.ts`](src/genos/library.android.ts).
- [`ui/shared/charts.tsx`](src/genos/ui/shared/charts.tsx) — chart geometry
  shared by all design systems via `createChartRenderers(useChartTheme)`.
- The shell chrome follows suit: [`theme.android.ts`](src/genos/theme.android.ts)
  maps the M3 tokens onto the shell theme shape, so the back pill, apps
  button and error screen are tonal Material on Android with no shell-code
  changes. A future Liquid Glass pass is just a new renderer set + flipping
  the import in `library.ios.ts`.

## Tests

```bash
npm test    # renders the web app's prompt exemplar screens through the full
            # parser → Renderer → RN component pipeline (jest-expo, headless),
            # for BOTH the Cupertino and Material renderer sets
```
