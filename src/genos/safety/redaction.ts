/**
 * Form-value redaction. Submitted formState is serialized into the next model
 * request and replays as conversation context (it leaves the device, to the
 * configured provider, possibly several times), so credential-shaped values
 * must be stripped first. Field type metadata does not reach resolveAction,
 * so redaction keys off the field NAME the model chose - password-type fields
 * follow the obvious naming convention, and common credential words are
 * covered too. Whole-word matching keeps "shopping" and "spinner" safe.
 */

/** Value substituted for a sensitive field. */
export const REDACTED = "[redacted]";

/** Words that mark a field name as credential-shaped. */
const SENSITIVE_WORDS = new Set([
  "password",
  "passwd",
  "passphrase",
  "passcode",
  "pin",
  "secret",
  "cvv",
  "cvc",
  "ssn",
  "otp",
  "token",
]);

/** Field names arrive camelCase / snake_case / kebab - split into words. */
function fieldWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when a field name reads as credential-shaped ("cardCvv", "user_pin"). */
export function isSensitiveField(name: string): boolean {
  return fieldWords(name).some((w) => SENSITIVE_WORDS.has(w));
}

/** Copy formState with sensitive values replaced by REDACTED. */
export function redactFormState(formState: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formState)) {
    out[key] = isSensitiveField(key) ? REDACTED : value;
  }
  return out;
}
