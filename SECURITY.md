# Security Policy

## Reporting a vulnerability

AppLess is a demo, but it handles API keys and renders model-generated UI, so
vulnerability reports are taken seriously. Please do **not** open a public
issue for a security problem. Report it privately through GitHub's "Report a
vulnerability" flow on the repository (Security tab). Include a repro, the
affected commit, and whether keys or user data are exposed. We aim to
acknowledge reports within 7 days.

## Scope notes

- BYOK keys are stored on-device (SecureStore on iOS/Android; `localStorage`
  on web, which is readable by any XSS - web is a dev surface).
- `EXPO_PUBLIC_*` env keys are inlined into the JS bundle at build time.
  Never ship a production build with them set.

## Hardening notes

Everything the model emits is treated as untrusted output. These runtime
guards enforce what the system prompt can only request:

- **Outbound links** - only `http:`/`https:` URLs reach `Linking`; every other
  scheme (`javascript:`, `intent:`, `tel:`, `sms:`, `file:`, app schemes) is
  blocked with a toast. See `src/genos/safety/urlPolicy.ts`, wired into
  `GenOS.handleAction`.
- **Image hosts** - a model-supplied image URL resolves only when it is an
  https URL on `images.unsplash.com`, `loremflickr.com`, or
  `upload.wikimedia.org`; anything else falls back to the keyless LoremFlickr
  semantic path. This closes the "image URL with encoded conversation
  context" exfiltration channel. See `src/genos/tools/images.ts`.
- **`genos://` deep links** - `genos://open` targets must be catalog apps or
  the safe summon-id shape; the injected request is capped at 300 chars, and
  `genos://toast` text at 120 chars. See `src/genos/safety/genosLink.ts`,
  applied at the `parseGenosUrl` callsite and again in `store.openDeepLink`.
- **Form redaction** - credential-shaped field values (`password`, `pin`,
  `cvv`, `otp`, `token`, ...) are replaced with `"[redacted]"` before
  submitted form state is sent to the model provider or replayed as
  conversation context. See `src/genos/safety/redaction.ts`, applied in
  `store.resolveAction`.
- **Key entry** - the API-key field is masked (`secureTextEntry`). See
  `src/genos/shell/KeyGate.tsx`.

## Honest limits

- Redaction keys off field **names**, not field type metadata (the type does
  not reach the store): a password field named `favoriteWord` is not
  redacted. Blocking credential screens outright is a contract-level decision
  left to upstream.
- Web-search tool results are still fed back to the model unmarked as
  untrusted data; injection-resistant tool-result handling is roadmap work,
  not shipped here.
- Provider error bodies are still surfaced raw in the UI; friendly error
  mapping is not part of this pass.
- Telemetry ships with the upstream PostHog key by default (see README);
  unchanged here.
- Prompt rules ("https links only", "use the image service", the fixed app
  list) remain advisory - the guards above are the enforcement.
