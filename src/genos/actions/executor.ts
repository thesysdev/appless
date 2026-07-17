/**
 * Pluggable action executors. The default SimulatedExecutor keeps today's
 * behavior - an action only ever generates the next screen - and records an
 * honest receipt saying so. registerExecutor() is the seam the README's
 * "make it real" integrations (DoorDash, Plaid, ...) plug into later: a real
 * executor performs the integration and returns its own honest outcome note.
 *
 * Invariant: executors run ONLY from explicit post-confirmation taps in the
 * shell. They are never called from prefetch or any speculative generation
 * path - a speculative screen must never fire a side effect.
 */
import { SIMULATED_NOTE, receipts } from "./receipts";

export interface ConfirmedAction {
  appId: string;
  /** The action message the user explicitly confirmed. */
  label: string;
}

export interface ActionExecutor {
  /**
   * Run a confirmed action. Returns the honest outcome note the shell shows
   * as the receipt toast ("Simulated - ..." today, something real later).
   */
  run(action: ConfirmedAction): string | void;
}

/** Default executor: nothing real happens - record the receipt and say so. */
class SimulatedExecutor implements ActionExecutor {
  run(action: ConfirmedAction): string {
    receipts.record({
      appId: action.appId,
      label: action.label,
      tier: "consequential",
      status: "confirmed-simulated",
    });
    return SIMULATED_NOTE;
  }
}

let current: ActionExecutor = new SimulatedExecutor();

/** Swap in another executor (real integration, test spy); returns the old. */
export function registerExecutor(next: ActionExecutor): ActionExecutor {
  const prev = current;
  current = next;
  return prev;
}

/** Run a post-confirmation action through the registered executor. */
export function executeConfirmed(action: ConfirmedAction): string | void {
  return current.run(action);
}
