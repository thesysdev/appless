/**
 * Material renderer smoke test - builds the Android library in this file's
 * fresh module registry (zod global registry is per-jest-file, so no
 * duplicate-id clash with the Cupertino suite).
 */
import { Renderer } from "@openuidev/react-lang";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
jest.mock("react-native-webview", () => ({ WebView: () => null }));
// eslint-disable-next-line import/first
import { buildGenosLibrary } from "../src/genos/ui/contract";
// eslint-disable-next-line import/first
import { materialRenderers } from "../src/genos/ui/material";

const lib = buildGenosLibrary(materialRenderers);

const PROGRAM = `root = Card([header, chips, tiles, chart, itin, compose])
header = CardHeader("Goa Getaway", "JULY 11 - 13, 2026")
chips = Chips(["Full Plan", "Beaches", "Nightlife"])
tiles = StatTiles([{label: "Budget", value: "$640", delta: "-12%", icon: "wallet"}, {label: "Weather", value: "28°C", icon: "cloud-rain"}])
chart = AreaChart(["Fri", "Sat", "Sun"], [spend], "natural")
spend = Series("Spend", [120, 260, 180])
itin = ListBlock([d1, tg], "Weekend itinerary")
d1 = ListItem("Friday: North Goa", "Baga Beach & Sunset Dinner", "map-pin", "Day 1", Action([@ToAssistant("Open Friday detail")]))
tg = Toggle("Notifications", true, "bell")
compose = Form("book", btns, [msg])
msg = FormControl("Name", input)
input = Input("name", "Your name…")
btns = Buttons([go])
go = Button("Book now", Action([@ToAssistant("Book the trip")]), "primary")`;

function renderProgram(program: string): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<Renderer response={program} library={lib} isStreaming={false} />);
  });
  return tree;
}

it("renders a mixed screen with the Material renderers", () => {
  const tree = renderProgram(PROGRAM);
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain("Goa Getaway");
  expect(text).toContain("Full Plan");
  expect(text).toContain("$640");
  expect(text).toContain("Friday: North Goa");
  expect(text).toContain("Book now");
  act(() => tree.unmount());
});

it("renders streaming prefixes without crashing", () => {
  for (let i = 30; i <= PROGRAM.length; i += 60) {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <Renderer response={PROGRAM.slice(0, i)} library={lib} isStreaming />,
      );
    });
    act(() => tree.unmount());
  }
});
