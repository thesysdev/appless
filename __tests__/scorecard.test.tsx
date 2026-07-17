/**
 * GenUI scorecard rig: scores every exemplar screen in scorecard/corpus on
 * contract validity (parser + zod props) and headless render success through
 * BOTH design-system libraries, then writes the score table to
 * scorecard/SCORECARD.md. Run with `npm run scorecard`.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Renderer } from "@openuidev/react-lang";
import type { Library } from "@openuidev/react-lang";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// WebView has no native module under jest - MapView renders as null here.
jest.mock("react-native-webview", () => ({ WebView: () => null }));

// eslint-disable-next-line import/first
import { genosLibrary } from "../src/genos/library";
// eslint-disable-next-line import/first
import { buildGenosLibrary } from "../src/genos/ui/contract";
// eslint-disable-next-line import/first
import { materialRenderers } from "../src/genos/ui/material";
// eslint-disable-next-line import/first
import { formatScorecard, scoreContract, type ScreenScore } from "../scorecard/harness";

const materialLibrary = buildGenosLibrary(materialRenderers);

const corpusDir = join(__dirname, "..", "scorecard", "corpus");
const files = readdirSync(corpusDir)
  .filter((f) => f.endsWith(".txt"))
  .sort();

function renderCheck(library: Library, program: string): { ok: boolean; note?: string } {
  let tree: ReactTestRenderer | undefined;
  try {
    act(() => {
      tree = create(<Renderer response={program} library={library} isStreaming={false} />);
    });
    const json = tree?.toJSON();
    act(() => tree?.unmount());
    return json ? { ok: true } : { ok: false, note: "rendered an empty tree" };
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return { ok: false, note: message.slice(0, 120) };
  }
}

const scores: ScreenScore[] = files.map((file) => {
  const source = readFileSync(join(corpusDir, file), "utf-8").trim();
  const score = scoreContract(file.replace(/\.txt$/, ""), source, genosLibrary);
  if (score.contractOk) {
    const c = renderCheck(genosLibrary, source);
    score.cupertinoOk = c.ok;
    if (c.note) score.renderNotes.push(`cupertino: ${c.note}`);
    const m = renderCheck(materialLibrary, source);
    score.materialOk = m.ok;
    if (m.note) score.renderNotes.push(`material: ${m.note}`);
  }
  return score;
});

writeFileSync(
  join(corpusDir, "..", "SCORECARD.md"),
  formatScorecard(scores, Object.keys(genosLibrary.components).sort()),
);

describe("GenUI scorecard", () => {
  it("has at least 10 corpus screens", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it("covers every contract component across the corpus", () => {
    const used = new Set(scores.flatMap((s) => s.components));
    const missing = Object.keys(genosLibrary.components).filter((c) => !used.has(c));
    expect(missing).toEqual([]);
  });

  for (const score of scores) {
    it(`${score.name}: contract-valid and renders in both design systems`, () => {
      expect(score.propErrors).toEqual([]);
      expect(score.unknownComponents).toEqual([]);
      expect(score.contractOk).toBe(true);
      expect(score.cupertinoOk).toBe(true);
      expect(score.materialOk).toBe(true);
    });
  }
});
