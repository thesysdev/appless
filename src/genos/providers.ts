export interface ProviderDef {
  id: string;
  name: string;
  domain: string;
  homepage: string;
  tile: [string, string];
  fallbackGlyph: string;
}

const PROVIDERS: Record<string, ProviderDef> = {
  firecrawl: {
    id: "firecrawl",
    name: "Firecrawl",
    domain: "firecrawl.dev",
    homepage: "https://firecrawl.dev",
    tile: ["#fa5d3b", "#f59e0b"],
    fallbackGlyph: "globe",
  },
};

export function getProvider(id: string): ProviderDef | undefined {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, id) ? PROVIDERS[id] : undefined;
}

export function raycastFaviconUrl(domainOrUrl: string, size = 64): string | null {
  try {
    const input = domainOrUrl.trim();
    if (!input) return null;

    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (url.protocol !== "https:" || !url.hostname) return null;

    const safeSize = Number.isFinite(size) ? Math.min(256, Math.max(16, Math.trunc(size))) : 64;
    return `https://api.ray.so/favicon?url=${encodeURIComponent(url.hostname)}&size=${safeSize}`;
  } catch {
    return null;
  }
}
