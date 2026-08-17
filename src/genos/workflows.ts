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

export type WorkflowFieldType = "text" | "url" | "number" | "select" | "checkbox";

export interface WorkflowFieldDef {
  id: string;
  label: string;
  type: WorkflowFieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  options?: readonly { label: string; value: string }[];
  visibleWhen?: { fieldId: string; equals: string };
}

export interface WorkflowSetupDef {
  workflowId: FirecrawlWorkflowId;
  fields: readonly WorkflowFieldDef[];
}

export type WorkflowSetupValues = Record<string, string | number | boolean>;

const field = (
  id: string,
  label: string,
  type: WorkflowFieldType,
  options: Omit<WorkflowFieldDef, "id" | "label" | "type"> = {},
): WorkflowFieldDef => ({ id, label, type, ...options });

const depthField = (exhaustive = false): WorkflowFieldDef =>
  field("depth", "Research depth", "select", {
    required: true,
    options: [
      { label: "Quick", value: "quick" },
      { label: "Thorough", value: "thorough" },
      ...(exhaustive ? [{ label: "Exhaustive", value: "exhaustive" }] : []),
    ],
  });

const confirmationField = field("confirmCredits", "Confirm the displayed maximum credit budget", "checkbox", {
  required: true,
  hint: "This confirmation is required before AppLess starts any Firecrawl request.",
});

const setup = (
  workflowId: FirecrawlWorkflowId,
  fields: readonly WorkflowFieldDef[],
): WorkflowSetupDef => ({ workflowId, fields: [...fields, confirmationField] });

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

const OUTPUT_OPTIONS = [
  { label: "Structured list", value: "list" },
  { label: "Table", value: "table" },
] as const;

/**
 * Shell-owned setup contracts. These are deliberately application data, not
 * local agent SKILL.md files, so packaged builds have the same deterministic
 * required inputs and credit confirmation behavior.
 */
