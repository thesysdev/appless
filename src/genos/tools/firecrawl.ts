import { fetch as expoFetch } from "expo/fetch";
import { firecrawlKey } from "../providers/firecrawl/key";
import {
  agentPolicy,
  trustedAgentSchema,
  type FirecrawlWorkflowId,
  type WorkflowDepth,
} from "../workflows";

const BASE_URL = "https://api.firecrawl.dev/v2";
const REQUEST_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_QUERY = 500;
const MAX_PROMPT = 10_000;
const MAX_URLS = 10;
const MAX_RESULT_CHARS = 24_000;
export const MAX_SEARCH_RESULTS = 10;

/** Stable for the app session so screen retries resume instead of re-spending. */
const agentJobs = new Map<string, Promise<string>>();

export type FirecrawlProgress = {
  state: "starting" | "processing";
  elapsedMs: number;
  jobId?: string;
};

export interface FirecrawlAgentStatus {
  success: boolean;
  status: "processing" | "completed" | "failed" | "cancelled";
  data?: unknown;
  error?: string;
  creditsUsed?: number;
  expiresAt?: string;
}

function validUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function boundedUrls(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_URLS) return null;
  const urls = value.map(validUrl);
  return urls.every((url): url is string => !!url) ? urls : null;
}

function requestSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  else parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}

async function firecrawlRequest(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> },
  signal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  const key = firecrawlKey.get();
  if (!key) throw new Error("Firecrawl key required");
  const bounded = requestSignal(signal, timeoutMs);
  try {
    const response = await expoFetch(`${BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: bounded.signal,
    });
    if (response.status === 401 || response.status === 403) {
      firecrawlKey.markRejected(key);
      throw new Error("Firecrawl rejected the API key - enter a valid key");
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 500);
      if (response.status === 429) {
        throw new Error("Firecrawl rate or concurrency limit reached - wait and try again");
      }
      if (response.status === 402 || /credit|payment/i.test(detail)) {
        throw new Error("Firecrawl credit limit reached - review the account budget");
      }
      throw new Error(detail || `Firecrawl HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    bounded.cleanup();
  }
}

function truncate(value: string): string {
  return value.length <= MAX_RESULT_CHARS
    ? value
    : `${value.slice(0, MAX_RESULT_CHARS)}\n[Result truncated at ${MAX_RESULT_CHARS} characters]`;
}

function boundedResult(data: unknown, metadata: Record<string, unknown>): string {
  const complete = JSON.stringify({ data, ...metadata });
  if (complete.length <= MAX_RESULT_CHARS) return complete;
  const suffix = JSON.stringify({ ...metadata, truncated: true });
  const budget = Math.max(0, MAX_RESULT_CHARS - suffix.length - 40);
  return JSON.stringify({
    data: JSON.stringify(data).slice(0, budget),
    ...metadata,
    truncated: true,
  });
}

function collectSources(value: unknown, out = new Set<string>()): string[] {
  if (typeof value === "string") {
    const url = validUrl(value);
    if (url) out.add(url);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectSources(item, out));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectSources(item, out));
  }
  return [...out].slice(0, 100);
}

export async function firecrawlSearch(
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query || query.length > MAX_QUERY) return `ERROR: firecrawl_search requires a query up to ${MAX_QUERY} characters`;
  const requested = Number(args.limit ?? 5);
  if (!Number.isFinite(requested) || requested < 1) return "ERROR: firecrawl_search limit must be positive";
  const limit = Math.min(MAX_SEARCH_RESULTS, Math.floor(requested));
  const includeMarkdown = args.format === "markdown";
  try {
    const json = (await firecrawlRequest(
      "/search",
      {
        method: "POST",
        body: {
          query,
          limit,
          sources: ["web"],
          ...(includeMarkdown ? { scrapeOptions: { formats: [{ type: "markdown" }] } } : {}),
        },
      },
      signal,
    )) as {
      data?: { web?: Array<{ title?: string; description?: string; url?: string; markdown?: string; metadata?: { sourceURL?: string } }> };
      creditsUsed?: number;
      warning?: string;
    };
    const results = (json.data?.web ?? []).slice(0, limit).map((result) => ({
      title: result.title ?? "",
      url: validUrl(result.url) ?? validUrl(result.metadata?.sourceURL) ?? "",
      description: result.description ?? "",
      ...(includeMarkdown ? { markdown: (result.markdown ?? "").slice(0, 4_000) } : {}),
    }));
    return truncate(JSON.stringify({ query, results, creditsUsed: json.creditsUsed, warning: json.warning ?? "", sources: results.map((r) => r.url).filter(Boolean) }));
  } catch (error) {
    return `ERROR: firecrawl search failed (${error instanceof Error ? error.message : String(error)})`;
  }
}

