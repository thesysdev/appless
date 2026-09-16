/**
 * Semantic image tool. The prompt makes the model reference every image as
 * /api/img?q=KEYWORDS&seed=N&w=W&h=H - a declarative query, never a real URL.
 * These resolve to LoremFlickr with no key (zero-config), or an Unsplash search
 * when EXPO_PUBLIC_UNSPLASH_ACCESS_KEY is set (real semantic photos; attribution
 * required by Unsplash guidelines).
 */
import { useEffect, useReducer } from "react";
import { UNSPLASH_ACCESS_KEY } from "../../config";

export interface ImgQuery {
  q: string;
  seed: number;
  w: number;
  h: number;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

/** Parse an /api/img?... reference; null for any other src. */
export function parseImgUrl(src: string): ImgQuery | null {
  if (!src.startsWith("/api/img")) return null;
  const params: Record<string, string> = {};
  for (const pair of (src.split("?")[1] ?? "").split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    try {
      params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      params[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
  }
  const q = (params.q || "abstract gradient")
    .replace(/\+/g, " ")
    .replace(/[^a-zA-Z0-9, -]/g, "")
    .trim();
  return {
    q,
    seed: clamp(parseInt(params.seed || "1", 10), 1, 10_000),
    w: clamp(parseInt(params.w || "800", 10), 40, 1600),
    h: clamp(parseInt(params.h || "500", 10), 40, 1600),
  };
}

export function loremflickrUrl({ q, seed, w, h }: ImgQuery): string {
  const keywords = encodeURIComponent(q.replace(/[ ,]+/g, ","));
  return `https://loremflickr.com/${w}/${h}/${keywords}?lock=${seed}`;
}

/** query → Unsplash raw URLs; empty array = search failed, use LoremFlickr. */
const unsplashCache = new Map<string, string[]>();
const unsplashPending = new Map<string, Promise<void>>();

function ensureUnsplash(q: string): Promise<void> {
  const pending = unsplashPending.get(q);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=10`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } },
      );
      const json = res.ok
        ? ((await res.json()) as { results?: Array<{ urls?: { raw?: string } }> })
        : {};
      unsplashCache.set(
        q,
        (json.results ?? []).map((r) => r.urls?.raw).filter((u): u is string => !!u),
      );
    } catch {
      unsplashCache.set(q, []);
    } finally {
      unsplashPending.delete(q);
    }
  })();
  unsplashPending.set(q, p);
  return p;
}

/**
 * Resolve a generated src to a loadable URL. Non-semantic srcs pass through.
 * With an Unsplash key, returns undefined (placeholder) while the search is
 * in flight so the image doesn't double-load.
 */
export function useSemanticImage(src?: string): string | undefined {
  const parsed = src ? parseImgUrl(src) : null;
  const q = parsed && UNSPLASH_ACCESS_KEY ? parsed.q : null;
  const [, bump] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    if (!q) return;
    // The shared fetch may have resolved between render and this effect -
    // bump once so the render-path cache read below picks it up (otherwise
    // this instance would show the placeholder forever).
    if (unsplashCache.has(q)) {
      bump();
      return;
    }
    let live = true;
    ensureUnsplash(q).then(() => {
      if (live) bump();
    });
    return () => {
      live = false;
    };
  }, [q]);

  if (!src) return undefined;
  if (!parsed) return src;
  if (!q) return loremflickrUrl(parsed);
  const candidates = unsplashCache.get(parsed.q);
  if (candidates === undefined) return undefined; // still searching
  if (candidates.length === 0) return loremflickrUrl(parsed);
  const raw = candidates[parsed.seed % candidates.length];
  return `${raw}&w=${parsed.w}&h=${parsed.h}&fit=crop&q=80`;
}
