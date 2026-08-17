import { EXA_API_KEY } from "../../config";
import { firecrawlKey } from "../providers/firecrawl/key";
import { isFirecrawlWorkflow } from "../workflows";
import {
  executeFirecrawlTool,
  FIRECRAWL_TOOL_DEFS,
  isFirecrawlTool,
  type FirecrawlProgress,
} from "./firecrawl";
import {
  executeTool as executeSearchTool,
  TOOL_DEFS as SEARCH_TOOL_DEFS,
  TOOLS_PROMPT_SECTION as SEARCH_PROMPT_SECTION,
} from "./search";

export interface ToolContext {
  workflowId?: string;
}

export interface ProviderAvailability {
  exa: boolean;
  firecrawl: boolean;
}

export function providerAvailability(context: ToolContext = {}): ProviderAvailability {
  return {
    exa: !!EXA_API_KEY,
    firecrawl: !!firecrawlKey.get() && isFirecrawlWorkflow(context.workflowId),
  };
}

const FIRECRAWL_PROMPT_SECTION = `

## Firecrawl tools
Use only the tools enabled for the active trusted workflow. Prefer search for discovery and scrape for a known URL. Agent is asynchronous and credit-bearing: use it only when autonomous multi-page work is required, never start duplicate jobs, and resume an existing jobId after timeout. Preserve source URLs and blank unavailable fields.`;

export function definitionsForProviders(available: ProviderAvailability) {
  return [
    ...(available.exa ? SEARCH_TOOL_DEFS : []),
    ...(available.firecrawl ? FIRECRAWL_TOOL_DEFS : []),
  ];
}

export function enabledPromptSections(context: ToolContext = {}): string {
  const available = providerAvailability(context);
  return `${available.exa ? SEARCH_PROMPT_SECTION : ""}${available.firecrawl ? FIRECRAWL_PROMPT_SECTION : ""}`;
}

export function enabledToolDefinitions(context: ToolContext = {}) {
  return definitionsForProviders(providerAvailability(context));
}

export function toolsAvailable(context: ToolContext = {}): boolean {
  return enabledToolDefinitions(context).length > 0;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
  progress?: (state: FirecrawlProgress) => void,
  context: ToolContext = {},
): Promise<string> {
  if (name === "web_search") return executeSearchTool(name, args, signal);
  if (isFirecrawlTool(name)) {
    if (!firecrawlKey.get()) return "ERROR: Firecrawl key required";
    if (!isFirecrawlWorkflow(context.workflowId)) return "ERROR: Firecrawl tool requires a trusted workflow";
    return executeFirecrawlTool(name, args, context.workflowId, signal, progress);
  }
  return `ERROR: unknown tool "${name}"`;
}