export async function firecrawlScrape(
  args: Record<string, unknown>,
  workflowId: string | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const url = validUrl(args.url);
  if (!url) return "ERROR: firecrawl_scrape requires one valid HTTP(S) URL";
  const format = args.format === "json" ? "json" : "markdown";
  const schema = format === "json" ? trustedAgentSchema(workflowId) : null;
  if (format === "json" && !schema) return "ERROR: JSON scrape requires a trusted Firecrawl workflow";
  try {
    const json = (await firecrawlRequest(
      "/scrape",
      {
        method: "POST",
        body: {
          url,
          formats:
            format === "json"
              ? [{ type: "json", schema }]
              : ["markdown"],
          onlyMainContent: true,
          timeout: REQUEST_TIMEOUT_MS,
        },
      },
      signal,
    )) as { data?: { markdown?: string; json?: unknown; metadata?: { sourceURL?: string; url?: string } }; creditsUsed?: number };
    const source = validUrl(json.data?.metadata?.sourceURL) ?? validUrl(json.data?.metadata?.url) ?? url;
    const data = format === "json" ? json.data?.json ?? {} : json.data?.markdown ?? "";
    return boundedResult(data, { creditsUsed: json.creditsUsed, sources: [source] });
  } catch (error) {
    return `ERROR: firecrawl scrape failed (${error instanceof Error ? error.message : String(error)})`;
  }
}

async function startFirecrawlAgent(
  args: {
    prompt: string;
    urls?: string[];
    schema: Record<string, unknown>;
    maxCredits: number;
    model?: "spark-1-mini" | "spark-1-pro";
  },
  signal?: AbortSignal,
): Promise<string> {
  if (!Number.isFinite(args.maxCredits) || args.maxCredits <= 0) {
    throw new Error("Agent requires an explicit positive maxCredits");
  }
  const json = (await firecrawlRequest(
    "/agent",
    {
      method: "POST",
      body: {
        prompt: args.prompt,
        ...(args.urls?.length ? { urls: args.urls, strictConstrainToURLs: true } : {}),
        schema: args.schema,
        maxCredits: args.maxCredits,
        model: args.model ?? "spark-1-mini",
      },
    },
    signal,
  )) as { success?: boolean; id?: string };
  if (!json.success || !json.id) throw new Error("Firecrawl did not return an Agent job ID");
  return json.id;
}

export async function getFirecrawlAgentStatus(jobId: string, signal?: AbortSignal): Promise<FirecrawlAgentStatus> {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(jobId)) throw new Error("Invalid Firecrawl Agent job ID");
  return (await firecrawlRequest(`/agent/${encodeURIComponent(jobId)}`, { method: "GET" }, signal)) as FirecrawlAgentStatus;
}

export async function cancelFirecrawlAgent(jobId: string): Promise<void> {
  await firecrawlRequest(`/agent/${encodeURIComponent(jobId)}`, { method: "DELETE" }, undefined, 10_000);
}

function pollDelay(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, POLL_INTERVAL_MS);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function pollFirecrawlAgent(
  jobId: string,
  timeoutMs: number,
  signal?: AbortSignal,
  progress?: (state: FirecrawlProgress) => void,
): Promise<FirecrawlAgentStatus> {
  const startedAt = Date.now();
  for (;;) {
    if (signal?.aborted) throw new Error(`Firecrawl Agent cancelled locally (job ${jobId})`);
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= timeoutMs) throw new Error(`Firecrawl Agent timed out; resume status for job ${jobId}`);
    progress?.({ state: "processing", elapsedMs, jobId });
    const status = await getFirecrawlAgentStatus(jobId, signal);
    if (status.status !== "processing") return status;
    await pollDelay(signal);
  }
}

