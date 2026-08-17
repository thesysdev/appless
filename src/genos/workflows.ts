export const FIRECRAWL_WORKFLOW_IDS = [
  "firecrawl-company-directories",
  "firecrawl-competitive-intel",
  "firecrawl-dashboard-reporting",
  "firecrawl-deep-research",
  "firecrawl-demo-walkthrough",
  "firecrawl-knowledge-base",
  "firecrawl-knowledge-ingest",
  "firecrawl-lead-gen",
  "firecrawl-lead-research",
  "firecrawl-market-research",
  "firecrawl-qa",
  "firecrawl-research-papers",
  "firecrawl-seo-audit",
  "firecrawl-shop",
  "firecrawl-website-design-clone",
  "firecrawl-workflows",
  "firecrawl",
] as const;

export type FirecrawlWorkflowId = (typeof FIRECRAWL_WORKFLOW_IDS)[number];
export type WorkflowDepth = "quick" | "thorough" | "exhaustive";

export interface WorkflowContract {
  id: FirecrawlWorkflowId;
  instructions: string;
  resultFields: readonly string[];
  maxCredits: number | Record<WorkflowDepth, number>;
  timeoutMs: number | Record<WorkflowDepth, number>;
  requiresAgentConfirmation?: boolean;
}

const contract = (
  id: FirecrawlWorkflowId,
  instructions: string,
  resultFields: readonly string[],
  maxCredits: WorkflowContract["maxCredits"] = 150,
  timeoutMs: WorkflowContract["timeoutMs"] = 180_000,
  requiresAgentConfirmation = false,
): WorkflowContract => ({ id, instructions, resultFields, maxCredits, timeoutMs, requiresAgentConfirmation });

export const FIRECRAWL_WORKFLOWS: Record<FirecrawlWorkflowId, WorkflowContract> = {
  "firecrawl-company-directories": contract(
    "firecrawl-company-directories",
    "Require target directory and row/page bound. Collect visible, legitimately accessible fields only; follow bounded pagination, report progress, dedupe records, and use blank values for unavailable fields.",
    ["records", "pagination", "missingFields", "sources"],
  ),
  "firecrawl-competitive-intel": contract(
    "firecrawl-competitive-intel",
    "Require named competitors and scope. Prefer current pricing, product, feature, and changelog evidence; timestamp comparisons and preserve conflicting or missing claims.",
    ["asOf", "comparisons", "conflicts", "missingFields", "sources"],
    250,
    300_000,
  ),
  "firecrawl-dashboard-reporting": contract(
    "firecrawl-dashboard-reporting",
    "Require an authorized dashboard/session boundary, metric definitions, and reporting period. Never capture credentials or include them in output; do not cross the authorized session boundary.",
    ["period", "metricDefinitions", "metrics", "missingFields", "sources"],
  ),
  "firecrawl-deep-research": contract(
    "firecrawl-deep-research",
    "Require quick, thorough, or exhaustive depth. Prefer primary sources; return cited synthesis, risks, uncertainty, and open questions without invented claims.",
    ["depth", "summary", "findings", "risks", "openQuestions", "sources"],
    { quick: 100, thorough: 300, exhaustive: 750 },
    { quick: 180_000, thorough: 480_000, exhaustive: 900_000 },
  ),
  "firecrawl-demo-walkthrough": contract(
    "firecrawl-demo-walkthrough",
    "Require a bounded product flow. Record observed UX evidence; do not submit, publish, purchase, delete, or make any state-changing action without explicit permission.",
    ["steps", "observations", "limitations", "sources"],
  ),
  "firecrawl-knowledge-base": contract(
    "firecrawl-knowledge-base",
    "Require scoped source URLs and crawl boundary. Retain provenance, dedupe content, record update timestamps, and state login or access limitations.",
    ["documents", "updatedAt", "duplicates", "limitations", "sources"],
  ),
  "firecrawl-knowledge-ingest": contract(
    "firecrawl-knowledge-ingest",
    "Require scoped sources and explicit ingest boundary. Normalize and dedupe entries while retaining URL provenance and update timestamps; report login limitations and do not upload elsewhere.",
    ["entries", "updatedAt", "duplicates", "limitations", "sources"],
  ),
  "firecrawl-lead-gen": contract(
    "firecrawl-lead-gen",
    "Require audience, geography, and result limit. Use legitimately accessible fields only, dedupe companies and people, preserve data gaps, and never bypass access controls or guess contact details.",
    ["leads", "missingFields", "methodology", "sources"],
  ),
  "firecrawl-lead-research": contract(
    "firecrawl-lead-research",
    "Require named person/company and research scope. Produce a concise sourced brief; separate verified facts from inferred pain points and leave unknown email, phone, funding, and roles blank.",
    ["facts", "inferredPainPoints", "missingFields", "sources"],
  ),
  "firecrawl-market-research": contract(
    "firecrawl-market-research",
    "Require market, geography, period, and question. Prefer primary sources; date every metric and explain methodology, conflicts, uncertainty, and missing evidence.",
    ["asOf", "metrics", "findings", "methodology", "uncertainty", "sources"],
    250,
    300_000,
  ),
  "firecrawl-qa": contract(
    "firecrawl-qa",
    "Require bounded target, test charter, and allowed actions. Return reproducible steps and observed evidence; never perform destructive or state-changing submissions.",
    ["charter", "checks", "findings", "limitations", "sources"],
  ),
  "firecrawl-research-papers": contract(
    "firecrawl-research-papers",
    "Require topic and date/scope. Prefer primary paper or PDF links; capture metadata, methodology, results, and limitations, and never invent citations.",
    ["papers", "methodology", "results", "limitations", "sources"],
  ),
  "firecrawl-seo-audit": contract(
    "firecrawl-seo-audit",
    "Require site and crawl boundary. Gather metadata and indexability evidence; return prioritized findings with representative page samples and explicit coverage gaps.",
    ["boundary", "findings", "pageSamples", "missingFields", "sources"],
  ),
  "firecrawl-shop": contract(
    "firecrawl-shop",
    "Require product constraints, geography, and result limit. Capture current price and availability evidence, compare options, and never add to cart or purchase.",
    ["constraints", "products", "comparisons", "missingFields", "sources"],
  ),
  "firecrawl-website-design-clone": contract(
    "firecrawl-website-design-clone",
    "Require target pages and scope. Record observed design tokens, components, and asset provenance; produce a DESIGN.md-shaped result without copying protected content wholesale.",
    ["designMarkdown", "tokens", "components", "assetProvenance", "sources"],
  ),
  "firecrawl-workflows": contract(
    "firecrawl-workflows",
    "Act only as a chooser: identify the single concrete Firecrawl workflow that matches the request, collect its required inputs, then route to that contract. Never run an unbounded generic Agent.",
    ["workflowId", "requiredInputs", "reason", "sources"],
    150,
    180_000,
    true,
  ),
  firecrawl: contract(
    "firecrawl",
    "Require an explicit search, scrape, or Agent choice. Search and scrape are preferred; Agent requires an explicit cost/depth confirmation before it may start.",
    ["operation", "data", "missingFields", "sources"],
    150,
    180_000,
    true,
  ),
};

