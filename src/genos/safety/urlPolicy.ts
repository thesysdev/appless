/**
 * Outbound-link policy. A generated screen can attach any URL string to a tap
 * (@OpenUrl) and model output is untrusted, so only http(s) links ever reach
 * Linking. Everything else (javascript:, intent:, tel:, sms:, file:, third-
 * party app schemes, universal links) is blocked and reported via onBlocked.
 * The scheme is parsed by hand - Hermes' URL support for odd schemes varies.
 */
import { Linking } from "react-native";

/** Schemes a model-supplied link may use. */
const ALLOWED_SCHEMES = new Set(["https:", "http:"]);

/** Scheme prefix of a URL, lowercased with trailing colon; null if none. */
export function urlScheme(raw: string): string | null {
  const m = raw.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return m ? `${m[1].toLowerCase()}:` : null;
}

/** True when a raw URL is openable under the scheme allowlist. */
export function isAllowedExternalUrl(raw: string): boolean {
  const scheme = urlScheme(raw);
  return scheme !== null && ALLOWED_SCHEMES.has(scheme);
}

/**
 * Open an external link when policy allows it; blocked links call onBlocked
 * instead (the shell shows a toast). Open failures are swallowed, matching
 * the previous behavior - a dead link must not crash the shell.
 */
export function openExternalUrl(raw: string, onBlocked: () => void) {
  if (!isAllowedExternalUrl(raw)) {
    onBlocked();
    return;
  }
  Linking.openURL(raw.trim()).catch(() => {});
}
