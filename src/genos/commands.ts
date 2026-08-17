import type { AppDef } from "./apps";
import { getProvider } from "./providers";
import {
  FIRECRAWL_WORKFLOWS,
  FIRECRAWL_WORKFLOW_IDS,
  FIRECRAWL_WORKFLOW_SETUPS,
  isFirecrawlWorkflow,
  setupCreditBudget,
  validateWorkflowSetup,
  type FirecrawlWorkflowId,
  type WorkflowSetupValues,
} from "./workflows";

export const MAX_COMMAND_INPUT = 10_000;

export type SlashCommandAvailability = "enabled" | "needs-key" | "unavailable";

export interface SlashCommandDef {
  id: FirecrawlWorkflowId;
  title: string;
  description: string;
  providerId: "firecrawl";
  workflowId: FirecrawlWorkflowId;
  inputHint: string;
  keywords: readonly string[];
  availability: "enabled" | "unavailable";
}

const COMMAND_COPY: Record<FirecrawlWorkflowId, Omit<SlashCommandDef, "id" | "providerId" | "workflowId" | "availability">> = {
  firecrawl: { title: "Firecrawl", description: "Choose a bounded scrape, search, or Agent task", inputHint: "URL or query", keywords: ["scrape", "search", "agent"] },
  "firecrawl-company-directories": { title: "Company directories", description: "Extract bounded, deduplicated public directory records", inputHint: "directory URL or name", keywords: ["directory", "companies", "list"] },
  "firecrawl-competitive-intel": { title: "Competitive intel", description: "Compare current pricing, features, and product evidence", inputHint: "competitors and scope", keywords: ["competitor", "pricing", "features"] },
  "firecrawl-dashboard-reporting": { title: "Dashboard reporting", description: "Summarize an authorized dashboard boundary", inputHint: "authorized dashboard URL", keywords: ["dashboard", "metrics", "report"] },
  "firecrawl-deep-research": { title: "Deep research", description: "Run cited research at an explicit depth and budget", inputHint: "research topic", keywords: ["research", "citations", "synthesis"] },
  "firecrawl-demo-walkthrough": { title: "Demo walkthrough", description: "Observe a bounded public product flow without changes", inputHint: "public URL and flow", keywords: ["demo", "walkthrough", "ux"] },
  "firecrawl-knowledge-base": { title: "Knowledge base", description: "Build an in-app sourced knowledge view", inputHint: "source URLs and boundary", keywords: ["knowledge", "docs", "crawl"] },
  "firecrawl-knowledge-ingest": { title: "Knowledge ingest", description: "Normalize bounded sources into an in-app view", inputHint: "source URLs", keywords: ["ingest", "normalize", "dedupe"] },
  "firecrawl-lead-gen": { title: "Lead generation", description: "Find bounded public leads with explicit data gaps", inputHint: "target audience", keywords: ["leads", "prospects", "companies"] },
  "firecrawl-lead-research": { title: "Lead research", description: "Create a concise sourced company or person brief", inputHint: "company or URL", keywords: ["lead", "company", "person", "brief"] },
  "firecrawl-market-research": { title: "Market research", description: "Research dated market evidence and uncertainty", inputHint: "market and question", keywords: ["market", "metrics", "methodology"] },
  "firecrawl-qa": { title: "QA", description: "Run a bounded, read-only website test charter", inputHint: "target URL and charter", keywords: ["qa", "test", "bugs"] },
  "firecrawl-research-papers": { title: "Research papers", description: "Find primary papers with methods and limitations", inputHint: "paper topic", keywords: ["papers", "academic", "pdf"] },
  "firecrawl-seo-audit": { title: "SEO audit", description: "Audit bounded metadata and indexability evidence", inputHint: "site URL", keywords: ["seo", "metadata", "indexability"] },
  "firecrawl-shop": { title: "Shop", description: "Compare current public price and availability evidence", inputHint: "product and constraints", keywords: ["shopping", "price", "products"] },
  "firecrawl-website-design-clone": { title: "Website design study", description: "Document observed design tokens and components", inputHint: "target page URL", keywords: ["website", "design", "tokens", "components"] },
  "firecrawl-workflows": { title: "Workflow chooser", description: "Choose one concrete bounded Firecrawl workflow", inputHint: "your goal", keywords: ["workflow", "chooser", "route"] },
};