export async function firecrawlAgent(
  args: Record<string, unknown>,
  workflowId: string | undefined,
  signal?: AbortSignal,
  progress?: (state: FirecrawlProgress) => void,
): Promise<string> {
  const depth: WorkflowDepth =
    args.depth === "thorough" || args.depth === "exhaustive" ? args.depth : "quick";
  const policy = agentPolicy(workflowId, depth);
  if (!policy) return "ERROR: firecrawl_agent requires a trusted Firecrawl workflow";
  if (args.confirmCost !== true) {
    return "ERROR: explicit Agent cost/depth confirmation is required";
  }
  const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT) return `ERROR: firecrawl_agent requires a prompt up to ${MAX_PROMPT} characters`;
  const urls = boundedUrls(args.urls);
  if (!urls) return `ERROR: firecrawl_agent accepts at most ${MAX_URLS} valid HTTP(S) URLs`;
  const model = args.model === "spark-1-pro" ? "spark-1-pro" : "spark-1-mini";
  if (model === "spark-1-pro" && args.highAccuracy !== true) return "ERROR: spark-1-pro requires an explicit high-accuracy choice";

  let jobId = typeof args.jobId === "string" ? args.jobId : undefined;
  try {
    if (!jobId) {
      progress?.({ state: "starting", elapsedMs: 0 });
      const dedupeKey = JSON.stringify([workflowId, depth, model, prompt, urls]);
      let start = agentJobs.get(dedupeKey);
      if (!start) {
        start = startFirecrawlAgent(
          {
            prompt: `${policy.contract.instructions}\n\nUser task: ${prompt}`,
            urls,
            schema: trustedAgentSchema(workflowId)!,
            maxCredits: policy.maxCredits,
            model,
          },
          signal,
        );
        agentJobs.set(dedupeKey, start);
        start.catch(() => {
          if (agentJobs.get(dedupeKey) === start) agentJobs.delete(dedupeKey);
        });
      }
      jobId = await start;
    }
    const status = await pollFirecrawlAgent(jobId, policy.timeoutMs, signal, progress);
    if (status.status === "failed") return `ERROR: Firecrawl Agent failed for job ${jobId} (${status.error ?? "unknown error"})`;
    if (status.status === "cancelled") return `ERROR: Firecrawl Agent job ${jobId} was cancelled`;
    const sources = collectSources(status.data);
    return boundedResult(status.data ?? {}, { jobId, creditsUsed: status.creditsUsed ?? 0, sources });
  } catch (error) {
    if (signal?.aborted && jobId) {
      await cancelFirecrawlAgent(jobId).catch(() => {});
      return `ERROR: Firecrawl Agent cancelled locally (job ${jobId})`;
    }
    return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export const FIRECRAWL_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "firecrawl_search",
      description: "Search the live web with a bounded result count and retained source URLs.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: MAX_SEARCH_RESULTS },
          format: { type: "string", enum: ["summary", "markdown"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "firecrawl_scrape",
      description: "Scrape one HTTP(S) URL into bounded markdown or trusted structured output.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" }, format: { type: "string", enum: ["markdown", "json"] } },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "firecrawl_agent",
      description: "Run or resume a bounded asynchronous Firecrawl Agent job under the active trusted workflow policy.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          urls: { type: "array", maxItems: MAX_URLS, items: { type: "string" } },
          depth: { type: "string", enum: ["quick", "thorough", "exhaustive"] },
          model: { type: "string", enum: ["spark-1-mini", "spark-1-pro"] },
          highAccuracy: { type: "boolean" },
          confirmCost: { type: "boolean" },
          jobId: { type: "string", description: "Existing job ID to resume without creating another paid job" },
        },
        required: ["prompt", "depth", "confirmCost"],
      },
    },
  },
];

export function isFirecrawlTool(name: string): boolean {
  return name === "firecrawl_search" || name === "firecrawl_scrape" || name === "firecrawl_agent";
}

export async function executeFirecrawlTool(
  name: string,
  args: Record<string, unknown>,
  workflowId: FirecrawlWorkflowId,
  signal?: AbortSignal,
  progress?: (state: FirecrawlProgress) => void,
): Promise<string> {
  if (name === "firecrawl_search") return firecrawlSearch(args, signal);
  if (name === "firecrawl_scrape") return firecrawlScrape(args, workflowId, signal);
  if (name === "firecrawl_agent") return firecrawlAgent(args, workflowId, signal, progress);
  return `ERROR: unknown Firecrawl tool "${name}"`;
}
