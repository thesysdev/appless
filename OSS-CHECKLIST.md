# applessOS native — open-source checklist

Target: a standalone, clone-and-run repo. `git clone → npm install → npm run ios → paste your Cerebras key in onboarding`. No backend.

## 0. Blockers (do these first)

- [ ] **Rotate all dev API keys** before publishing anything (Cerebras, Exa) and never commit them.
- [x] **Replace `LICENSE`** — now MIT, Copyright (c) 2026 Thesys Inc.; `"license": "MIT"` added to package.json.
- [ ] **Extract to a fresh public repo** with clean history (`git init`, not a filtered export) so no private history ships.
- [x] **Audit tracked files**: `AGENTS.md` rewritten (SDK 54 pin note); this checklist is a working doc — drop or keep deliberately at extraction time.
- [ ] Verify the `@openuidev/react-lang` license permits redistributing patched `dist/` code in `patches/` (patch-package style). If MIT, note it in the patch header.

## 1. Feature: backend removal (BYOK, frontend-direct) — ✅ DONE (2026-07-15)

The Next server did three things; all three moved client-side:

- [x] **Direct Cerebras streaming** — `stream.ts` calls `CEREBRAS_BASE_URL/chat/completions` with the user's key and prepends the system prompt + "Today is …" line itself. Verified live with the backend stopped; the API sends `access-control-allow-origin: *`, so the web target works too.
- [x] **System prompt in-repo** — embedded as `src/genos/generated/system-prompt.ts` via `npm run generate:prompt` (`scripts/embed-prompt.mjs`).
  - [ ] Follow-up: generate from the native `ui/contract.tsx` via `@openuidev/cli` instead of the web repo's txt, and add a CI freshness check (regen produces no diff).
- [x] **Client-side image resolution** — `src/genos/tools/images.ts` parses the `/api/img?q=…&seed=N&w=W&h=H` contract: LoremFlickr keyless default, Unsplash search + per-query cache when `EXPO_PUBLIC_UNSPLASH_ACCESS_KEY` is set.
  - [ ] Follow-up: Unsplash attribution line/screen (required by their API guidelines).
- [x] **Key management** — `expo-secure-store` (localStorage on web), first-launch `KeyGate` screen, 401/403 auto-clears the key and re-shows the gate, `EXPO_PUBLIC_CEREBRAS_API_KEY` env bypass for dev.
  - [ ] Follow-up: validate pasted key with a 1-token test call before accepting.
  - [ ] Follow-up: settings surface to change key/model/base URL at runtime (base URL env override already enables Ollama/OpenRouter).
  - [x] README security note: BYOK is for personal/dev use.

## 2. Feature: web search — ✅ DONE (real tool calling, 2026-07-15)

Implemented as genuine OpenAI-compatible **tool calling** (verified supported by Cerebras, streaming included): `stream.ts` runs an agentic loop — rounds that finish in `tool_calls` execute the tools and append `tool` messages until the model streams the screen.

- [x] `web_search` tool (Exa, `tools/search.ts`) offered whenever `EXPO_PUBLIC_EXA_API_KEY` is set; up to 3 tool rounds, then tools are withheld to force a screen. Tool errors return ERROR strings so the model degrades honestly instead of failing the screen.
- [x] Prompt section: call web_search first for real-world/current facts (famous hotels, news, prices), compose strictly from results, cite source domains in a footnote.
- [x] Verified end-to-end against real Cerebras with stubbed Exa results: "famous hotels in Goa" → model called `web_search`, then rendered all 5 result hotels with real prices/ratings + Sources footnote.
- [x] Speculative prefetches refuse tool rounds (quota protection) — they error silently and regenerate fresh (tools allowed) on tap.
- [x] Optional key, graceful degradation: no Exa key → no tools offered, no prompt section.
- [ ] Follow-up: pluggable provider interface (Tavily/Brave adapters).
- [ ] Follow-up: live-test the Exa HTTP call with a real key (loop verified; Exa client unit-tested only).

## 3. Feature: image search — ✅ DONE (see §1 image resolution)

- [x] LoremFlickr zero-config default (verified live in-app).
- [x] Unsplash quality upgrade behind optional key (ported from the old `/api/img` route, same cache/seed semantics).
- [x] Skipped Google Images: no real API (Custom Search JSON API is 100 free queries/day + engine setup — bad DX for an OSS demo). Pexels is a reasonable third adapter if someone asks.

## 4. Code standards

- [x] `npm run typecheck` (`tsc --noEmit`) — added; passes.
- [ ] ESLint (`eslint-config-expo`) + Prettier configs — the native repo has none (the web repo does).
- [ ] CI (GitHub Actions): install (runs patch-package) → typecheck → lint → `npm test` on Node LTS. Include the prompt-freshness check from §1.
- [ ] Broaden tests: pure-function units for `cleanLang`, `parseOsCommand`, `extractActions`, prefetch/`resolveAction` cache logic, and the SSE parser in `stream.ts` (feed recorded chunk fixtures). The render smoke tests for both design systems are a great base.
- [ ] Consider CI running the exemplar programs through **both** libraries with platform mocked, which `render-material.test.tsx` already does — keep that invariant.

## 5. Repo presentation

- [ ] README rewrite for standalone: hero GIF (record simulator: home → ask → screen streams in → tap row), quick start (3 commands + key), architecture section, "how is this different from the web appless-os" link.
- [ ] `ARCHITECTURE.md`: contract vs renderers split, streaming pipeline (50ms flush, why), prefetch design, the react-lang 0.1.5 patch story, per-platform Metro resolution. (Most of this exists in README/code comments — consolidate.)
- [ ] `CONTRIBUTING.md`: dev setup, how to add a component (contract + both renderers + prompt regen + test), how to add a design system (`GenosRenderers` impl + `library.<platform>.ts`).
- [ ] `CODE_OF_CONDUCT.md`, `SECURITY.md` (key-handling policy, how to report), issue + PR templates.
- [ ] `.env.example` documenting `EXPO_PUBLIC_*` vars that remain.
- [ ] `app.json` polish: real display name ("applessOS"), bundle identifiers (`ios.bundleIdentifier`, `android.package`) for dev builds, description.
- [x] Document the Expo Go pinning (SDK 54 to match the Play Store build — README + AGENTS.md) and the react-lang 0.1.5 pin + patch rationale prominently — the two most surprising constraints for contributors.
- [ ] Signed (negative) domains for cartesian charts — negatives currently clamp to 0 by documented design.
- [ ] Store eviction: `screens`/`actionIndex`/`appHomeIndex`/`deepLinkIndex` grow for the session lifetime; add LRU eviction that spares screens on active stacks.
- [ ] GitHub: topics (`react-native`, `expo`, `generative-ui`, `llm`), social preview image, discussions on/off decision.

## 6. Nice-to-have (post-launch)

- [ ] EAS build profiles for installable dev builds.
- [ ] Voice input (dropped in v1; Expo speech APIs).
- [ ] Liquid Glass renderer set (the architecture already anticipates it: new renderer dir + flip the import in `library.ios.ts`).
- [ ] Screen-history persistence across restarts (AsyncStorage snapshot of `screenStore` + sessions).
