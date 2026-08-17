import { EXA_API_KEY } from "../../config";
import { firecrawlKey } from "../providers/firecrawl/key";
import { isFirecrawlWorkflow } from "../workflows";
import {
  executeFirecrawlTool,
  FIRECRAWL_TOOL_DEFS,
  isFirecrawlTool,
  type FirecrawlProgress,
} from "./firecrawl";
export { isFirecrawlTool } from "./firecrawl";
import {
  executeTool as executeSearchTool,
  TOOL_DEFS as SEARCH_TOOL_DEFS,
  TOOLS_PROMPT_SECTION as SEARCH_PROMPT_SECTION,
} from "./search";

export interface ToolContext {
  workflowId?: string;
  firecrawlConfirmed?: boolean;
  firecrawlOperation?: "search" | "scrape" | "agent";
}

export interface ProviderAvailability {
  exa: boolean;
  firecrawl: boolean;
}

export function providerAvailability(context: ToolContext = {}): ProviderAvailability {
  return {
    exa: !!EXA_API_KEY,
    firecrawl:
      !!firecrawlKey.get() &&
      context.firecrawlConfirmed === true &&
      isFirecrawlWorkflow(context.workflowId),
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
  const definitions = definitionsForProviders(providerAvailability(context));
  if (!context.firecrawlOperation) return definitions;
  return definitions.filter(
    (definition) =>
      !isFirecrawlTool(definition.function.name) ||
      definition.function.name === `firecrawl_${context.firecrawlOperation}`,
  );
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
    if (context.firecrawlConfirmed !== true) return "ERROR: explicit Firecrawl setup and budget confirmation required";
    if (!isFirecrawlWorkflow(context.workflowId)) return "ERROR: Firecrawl tool requires a trusted workflow";
    if (context.firecrawlOperation && name !== `firecrawl_${context.firecrawlOperation}`) {
      return `ERROR: this workflow confirmed the ${context.firecrawlOperation} operation, not ${name}`;
    }
    return executeFirecrawlTool(name, args, context.workflowId, signal, progress);
  }
  return `ERROR: unknown tool "${name}"`;
}
