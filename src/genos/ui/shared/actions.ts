/** Action dispatch shared by all design systems. */
import type { ActionPlan } from "@openuidev/react-lang";
import { useTriggerAction } from "@openuidev/react-lang";

/**
 * Tap handler for actionable elements: label is the fallback message when no
 * action is given. Taps mid-stream are NOT swallowed here - the shell decides
 * (and toasts), so a tap never silently does nothing.
 */
export function useTap(label: string | undefined, action: unknown) {
  const triggerAction = useTriggerAction();
  if (!action) return undefined;
  return () => {
    triggerAction(label ?? "", undefined, action as ActionPlan);
  };
}