export function isFirecrawlWorkflow(id: string | undefined): id is FirecrawlWorkflowId {
  return !!id && Object.prototype.hasOwnProperty.call(FIRECRAWL_WORKFLOWS, id);
}

export function workflowPrompt(id: string | undefined): string {
  if (!isFirecrawlWorkflow(id)) return "";
  const c = FIRECRAWL_WORKFLOWS[id];
  return `\n\n## Trusted Firecrawl workflow: ${id}\n${c.instructions}\nReturn only observed facts, retain source URLs, and leave unavailable structured fields blank. Never fabricate email, phone, funding, roles, company facts, or citations.`;
}

export function agentPolicy(
  id: string | undefined,
  depth: WorkflowDepth = "quick",
): { maxCredits: number; timeoutMs: number; contract: WorkflowContract } | null {
  if (!isFirecrawlWorkflow(id)) return null;
  const c = FIRECRAWL_WORKFLOWS[id];
  const maxCredits = typeof c.maxCredits === "number" ? c.maxCredits : c.maxCredits[depth];
  const timeoutMs = typeof c.timeoutMs === "number" ? c.timeoutMs : c.timeoutMs[depth];
  return { maxCredits, timeoutMs, contract: c };
}

export function trustedAgentSchema(id: string | undefined): Record<string, unknown> | null {
  if (!isFirecrawlWorkflow(id)) return null;
  const fields = FIRECRAWL_WORKFLOWS[id].resultFields;
  const scalar = {
    anyOf: [
      { type: "string", maxLength: 12_000 },
      { type: "number" },
      { type: "boolean" },
      { type: "null" },
    ],
  };
  const stringFields = new Set([
    "asOf",
    "period",
    "updatedAt",
    "summary",
    "methodology",
    "uncertainty",
    "designMarkdown",
    "boundary",
    "charter",
    "depth",
    "workflowId",
    "reason",
    "operation",
  ]);
  const stringArrays = new Set([
    "conflicts",
    "missingFields",
    "risks",
    "openQuestions",
    "duplicates",
    "limitations",
    "requiredInputs",
  ]);
  const objectFields = new Set(["metricDefinitions", "constraints", "data"]);
  const fieldSchema = (field: string): Record<string, unknown> => {
    if (field === "sources") {
      return { type: "array", maxItems: 100, items: { type: "string", format: "uri" } };
    }
    if (stringFields.has(field)) return { type: "string", maxLength: 12_000 };
    if (stringArrays.has(field)) {
      return { type: "array", maxItems: 100, items: { type: "string", maxLength: 2_000 } };
    }
    if (objectFields.has(field)) {
      return { type: "object", maxProperties: 100, additionalProperties: scalar };
    }
    return {
      type: "array",
      maxItems: 100,
      items: { type: "object", maxProperties: 50, additionalProperties: scalar },
    };
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(fields.map((field) => [field, fieldSchema(field)])),
    required: [...fields],
  };
}
