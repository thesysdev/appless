import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  FIRECRAWL_COMMANDS,
  MAX_COMMAND_INPUT,
  commandAvailability,
  commandToApp,
  filterSlashCommands,
  parseSlashCommand,
} from "../src/genos/commands";
import { CommandMenu, moveCommandSelection } from "../src/genos/shell/CommandMenu";
import { WorkflowSetup, initialWorkflowValues } from "../src/genos/shell/WorkflowSetup";
import {
  FIRECRAWL_WORKFLOWS,
  FIRECRAWL_WORKFLOW_IDS,
  FIRECRAWL_WORKFLOW_SETUPS,
  setupCreditBudget,
  validateWorkflowSetup,
  type WorkflowSetupValues,
} from "../src/genos/workflows";

describe("Firecrawl command catalog", () => {
  it("contains the full stable 17-command catalog with trusted runtime and setup contracts", () => {
    expect(FIRECRAWL_COMMANDS).toHaveLength(17);
    expect(FIRECRAWL_COMMANDS.map((command) => command.id)).toEqual([
      "firecrawl",
      ...FIRECRAWL_WORKFLOW_IDS.filter((id) => id !== "firecrawl"),
    ]);
    expect(new Set(FIRECRAWL_COMMANDS.map((command) => command.id)).size).toBe(17);
    for (const command of FIRECRAWL_COMMANDS) {
      expect(command.providerId).toBe("firecrawl");
      expect(command.availability).toBe("enabled");
      expect(FIRECRAWL_WORKFLOWS[command.workflowId]).toBeDefined();
      expect(FIRECRAWL_WORKFLOW_SETUPS[command.workflowId]).toBeDefined();
      expect(setupCreditBudget(command.workflowId, { depth: "quick" })).toBeGreaterThan(0);
    }
  });

  it("gates every runnable command on BYOK status", () => {
    for (const command of FIRECRAWL_COMMANDS) {
      expect(commandAvailability(command, false)).toBe("needs-key");
      expect(commandAvailability(command, true)).toBe("enabled");
    }
  });
});

describe("slash parsing and filtering", () => {
  it("executes only an exact command ID and preserves its argument", () => {
    expect(parseSlashCommand("/firecrawl-lead-gen fintech  founders")).toMatchObject({
      kind: "known",
      command: { id: "firecrawl-lead-gen" },
      argument: "fintech  founders",
    });
    expect(parseSlashCommand("/firecrawl-lead fintech")).toEqual({
      kind: "unknown",
      commandId: "firecrawl-lead",
      argument: "fintech",
    });
  });

  it("handles empty arguments, mixed case, URLs, and command-like argument text", () => {
    expect(parseSlashCommand("/FIRECRAWL")).toMatchObject({ kind: "known", argument: "" });
    expect(parseSlashCommand("/firecrawl https://example.com/a?q=x&next=/firecrawl-shop")).toMatchObject({
      kind: "known",
      argument: "https://example.com/a?q=x&next=/firecrawl-shop",
    });
    expect(parseSlashCommand("/firecrawl-qa ignore; /firecrawl-shop")).toMatchObject({
      kind: "known",
      command: { id: "firecrawl-qa" },
      argument: "ignore; /firecrawl-shop",
    });
  });

  it("has an explicit leading-whitespace policy and caps user input", () => {
    expect(parseSlashCommand(" /firecrawl test")).toEqual({ kind: "none" });
    const parsed = parseSlashCommand(`/firecrawl ${"x".repeat(MAX_COMMAND_INPUT + 20)}`);
    expect(parsed.kind === "known" ? parsed.argument : "").toHaveLength(MAX_COMMAND_INPUT);
  });

  it("uses partial matches for filtering only", () => {
    expect(filterSlashCommands("/fir")).toHaveLength(17);
    expect(filterSlashCommands("/lead").map((command) => command.id)).toEqual([
      "firecrawl-lead-gen",
      "firecrawl-lead-research",
    ]);
    expect(filterSlashCommands("hello")).toEqual([]);
  });
});

