/**
 * genos:// deep-link hardening. Deep links come from model output, so the
 * open target and payloads are validated before the shell acts on them: the
 * target must be a known catalog app or the safe summon-id shape, the request
 * is length-capped (it is injected verbatim as the user message of a new
 * generation - an unbounded one is a cross-app prompt-injection channel),
 * and toast text is capped so a poisoned screen can't spoof long system-
 * looking messages.
 */
import { APPS } from "../apps";

/** Longest request payload a genos://open link may carry. */
export const GENOS_REQUEST_MAX = 300;
/** Longest text a genos://toast link may show. */
export const GENOS_TOAST_MAX = 120;

/** Safe app-id shape: covers every catalog id and summon-* slugs. */
const APP_ID_RE = /^[a-z0-9-]{1,32}$/;

/** App ids a genos://open link may target (catalog ids + safe slug shape). */
export function isAllowedAppId(raw: string): boolean {
  const id = raw.trim().toLowerCase();
  return APP_ID_RE.test(id) || APPS.some((a) => a.id === id);
}

export interface OpenLinkParams {
  appId: string;
  request: string;
}

/** Validated genos://open params; null when anything is missing or unsafe. */
export function parseOpenLink(params: Record<string, string>): OpenLinkParams | null {
  const app = params.app?.trim();
  const request = params.request?.trim();
  if (!app || !request || !isAllowedAppId(app)) return null;
  return { appId: app.toLowerCase(), request: request.slice(0, GENOS_REQUEST_MAX) };
}

/** Toast text from a genos://toast link, length-capped. */
export function capToastText(raw: string): string {
  return raw.slice(0, GENOS_TOAST_MAX);
}
