/**
 * Headless smoke test for the whole generated-screen path: openui-lang
 * parsing → patched Renderer (0.1.5, Fragment wrappers) → the RN Cupertino
 * components, charts and forms. The programs are the web app's own prompt
 * exemplars, i.e. exactly what the model produces.
 */
import { Renderer } from "@openuidev/react-lang";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// WebView has no native module under jest - MapView isn't exercised here.
jest.mock("react-native-webview", () => ({ WebView: () => null }));

// eslint-disable-next-line import/first
import { genosLibrary } from "../src/genos/library";

const SETTINGS_SCREEN = `root = Card([header, connectivity, display])
header = CardHeader("Settings")
connectivity = ListBlock([wifi, bt], "CONNECTIVITY")
wifi = ListItem("Wi-Fi", null, "wifi", "HomeNet", Action([@ToAssistant("Open the Wi-Fi settings screen")]))
bt = ListItem("Bluetooth", null, "bluetooth", "On", Action([@ToAssistant("Open the Bluetooth settings screen")]))
display = ListBlock([dark, bright], "DISPLAY")
dark = Toggle("Dark Mode", true, "moon")
bright = ListItem("Brightness", "Auto-adjusting", "sun", "68%", Action([@ToAssistant("Open the brightness screen")]))`;

const DASHBOARD_SCREEN = `root = Card([header, balance, tiles, chart, txs])
header = CardHeader("Wallet", "Personal · ··4821")
balance = HeroStat("$8,427.50", "AVAILABLE BALANCE", "+$1,204 vs last month")
tiles = StatTiles([{label: "Spent", value: "$2,318", delta: "-12%", icon: "arrow-down-right"}, {label: "Saved", value: "$940", delta: "+8%", icon: "piggy-bank"}])
chart = AreaChart(["Feb", "Mar", "Apr"], [spend], "natural")
spend = Series("Spending", [2100, 1890, 2480])
txs = ListBlock([t1])
t1 = ListItem("Blue Tokai Coffee", "Today, 9:12 AM", "coffee", "-$6.40", Action([@ToAssistant("Open the transaction detail screen")]))`;

const CHAT_SCREEN = `root = Card([header, thread, compose])
header = CardHeader("Maya Chen", "mobile · active now")
thread = Bubbles([{text: "Are we still on for dinner tonight?", me: false, time: "2:02 PM"}, {text: "Yes! Sakura Sushi at 7?", me: true}])
compose = Form("reply", btns, [msg])
msg = FormControl("Message", input)
input = Input("text", "Message…")
btns = Buttons([send])
send = Button("Send", Action([@ToAssistant("Send the reply")]), "primary")`;

function renderProgram(program: string): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <Renderer response={program} library={genosLibrary} isStreaming={false} />,
    );
  });
  return tree;
}

function allText(tree: ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe("generated screens render with the RN library", () => {
  it("renders a grouped-list settings screen", () => {
    const tree = renderProgram(SETTINGS_SCREEN);
    const text = allText(tree);
    expect(text).toContain("Settings");
    expect(text).toContain("Wi-Fi");
    expect(text).toContain("HomeNet");
    expect(text).toContain("CONNECTIVITY");
    expect(text).toContain("Dark Mode");
    act(() => tree.unmount());
  });

  it("renders a dashboard with hero stat, tiles and a chart", () => {
    const tree = renderProgram(DASHBOARD_SCREEN);
    const text = allText(tree);
    expect(text).toContain("$8,427.50");
    expect(text).toContain("AVAILABLE BALANCE");
    expect(text).toContain("$2,318");
    expect(text).toContain("Blue Tokai Coffee");
    act(() => tree.unmount());
  });

  it("renders a conversation with a compose form", () => {
    const tree = renderProgram(CHAT_SCREEN);
    const text = allText(tree);
    expect(text).toContain("Maya Chen");
    expect(text).toContain("Sakura Sushi at 7?");
    expect(text).toContain("Send");
    act(() => tree.unmount());
  });

  it("renders partial (streaming) programs without crashing", () => {
    const partial = DASHBOARD_SCREEN.slice(0, Math.floor(DASHBOARD_SCREEN.length * 0.4));
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Renderer response={partial} library={genosLibrary} isStreaming />);
    });
    expect(tree.toJSON()).toBeTruthy();
    act(() => tree.unmount());
  });
});