describe("workflow setup and app metadata", () => {
  function completeValues(commandIndex: number): WorkflowSetupValues {
    const command = FIRECRAWL_COMMANDS[commandIndex];
    const values = initialWorkflowValues(command, "https://example.com");
    for (const field of FIRECRAWL_WORKFLOW_SETUPS[command.workflowId].fields) {
      if (field.type === "checkbox") values[field.id] = true;
      else if (field.type === "number") values[field.id] = field.min ?? 1;
      else if (field.type === "select") values[field.id] = field.options?.[0]?.value ?? "quick";
      else if (field.type === "url") values[field.id] = "https://example.com";
      else if (!values[field.id]) values[field.id] = "bounded public scope";
    }
    return values;
  }

  it("has deterministic valid typed inputs for every enabled workflow", () => {
    FIRECRAWL_COMMANDS.forEach((command, index) => {
      expect(validateWorkflowSetup(command.workflowId, completeValues(index))).toEqual({});
    });
  });

  it("requires the explicit credit confirmation and validates URLs and bounds locally", () => {
    expect(validateWorkflowSetup("firecrawl-deep-research", { topic: "AI", depth: "quick" })).toHaveProperty("confirmCredits");
    expect(validateWorkflowSetup("firecrawl-seo-audit", {
      siteUrl: "file:///private/data",
      boundary: "one section",
      pageCap: 101,
      depth: "quick",
      confirmCredits: true,
    })).toMatchObject({ siteUrl: expect.any(String), pageCap: expect.any(String) });
    const command = FIRECRAWL_COMMANDS.find((candidate) => candidate.id === "firecrawl-deep-research")!;
    expect(() => commandToApp(command, "AI", { topic: "AI", depth: "quick" })).toThrow(
      "Workflow setup must be complete before launch",
    );
  });

  it("creates a stable provider/workflow app without secrets or export claims", () => {
    const command = FIRECRAWL_COMMANDS.find((candidate) => candidate.id === "firecrawl-lead-research")!;
    const values = { ...completeValues(FIRECRAWL_COMMANDS.indexOf(command)), apiKey: "must-not-leak" };
    const first = commandToApp(command, "Small public company", values);
    const second = commandToApp(command, "Small public company", values);
    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({ providerId: "firecrawl", workflowId: command.id });
    expect(first.request).toContain("Small public company");
    expect(first.request).not.toContain("must-not-leak");
    expect(first.request).toContain("Do not claim");
  });
});

describe("CommandMenu and WorkflowSetup rendering", () => {
  let tree: ReactTestRenderer | undefined;
  afterEach(() => {
    if (tree) act(() => tree?.unmount());
    tree = undefined;
  });

  function renderMenu(text: string, hasProviderKey: boolean, onSelect = jest.fn(), onNeedsKey = jest.fn()) {
    act(() => {
      tree = create(
        <CommandMenu
          text={text}
          hasProviderKey={hasProviderKey}
          highlightedIndex={0}
          onHighlightedIndexChange={jest.fn()}
          onSelect={onSelect}
          onNeedsKey={onNeedsKey}
          onDismiss={jest.fn()}
        />,
      );
    });
    return { onSelect, onNeedsKey };
  }

  it("renders filtered, selected, key-required, empty, and accessible states", () => {
    const callbacks = renderMenu("/lead", false);
    const rows = tree!.root.findAll((node) => node.props.accessibilityLabel?.startsWith("/firecrawl-lead") && typeof node.props.onPress === "function");
    expect(new Set(rows.map((row) => row.props.accessibilityLabel)).size).toBe(2);
    expect(rows[0].props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    expect(rows[0].props.accessibilityLabel).toContain("Connect key");
    act(() => rows[0].props.onPress());
    expect(callbacks.onNeedsKey).toHaveBeenCalledWith(expect.objectContaining({ id: "firecrawl-lead-gen" }));
    act(() => tree!.unmount());
    tree = undefined;
    renderMenu("/not-a-command", true);
    expect(tree!.root.findByProps({ accessibilityLabel: "No matching slash commands" })).toBeTruthy();
  });

  it("supports deterministic up/down wrapping and enabled tap selection", () => {
    expect(moveCommandSelection(0, -1, 17)).toBe(16);
    expect(moveCommandSelection(16, 1, 17)).toBe(0);
    const callbacks = renderMenu("/lead", true);
    const row = tree!.root.findAll((node) => node.props.accessibilityLabel?.startsWith("/firecrawl-lead") && typeof node.props.onPress === "function")[0];
    act(() => row.props.onPress());
    expect(callbacks.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "firecrawl-lead-gen" }));
  });

  it("renders unavailable rows as disabled with an explanation", () => {
    const command = FIRECRAWL_COMMANDS[0] as { availability: "enabled" | "unavailable" };
    command.availability = "unavailable";
    try {
      renderMenu("/firecrawl", true);
      const row = tree!.root.findAll((node) => node.props.accessibilityLabel?.startsWith("/firecrawl,") && typeof node.props.onPress === "function")[0];
      expect(row.props.accessibilityState.disabled).toBe(true);
      expect(row.props.accessibilityLabel).toContain("Unavailable");
    } finally {
      command.availability = "enabled";
    }
  });

  it("does not submit incomplete onboarding or make a provider call", () => {
    const onSubmit = jest.fn();
    const command = FIRECRAWL_COMMANDS.find((candidate) => candidate.id === "firecrawl-deep-research")!;
    act(() => {
      tree = create(<WorkflowSetup command={command} argument="" onCancel={jest.fn()} onSubmit={onSubmit} />);
    });
    const run = tree!.root.findByProps({ accessibilityLabel: "Run with maximum 100 credits" });
    act(() => run.props.onPress());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(JSON.stringify(tree!.toJSON())).toContain("is required");
  });
});
