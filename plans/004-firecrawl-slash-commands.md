# Plan 004: Add the Firecrawl slash-command catalog and menu

> **Executor instructions**: Implement only after Plans 002 and 003 are DONE.
> Follow each verification gate and stop on any STOP condition. Update the row in
> `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 9867af9 -- src/genos/apps.ts src/genos/GenOS.tsx src/genos/shell/HomeScreen.tsx src/genos/shell/Switcher.tsx src/genos/providers.ts src/genos/tools src/genos/workflows.ts`
> Plans 002 and 003 are expected to change these paths. Confirm their done
> criteria and adapt only names, not architecture.

## Status

- **Priority**: P1
- **Effort**: M (a day-ish)
- **Risk**: MED
- **Depends on**: `plans/002-provider-favicons.md`,
  `plans/003-firecrawl-runtime.md`
- **Category**: direction
- **Planned at**: commit `9867af9`, 2026-08-16, with uncommitted UI changes

## Why this matters

Users need a discoverable way to invoke Firecrawl's base operations and its
specialized workflows from the existing "Ask for anything" field. A typed command
catalog and filtered slash menu provide that surface while keeping ordinary
natural-language routing unchanged. Each command must launch a provider-branded
session with its own onboarding inputs and workflow contract, not merely prepend
a decorative command name to a generic prompt.

## Current state

- `src/genos/shell/HomeScreen.tsx:318-349` owns a plain `ask` string and submits
  it unchanged through `onCommand`.
- `src/genos/shell/HomeScreen.tsx:438-479` renders the only ask input; there is no
  command menu or selected-command state.
- `src/genos/GenOS.tsx:490-536` routes OS intents, known apps, active-app actions,
  and generic summoned apps. It does not parse a leading slash.
- `src/genos/apps.ts:114-121` can create a generic summoned app but has no
  workflow command helper.
