/**
 * Action risk model. Every model-declared action arrives as a free-text
 * message (@ToAssistant), so classification is a small documented heuristic
 * over its wording: navigation/read-shaped taps auto-execute (today's
 * behavior), while consequential verbs - anything that reads as moving
 * money, sending messages, or destroying data - pause for an explicit
 * confirmation first. False positives only cost a confirmation tap (safe
 * direction); false negatives behave exactly as before this layer existed.
 */
export type ActionTier = "auto" | "consequential";

/**
 * Verbs that make an action consequential, matched as whole words so
 * "show my messages", "my books", and "text formatting" stay auto.
 */
const CONSEQUENTIAL_RE =
  /\b(order|buy|purchase|pay|payment|charge|book|booking|reserve|reservation|send|transfer|delete|cancel|subscribe|post|share|message|text|call)\b/i;

/** Classify a tapped action message into a risk tier. */
export function classifyAction(message: string): ActionTier {
  return CONSEQUENTIAL_RE.test(message) ? "consequential" : "auto";
}
