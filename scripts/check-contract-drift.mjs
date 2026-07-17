/**
 * Contract-drift guard: the embedded system prompt is the model's component
 * vocabulary, and `src/genos/ui/contract.tsx` is what the app can actually
 * render. If the two drift apart the model emits components that render as
 * NOTHING (react-lang returns null for unknown components), so this script
 * fails CI on any mismatch. Run with `npm run check:drift`; regenerate the
 * prompt with `npm run generate:prompt` after contract changes.
 *
 * Checks, both directions:
 *  1. every component defined in the contract is mentioned in the prompt;
 *  2. every component documented in the prompt (signature lines) exists in
 *     the contract;
 *  3. every component-looking call token anywhere in the prompt resolves to
 *     a contract component, a known non-component callable, or the allowlist.
 *
 * Documented allowlist (prompt-side names that are intentionally NOT in the
 * native contract):
 *  - Stack: appears only in the positional-arguments syntax example, not a
 *    real component.
 *  - CheckBoxGroup, RadioGroup: web-contract components the native renderer
 *    sets do not implement; scripts/embed-prompt.mjs strips them from the
 *    prompt at embed time, so they must never reappear - but if they ever
 *    do (hand-edited prompt), the failure message should say "stripped",
 *    not "unknown".
 *
 * Non-component callables in the prompt (action steps and syntax prose, not
 * components): Action, OS, ToAssistant, OpenUrl, TypeName.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractSrc = readFileSync(join(root, "src/genos/ui/contract.tsx"), "utf-8");
const promptSrc = readFileSync(join(root, "src/genos/generated/system-prompt.ts"), "utf-8");

// The generated module embeds the prompt as one JSON string literal.
let prompt;
try {
  prompt = JSON.parse(promptSrc.slice(promptSrc.indexOf("= ") + 2).replace(/;\s*$/, ""));
} catch (err) {
  console.error(
    `check-contract-drift: could not parse src/genos/generated/system-prompt.ts: ${err.message}`,
  );
  process.exit(1);
}

/** Prompt-side names intentionally absent from the native contract. */
const ALLOWLIST = new Map([
  ["Stack", "syntax example only (positional arguments)"],
  ["CheckBoxGroup", "web-only component, stripped by scripts/embed-prompt.mjs"],
  ["RadioGroup", "web-only component, stripped by scripts/embed-prompt.mjs"],
]);

/** Call tokens in the prompt that are action steps or prose, not components. */
const NON_COMPONENTS = new Set(["Action", "OS", "ToAssistant", "OpenUrl", "TypeName"]);

const contractNames = new Set(
  [...contractSrc.matchAll(/defineComponent\(\{\s*name: "([^"]+)"/g)].map((m) => m[1]),
);
if (contractNames.size === 0) {
  console.error("check-contract-drift: no defineComponent names found in contract.tsx");
  process.exit(1);
}

// Components documented by a signature line at the start of a prompt line.
const documented = new Set(
  [...prompt.matchAll(/^([A-Z][A-Za-z]+)\(/gm)].map((m) => m[1]),
);
// Every component-looking call token in the whole prompt.
const referenced = new Set(
  [...prompt.matchAll(/\b([A-Z][a-zA-Z]+)\(/g)].map((m) => m[1]),
);

const problems = [];

// Direction 1: contract -> prompt (word-boundary mention anywhere).
for (const name of [...contractNames].sort()) {
  if (!new RegExp(`\\b${name}\\b`).test(prompt)) {
    problems.push(`contract component "${name}" is never mentioned in the prompt`);
  }
}

// Direction 2: documented prompt components -> contract.
for (const name of [...documented].sort()) {
  if (NON_COMPONENTS.has(name)) continue;
  if (ALLOWLIST.has(name)) {
    problems.push(
      `"${name}" is documented in the prompt but is allowlisted (${ALLOWLIST.get(name)}) - it must be stripped at embed time`,
    );
    continue;
  }
  if (!contractNames.has(name)) {
    problems.push(`prompt documents "${name}" but it is not in the contract (renders as nothing)`);
  }
}

// Direction 3: any call token elsewhere in the prompt must resolve.
for (const name of [...referenced].sort()) {
  if (NON_COMPONENTS.has(name) || contractNames.has(name) || ALLOWLIST.has(name)) continue;
  problems.push(
    `prompt references "${name}(...)" which is neither a contract component nor a known callable`,
  );
}

if (problems.length > 0) {
  console.error(
    `check-contract-drift: ${problems.length} drift problem(s) between\n` +
      "src/genos/ui/contract.tsx and src/genos/generated/system-prompt.ts:\n\n" +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\n\nFix the contract or regenerate the prompt (npm run generate:prompt).\n" +
      "If a prompt-only name is intentional, document it in the ALLOWLIST in\n" +
      "scripts/check-contract-drift.mjs.",
  );
  process.exit(1);
}

console.log(
  `check-contract-drift: OK - ${contractNames.size} contract components, ` +
    `${documented.size} documented in prompt, ${ALLOWLIST.size} allowlisted exceptions`,
);
