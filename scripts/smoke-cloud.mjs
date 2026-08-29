/**
 * End-to-end smoke test against OpenUI Cloud: sends the exact request the app
 * sends (generated config block, model, Cerebras-only routing) and prints the
 * streamed screen. Needs THESYS_API_KEY in the environment.
 *
 *   THESYS_API_KEY=sk-th-… node scripts/smoke-cloud.mjs "wifi settings"
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiKey = process.env.THESYS_API_KEY;
if (!apiKey) throw new Error("set THESYS_API_KEY");

const generated = readFileSync(join(root, "src/genos/generated/system-prompt.ts"), "utf8");
const SYSTEM_PROMPT = JSON.parse(generated.match(/^export const SYSTEM_PROMPT = (".*");$/m)[1]);

const res = await fetch("https://api.thesys.dev/v1/embed/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: "google/gemma-4-31b-it",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: process.argv[2] ?? "wifi settings" },
    ],
    stream: true,
    temperature: 0.8,
    max_completion_tokens: 3072,
    provider: { only: ["cerebras"], allow_fallbacks: false },
    metadata: {
      thesys: JSON.stringify({
        c1_openrouter_provider: { only: ["cerebras"], allow_fallbacks: false },
      }),
    },
  }),
});
if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

for await (const chunk of res.body) {
  for (const line of Buffer.from(chunk).toString("utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    const parsed = JSON.parse(payload);
    if (parsed.error) throw new Error(JSON.stringify(parsed.error));
    process.stdout.write(parsed.choices?.[0]?.delta?.content ?? "");
  }
}
process.stdout.write("\n");