- Plan 002 adds provider metadata and Firecrawl favicon rendering.
- Plan 003 adds `workflowId`, provider availability, Firecrawl BYOK, and the real
  execution runtime.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run typecheck` | exit 0 |
| Command tests | `npm test -- --runInBand --no-watchman __tests__/commands.test.tsx` | all pass |
| Full tests | `npm test -- --runInBand --no-watchman` | all pass |

## Scope

**In scope**:

- `src/genos/commands.ts` (create)
- `src/genos/shell/CommandMenu.tsx` (create)
- `src/genos/shell/WorkflowSetup.tsx` (create)
- `src/genos/shell/HomeScreen.tsx`
- `src/genos/GenOS.tsx`
- `src/genos/apps.ts`
- Provider/workflow registries created by Plans 002 and 003
- `__tests__/commands.test.tsx` (create)
- `__tests__/store.test.ts` for launched workflow metadata
- `README.md`

**Out of scope**:

- Reimplementing Firecrawl network clients
- Importing local `SKILL.md` files at runtime
- File/CSV upload, download/export, CRM writeback, or outreach sending
- Executing disabled commands without a Firecrawl key
- Adding command palettes for unrelated providers
- Changing ordinary OS intent routing

## Git workflow

- Branch: `advisor/004-firecrawl-slash-commands`
- Match imperative sentence-case commit messages.
- Keep catalog/parser, UI, and routing/tests as separable logical commits.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define the command contract and catalog

Create `src/genos/commands.ts` with a typed immutable definition such as:

```ts
interface SlashCommandDef {
  id: string;                 // exact slash name without '/'
  title: string;
  description: string;
  providerId: "firecrawl";
  workflowId: string;
  inputHint: string;
  availability: "enabled" | "needs-key" | "unavailable";
}
```

Seed the catalog with the complete currently installed Firecrawl workflow set:

- `/firecrawl`
- `/firecrawl-company-directories`
- `/firecrawl-competitive-intel`
- `/firecrawl-dashboard-reporting`
- `/firecrawl-deep-research`
- `/firecrawl-demo-walkthrough`
- `/firecrawl-knowledge-base`
- `/firecrawl-knowledge-ingest`
- `/firecrawl-lead-gen`
- `/firecrawl-lead-research`
- `/firecrawl-market-research`
- `/firecrawl-qa`
- `/firecrawl-research-papers`
- `/firecrawl-seo-audit`
- `/firecrawl-shop`
- `/firecrawl-website-design-clone`
- `/firecrawl-workflows`

Only mark a command `enabled` when Plan 003 has a corresponding trusted workflow
contract and backend path. Completion requires every command above to be
runnable; `unavailable` exists for a runtime/config failure, not as a placeholder
for unfinished implementation. Future workflows should remain a data change plus
contract/tests, not another HomeScreen rewrite.

`/firecrawl` is the base router: known URL -> scrape; search-like query -> search;
complex autonomous structured task -> offer Agent with an explicit cost/depth
choice. It must not guess a costly Agent mode silently.

**Verify**: catalog unit tests assert unique IDs, valid provider/workflow IDs,
stable ordering, and no enabled command without runtime support.

### Step 2: Add pure parsing and filtering

Export pure helpers:

- `parseSlashCommand(text)`: recognize a command only at the beginning, split
  exact command ID from the remaining argument, and report unknown commands;
- `filterSlashCommands(text)`: while the input begins with `/`, match ID, title,
  and keywords case-insensitively;
- `commandToApp(command, argument)`: create an `AppDef` with a stable unique app
  ID, Firecrawl provider ID, workflow ID, a human-readable session name, and a
  request that includes user arguments but not secrets.

Do not use prefix matching for execution: `/firecrawl-lead` must not execute
`/firecrawl-lead-gen`. Preserve spaces and URLs in the argument. Cap user input
length consistently with the Firecrawl API.

**Verify**: tests cover exact match, partial filtering, unknown command, empty
argument, URL with query string, mixed case, leading whitespace policy, and
command injection-like text after the argument.

### Step 3: Build the inline command menu

Create `src/genos/shell/CommandMenu.tsx` and render it adjacent to the existing
ask field when the current input begins with `/`.

Required behavior:

- results filter live as the user types;
- every row shows `ProviderIcon(providerId)`, exact slash ID, title/description,
  and enabled/needs-key/unavailable state;
- tapping an enabled row selects it and leaves focus in the argument input;
- tapping a needs-key row opens the Firecrawl provider key gate from Plan 003;
- unavailable rows cannot execute and explain their state accessibly;
- keyboard/web controls support up/down, Enter, and Escape;
- native controls support tap, dismissal, and screen-reader labels;
- the menu stays within safe area/keyboard bounds and uses the existing glass
  visual language plus the global Inter typography;
- empty filtered results show a small non-actionable state, not a generic LLM
  request.

Do not replace the current rotating suggestion rows. Hide or visually de-emphasize
them only while the slash menu is open to avoid competing tap targets.

**Verify**: render tests cover closed, filtered, selected, disabled, key-required,
empty, and accessibility states.

### Step 4: Route commands before generic natural language

In `GenOS.routeCommand`, parse slash commands before known-app and generic summon
routing, but after direct OS navigation commands if the existing ordering needs
to remain authoritative.

For a recognized enabled command:

- require a present Firecrawl key or show the provider key gate;
- validate the required inputs from the command contract;
- launch the provider/workflow `AppDef` through the existing `launch` path so
  session, minimize, resume, switcher, retry, and close behavior remains shared;
- never execute a command inside an unrelated active app as a child of that app;
  a leading slash starts/switches to a provider session;
- keep the full user argument as the factual task input, while the compact
  trusted workflow contract comes from `workflowId`.

Unknown slash commands must produce a deterministic menu/error state and must
not be sent to Cerebras as a generic app request.

**Verify**: route tests assert known command launch metadata, provider/workflow
identity, missing-key behavior, unknown command behavior, and unchanged natural
language/OS routing.

### Step 5: Add deterministic onboarding for workflow-specific inputs

Each enabled workflow must define required inputs and a deterministic first
screen when they are missing:

- company directories: directory URL/name, optional filters, result cap, output
  view;
- deep research: topic and mandatory quick/thorough/exhaustive runtime/depth;
- lead gen: target, source/auth note, lead cap, output view;
- lead research: company or URL, optional person, meeting context;
- base Firecrawl: URL or query and explicit operation choice when ambiguous.

Create one shell-owned `WorkflowSetup` form driven by typed field definitions in
the workflow registry. Support text, URL, bounded number, select, and checkbox
fields; do not hand-build 17 forms or rely on the LLM to invent required inputs.
Validate locally, show the selected maximum credit cap, and only then create the
workflow `AppDef`. Do not start a paid Agent job until required fields and
budget/depth confirmation are present. Do not ask more than the contract
requires.

The in-app deliverable is an app screen, so adapt file-oriented skill outputs as:

- a concise summary/current progress screen;
- structured tables/lists and data-gap sections;
- source links;
- follow-up actions for details or next pages.

Do not claim that CSV/JSON was exported until export exists.

**Verify**: tests assert incomplete commands produce onboarding without a
Firecrawl POST, and complete commands produce exactly one job/search/scrape.

### Step 6: Verify the complete command/session flow

Run full automated tests, then manually exercise:

1. type `/fir` and select `/firecrawl`;
2. enter a public URL and run a low-cost scrape;
3. minimize the result and verify Firecrawl favicon on home;
4. open switcher and verify provider metadata;
5. launch `/firecrawl-lead-research <small public company>` with a low cap;
6. cancel an in-flight task and verify no duplicate rerun;
7. remove/reject the key and verify ordinary AppLess prompts still work;
8. try an unknown command and simulate an unavailable-provider state.

Update README with command syntax, enabled catalog, key/cost warning, and the
distinction between in-app structured views and future CSV/export support.

**Verify**: `npm run typecheck` and
`npm test -- --runInBand --no-watchman` both exit 0.

## Test plan

- `__tests__/commands.test.tsx`: registry integrity, parser/filter, menu states,
  keyboard/tap selection, and accessibility.
- `__tests__/store.test.ts`: launched app has provider/workflow metadata and
  children inherit it.
- Mocked integration test: command -> onboarding -> one tool call -> formatted
  result screen metadata.
- Existing render and tool suites remain green.
- Manual low-credit device checks listed in Step 6.

## Done criteria

- [ ] Typing `/` opens a filtered provider command menu.
- [ ] The catalog contains every listed Firecrawl workflow and all are runnable
      when a valid key/provider connection is present.
- [ ] Commands are enabled only when their runtime contract works.
- [ ] No paid call starts before required inputs and budget/depth selection.
- [ ] Unknown commands never fall through to generic Cerebras generation.
- [ ] Firecrawl sessions retain provider favicon and workflow identity through
      home and switcher flows.
- [ ] Missing/rejected Firecrawl credentials do not block ordinary app use.
- [ ] Typecheck and complete no-Watchman tests pass.
- [ ] README documents syntax, enabled status, costs, and limitations.
- [ ] `plans/README.md` status is updated.

## STOP conditions

Stop and report if:

- Plans 002 or 003 are not complete;
- a listed enabled command has no trusted workflow contract or explicit credit
  policy;
- command invocation would require reading local Codex skill files at runtime;
- the menu cannot remain usable above the native keyboard/safe area;
- the requested deliverable requires file export or authenticated browser
  sessions not authorized for this scope.

## Maintenance notes

- The catalog should be generated from typed data, never duplicated across menu,
  parser, and router.
- Reviewers should scrutinize exact-match execution, disabled states, key gates,
  cost confirmation, accessibility, and command behavior inside an active app.
- When additional Firecrawl workflows are added, add their compact trusted
  contract and runtime tests before exposing them in the catalog.
