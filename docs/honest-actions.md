# Honest Actions: confirmation + receipts

AppLess's README warns that actions are always simulated - "Order placed",
"flight booked", "payment sent" do nothing and reflect no real state. This
layer makes that honesty *structural*: consequential taps pause for an
explicit confirmation, every outcome leaves a receipt that says what actually
happened, and the default executor says "simulated" out loud instead of
letting a toast imply success.

## Risk tiers

Every model-declared action arrives as a free-text message (`@ToAssistant`),
so classification is a small documented heuristic over its wording
(`src/genos/actions/model.ts`):

| Tier | Shape | Behavior |
| --- | --- | --- |
| `auto` | navigation/read ("Open the Wi-Fi screen", "Show my messages") | executes immediately - today's behavior, unchanged |
| `consequential` | order/book/pay/send/delete-shaped verbs, whole-word matched | pauses on the confirmation sheet |

False positives only cost a confirmation tap (the safe direction); false
negatives behave exactly as before this layer existed.

## Flow

```
tap -> handleAction -> classifyAction
  auto           -> resolveAction (unchanged)
  consequential  -> confirmation sheet:
                      "<the action message>"
                      "AppLess will simulate this action.
                       Nothing real is charged or booked."
                      [Cancel] [Confirm]
    Confirm -> executeConfirmed(...) -> receipt (confirmed-simulated)
               -> honest receipt toast -> resolveAction proceeds
    Cancel  -> receipt (declined) -> nothing else happens
```

## Executor registry

`src/genos/actions/executor.ts` is the seam the README's "make it real"
integrations (DoorDash, Plaid, Spotify, ...) plug into:

```ts
interface ActionExecutor {
  // Returns the honest outcome note shown as the receipt toast.
  run(action: { appId: string; label: string }): string | void;
}
registerExecutor(myExecutor); // swap in a real integration; returns the old one
```

The default `SimulatedExecutor` records a `confirmed-simulated` receipt and
returns the note `Simulated - no real order was placed`. A real executor
performs its integration and supplies its own honest note - the shell never
hardcodes a success claim.

## The no-prefetch invariant

Executors run **only** from explicit post-confirmation taps. They are never
called from prefetch or any speculative generation path - a speculative
screen must never fire a side effect. This is enforced by construction (the
store's prefetch machinery has no reference to the executor registry) and
covered by a regression test that drives prefetch with a consequential
action while a spy executor is registered.

## Receipts

`src/genos/actions/receipts.ts` is a `useSyncExternalStore`-shaped log
(mirroring `config.ts`'s KeyStore): `{ id, appId, label, tier, status,
timestamp }`, newest first, where status is `confirmed-simulated` or
`declined`. A declined tap is recorded too - the trail covers what was *not*
done, which is what an audit or undo surface needs.

## Thesys Agentic Interface Framework mapping

- **D19/D20 (Keep control: approvals, "show exactly what will happen")** -
  consequential actions require explicit approval, and the sheet states the
  outcome up front: simulation, nothing charged or booked.
- **D34 (Expect failure: rollback)** - true rollback needs real state to
  revert, which does not exist yet; the receipt log is its prerequisite,
  giving every confirmed and declined action a durable, inspectable record.

## Honest limits

- The tier heuristic is lexical: "show payment history" pauses (false
  positive), and a consequential request phrased without the verb list does
  not (false negative). Both failure modes are documented, and the safe
  direction is the default.
- Typed/ask-bar commands bypass the sheet by design - the user already
  typed the intent explicitly; only model-proposed taps are gated.
- Receipts are in-memory for the session; persistence is future work.
- There is no receipts UI yet - the log is consumable via
  `useSyncExternalStore(receipts.subscribe, receipts.getReceipts)`.