const FIRECRAWL_COMMAND_IDS: readonly FirecrawlWorkflowId[] = [
  "firecrawl",
  ...FIRECRAWL_WORKFLOW_IDS.filter((id) => id !== "firecrawl"),
];

export const FIRECRAWL_COMMANDS: readonly SlashCommandDef[] = FIRECRAWL_COMMAND_IDS.map((id) => ({
  id,
  providerId: "firecrawl" as const,
  workflowId: id,
  ...COMMAND_COPY[id],
  availability:
    getProvider("firecrawl") && FIRECRAWL_WORKFLOWS[id] && FIRECRAWL_WORKFLOW_SETUPS[id]
      ? "enabled"
      : "unavailable",
}));

export type SlashParseResult =
  | { kind: "none" }
  | { kind: "unknown"; commandId: string; argument: string }
  | { kind: "known"; command: SlashCommandDef; argument: string };

/** Exact execution parser. Prefix matches are deliberately never executable. */
export function parseSlashCommand(text: string): SlashParseResult {
  if (!text.startsWith("/")) return { kind: "none" };
  const match = text.match(/^\/([^\s]*)(?:\s([\s\S]*))?$/);
  if (!match) return { kind: "unknown", commandId: text.slice(1), argument: "" };
  const commandId = match[1].toLowerCase();
  const argument = (match[2] ?? "").slice(0, MAX_COMMAND_INPUT);
  const command = FIRECRAWL_COMMANDS.find((candidate) => candidate.id === commandId);
  return command
    ? { kind: "known", command, argument }
    : { kind: "unknown", commandId, argument };
}

/** Discovery helper. Partial matches filter only; route execution uses the parser above. */
export function filterSlashCommands(text: string): readonly SlashCommandDef[] {
  if (!text.startsWith("/")) return [];
  const query = text.slice(1).split(/\s/, 1)[0].toLowerCase();
  if (!query) return FIRECRAWL_COMMANDS;
  return FIRECRAWL_COMMANDS.filter((command) =>
    [command.id, command.title, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

export function commandAvailability(
  command: SlashCommandDef,
  hasProviderKey: boolean,
): SlashCommandAvailability {
  if (command.availability === "unavailable" || !isFirecrawlWorkflow(command.workflowId)) return "unavailable";
  return hasProviderKey ? "enabled" : "needs-key";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function commandToApp(
  command: SlashCommandDef,
  argument: string,
  setupValues: WorkflowSetupValues = {},
): AppDef {
  const validationErrors = validateWorkflowSetup(command.workflowId, setupValues);
  if (Object.keys(validationErrors).length > 0) {
    throw new Error("Workflow setup must be complete before launch");
  }
  const safeArgument = argument.slice(0, MAX_COMMAND_INPUT);
  const safeValues = Object.fromEntries(
    Object.entries(setupValues).filter(([key]) => !/key|secret|token|password/i.test(key)),
  );
  const budget = setupCreditBudget(command.workflowId, safeValues);
  const operation = command.workflowId === "firecrawl" ? safeValues.operation : "agent";
  const factualTask = safeArgument ? `Original command argument: ${safeArgument}\n` : "";
  const request = [
    `Run the trusted ${command.workflowId} workflow.`,
    factualTask,
    `Validated setup inputs: ${JSON.stringify(safeValues)}`,
    `The user explicitly confirmed the central maximum budget of ${budget} credits.`,
    `Use exactly one confirmed Firecrawl ${operation} operation for this workflow.`,
    "For an Agent tool call, pass the selected depth and confirmCost: true; never exceed the workflow-owned central policy.",
    "Render an in-app summary/current-progress view with structured lists or tables, data gaps, and source links.",
    "Do not claim a CSV, JSON, file, CRM record, outreach message, purchase, or export was created.",
  ].filter(Boolean).join("\n");
  return {
    id: `workflow-${command.id}-${stableHash(JSON.stringify([safeArgument, safeValues]))}`,
    name: command.title,
    emoji: "🔥",
    providerId: command.providerId,
    workflowId: command.workflowId,
    workflowInputs: safeValues,
    firecrawlConfirmed: true,
    tile: ["#fa5d3b", "#f59e0b"],
    request,
  };
}
