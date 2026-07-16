/**
 * Real tool calling (OpenAI-compatible `tools`). The model calls web_search
 * mid-conversation - famous hotels, latest news, live prices - the stream
 * loop executes it and feeds results back as `tool` messages, and the model
 * composes the screen FROM the results. Active only when
 * EXPO_PUBLIC_EXA_API_KEY is set; without it no tools are offered and the
 * model invents data.
 */
import { fetch as expoFetch } from "expo/fetch";
import { EXA_API_KEY } from "../../config";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

/** Appended to the system prompt only when tools are available. */
export const TOOLS_PROMPT_SECTION = `

## Live Data (web_search tool)
You have a REAL web_search tool. When a truthful screen needs real-world or current facts - latest news, live prices or scores, current weather, real venues (famous hotels, restaurants, attractions) in real places, current events - call web_search FIRST (1-3 focused queries), then compose the screen strictly from the returned facts: real names, real numbers, real dates. Finish such screens with a small TextContent("Sources: …", "small") footnote naming the source domains. If results are empty or the tool errors, build the screen from what you know and mark it clearly as possibly outdated. NEVER call tools for invented/personal content (messages, notes, playlists, settings, workouts) - invent that as usual.`;

/** OpenAI-format tool definitions sent with each request when available. */
export const TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the live web. Use for current or real-world facts: news, prices, scores, weather, events, and real places such as famous hotels, restaurants or attractions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Concise web search query" },
        },
        required: ["query"],
      },
    },
  },
];

export function toolsAvailable(): boolean {
  return !!EXA_API_KEY;
}

/**
 * Execute one tool call; returns the tool-message content. Failures return
 * an ERROR string (instead of throwing) so the model can degrade honestly.
 * The abort signal cancels the underlying fetch when the screen goes away.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  if (name !== "web_search") return `ERROR: unknown tool "${name}"`;
  const query = String(args.query ?? "").trim();
  if (!query) return "ERROR: web_search requires a non-empty query";
  try {
    return formatWebResults(query, await webSearch(query, signal));
  } catch (err) {
    return `ERROR: web search failed (${err instanceof Error ? err.message : String(err)})`;
  }
}

const domain = (url: string) => url.match(/^https?:\/\/(?:www\.)?([^/]+)/)?.[1] ?? url;

export async function webSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const res = await expoFetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": EXA_API_KEY ?? "" },
    body: JSON.stringify({
      query,
      numResults: 5,
      contents: { text: { maxCharacters: 400 } },
    }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail.slice(0, 200) || `Exa HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string }>;
  };
  return (json.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title ?? domain(r.url!),
      url: r.url!,
      snippet: (r.text ?? "").replace(/\s+/g, " ").trim(),
      published: r.publishedDate,
    }));
}

export function formatWebResults(query: string, results: SearchResult[]): string {
  if (results.length === 0) {
    return `Web results for "${query}": none found. Say so honestly on the screen; do not fabricate specifics.`;
  }
  const lines = results.map(
    (r, i) =>
      `${i + 1}. ${r.title} - ${domain(r.url)}${r.published ? ` (${r.published.slice(0, 10)})` : ""}\n   ${r.snippet}`,
  );
  return `Web results for "${query}":\n${lines.join("\n")}`;
}