export const FIRECRAWL_WORKFLOW_SETUPS: Record<FirecrawlWorkflowId, WorkflowSetupDef> = {
  "firecrawl-company-directories": setup("firecrawl-company-directories", [
    field("directory", "Directory URL or name", "text", { required: true, placeholder: "https://example.com/directory" }),
    field("filters", "Optional filters", "text", { placeholder: "Region, category, company size" }),
    field("resultCap", "Maximum results", "number", { required: true, min: 1, max: 100 }),
    field("outputView", "Output view", "select", { required: true, options: OUTPUT_OPTIONS }),
    depthField(),
  ]),
  "firecrawl-competitive-intel": setup("firecrawl-competitive-intel", [
    field("competitors", "Competitors", "text", { required: true, placeholder: "Company A, Company B" }),
    field("scope", "Comparison scope", "text", { required: true, placeholder: "Pricing, features, changelog" }),
    depthField(),
  ]),
  "firecrawl-dashboard-reporting": setup("firecrawl-dashboard-reporting", [
    field("dashboardUrl", "Authorized dashboard URL", "url", { required: true }),
    field("metrics", "Metric definitions", "text", { required: true }),
    field("period", "Reporting period", "text", { required: true, placeholder: "2026 Q2" }),
    field("authorized", "I am authorized to access this dashboard", "checkbox", { required: true }),
    depthField(),
  ]),
  "firecrawl-deep-research": setup("firecrawl-deep-research", [
    field("topic", "Research topic", "text", { required: true }),
    depthField(true),
    field("confirmExhaustive", "Separately confirm the 750-credit exhaustive ceiling", "checkbox", {
      required: true,
      visibleWhen: { fieldId: "depth", equals: "exhaustive" },
    }),
  ]),
  "firecrawl-demo-walkthrough": setup("firecrawl-demo-walkthrough", [
    field("url", "Public product URL", "url", { required: true }),
    field("flow", "Bounded flow to observe", "text", { required: true }),
    depthField(),
  ]),
  "firecrawl-knowledge-base": setup("firecrawl-knowledge-base", [
    field("sources", "Source URLs", "text", { required: true, placeholder: "One or more public URLs" }),
    field("boundary", "Crawl boundary", "text", { required: true, placeholder: "Docs section and page cap" }),
    field("pageCap", "Maximum pages", "number", { required: true, min: 1, max: 100 }),
    depthField(),
  ]),
  "firecrawl-knowledge-ingest": setup("firecrawl-knowledge-ingest", [
    field("sources", "Source URLs", "text", { required: true }),
    field("boundary", "In-app ingest boundary", "text", { required: true }),
    field("pageCap", "Maximum pages", "number", { required: true, min: 1, max: 100 }),
    depthField(),
  ]),
  "firecrawl-lead-gen": setup("firecrawl-lead-gen", [
    field("target", "Target audience and geography", "text", { required: true }),
    field("sourceNote", "Source or authorization note", "text", { required: true }),
    field("leadCap", "Maximum leads", "number", { required: true, min: 1, max: 100 }),
    field("outputView", "Output view", "select", { required: true, options: OUTPUT_OPTIONS }),
    depthField(),
  ]),
  "firecrawl-lead-research": setup("firecrawl-lead-research", [
    field("company", "Company name or URL", "text", { required: true }),
    field("person", "Optional person", "text"),
    field("meetingContext", "Meeting context", "text", { required: true }),
    depthField(),
  ]),
  "firecrawl-market-research": setup("firecrawl-market-research", [
    field("market", "Market and geography", "text", { required: true }),
    field("period", "Period", "text", { required: true }),
    field("question", "Research question", "text", { required: true }),
    depthField(),
  ]),
  "firecrawl-qa": setup("firecrawl-qa", [
    field("targetUrl", "Public target URL", "url", { required: true }),
    field("charter", "Bounded test charter", "text", { required: true }),
    field("allowedActions", "Allowed read-only actions", "text", { required: true }),
    depthField(),
  ]),
  "firecrawl-research-papers": setup("firecrawl-research-papers", [
    field("topic", "Paper topic", "text", { required: true }),
    field("scope", "Date or publication scope", "text", { required: true }),
    field("paperCap", "Maximum papers", "number", { required: true, min: 1, max: 50 }),
    depthField(),
  ]),
  "firecrawl-seo-audit": setup("firecrawl-seo-audit", [
    field("siteUrl", "Site URL", "url", { required: true }),
    field("boundary", "Crawl boundary", "text", { required: true }),
    field("pageCap", "Maximum pages", "number", { required: true, min: 1, max: 100 }),
    depthField(),
  ]),
  "firecrawl-shop": setup("firecrawl-shop", [
    field("product", "Product and constraints", "text", { required: true }),
    field("geography", "Shopping geography", "text", { required: true }),
    field("resultCap", "Maximum options", "number", { required: true, min: 1, max: 50 }),
    depthField(),
  ]),
  "firecrawl-website-design-clone": setup("firecrawl-website-design-clone", [
    field("targetUrl", "Target page URL", "url", { required: true }),
    field("scope", "Pages and design scope", "text", { required: true }),
    field("respectRights", "I will respect asset and content rights", "checkbox", { required: true }),
    depthField(),
  ]),
  "firecrawl-workflows": setup("firecrawl-workflows", [
    field("goal", "What do you need?", "text", { required: true }),
    field("workflowChoice", "Concrete workflow", "select", {
      required: true,
      options: FIRECRAWL_WORKFLOW_IDS.filter((id) => id !== "firecrawl" && id !== "firecrawl-workflows").map((id) => ({ label: id.replace(/^firecrawl-/, "").replace(/-/g, " "), value: id })),
    }),
    depthField(),
  ]),
  firecrawl: setup("firecrawl", [
    field("operation", "Operation", "select", {
      required: true,
      options: [
        { label: "Scrape one URL", value: "scrape" },
        { label: "Search the web", value: "search" },
        { label: "Agent research", value: "agent" },
      ],
    }),
    field("url", "URL", "url", { required: true, visibleWhen: { fieldId: "operation", equals: "scrape" } }),
    field("query", "Search query", "text", { required: true, visibleWhen: { fieldId: "operation", equals: "search" } }),
    field("task", "Agent task", "text", { required: true, visibleWhen: { fieldId: "operation", equals: "agent" } }),
    field("resultCap", "Maximum search results", "number", { required: true, min: 1, max: 10, visibleWhen: { fieldId: "operation", equals: "search" } }),
    { ...depthField(true), visibleWhen: { fieldId: "operation", equals: "agent" } },
  ]),
};

export function visibleWorkflowFields(
  workflowId: FirecrawlWorkflowId,
  values: WorkflowSetupValues,
): readonly WorkflowFieldDef[] {
  return FIRECRAWL_WORKFLOW_SETUPS[workflowId].fields.filter(
    (candidate) => !candidate.visibleWhen || values[candidate.visibleWhen.fieldId] === candidate.visibleWhen.equals,
  );
}

export function validateWorkflowSetup(
  workflowId: FirecrawlWorkflowId,
  values: WorkflowSetupValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const candidate of visibleWorkflowFields(workflowId, values)) {
    const value = values[candidate.id];
    if (candidate.required && (value === undefined || value === "" || value === false)) {
      errors[candidate.id] = `${candidate.label} is required`;
      continue;
    }
    if (candidate.type === "url" && typeof value === "string" && value) {
      try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        errors[candidate.id] = "Enter a valid HTTP(S) URL";
      }
    }
    if (candidate.type === "number" && value !== undefined && value !== "") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || (candidate.min !== undefined && numeric < candidate.min) || (candidate.max !== undefined && numeric > candidate.max)) {
        errors[candidate.id] = `Enter a number from ${candidate.min ?? 0} to ${candidate.max ?? "the allowed maximum"}`;
      }
    }
  }
  return errors;
}

export function setupCreditBudget(
  workflowId: FirecrawlWorkflowId,
  values: WorkflowSetupValues,
): number {
  const depth = values.depth === "thorough" || values.depth === "exhaustive" ? values.depth : "quick";
  return agentPolicy(workflowId, depth)?.maxCredits ?? 0;
}

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
