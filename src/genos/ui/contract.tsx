/**
 * The GenOS component CONTRACT - the single model-facing surface.
 *
 * Everything the LLM knows about the component library lives here: names,
 * positional prop schemas and descriptions. They mirror the surface that
 * generates the shared system prompt - which is currently embedded from the
 * appless-os web repo via scripts/embed-prompt.mjs (see the README), so keep
 * this contract and the embedded prompt in sync. Renderers (Cupertino today,
 * Material on Android, Liquid Glass later) only decide how each component
 * LOOKS, never what it IS.
 *
 * buildGenosLibrary() must be called exactly once per bundle: defineComponent
 * registers each schema in zod's global registry by name, and duplicate ids
 * crash JSON-schema conversion. Metro's platform file resolution guarantees
 * this (one library.<platform>.ts per build).
 */
import type { ComponentRenderer, Library } from "@openuidev/react-lang";
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import type { ReactNode } from "react";
import { z } from "zod";

/**
 * Action expression slot (filled by the parser with an evaluated ActionPlan).
 * react-lang 0.1.5 has no tagSchemaId export - registering the schema in
 * zod's global registry under the id "ActionExpression" is the same thing.
 * MUST be a single shared instance: JSON-schema conversion rejects two
 * different schemas carrying the same id.
 */
const actionExpression = z.any();
actionExpression.register(z.globalRegistry, { id: "ActionExpression" });

const imageProp = z.object({ src: z.string(), alt: z.string().optional() });
const rulesProp = z.any();

// Renderer prop types (what each design system implements)
export interface ImageRef {
  src: string;
  alt?: string;
}

export interface CardProps {
  children?: unknown;
}
export interface CardHeaderProps {
  title: string;
  subtitle?: string;
}
export interface TextContentProps {
  text: string;
  style?: "small" | "default" | "large" | "small-heavy" | "large-heavy";
}
export interface TextCalloutProps {
  variant: "neutral" | "info" | "success" | "warning" | "danger";
  title: string;
  description?: string;
}
export interface ListItemProps {
  title: string;
  subtitle?: string | null;
  leading?: string | ImageRef | null;
  trailing?: string | null;
  action?: unknown;
}
export interface ToggleProps {
  title: string;
  on: boolean;
  icon?: string | null;
  subtitle?: string | null;
}
export interface ListBlockProps {
  items?: unknown[];
  header?: string | null;
}
export interface KVListProps {
  rows?: Array<{ label: string; value: string }>;
  header?: string | null;
}
export interface HeroStatProps {
  value: string;
  label?: string | null;
  sublabel?: string | null;
}
export interface StatTilesProps {
  items?: Array<{ label: string; value: string; delta?: string; icon?: string }>;
}
export interface ImageBlockProps {
  src?: string;
  caption?: string | null;
}
export interface PhotoGridProps {
  images?: ImageRef[];
}
export interface BubblesProps {
  messages?: Array<{ text: string; me?: boolean; time?: string }>;
}
export interface ChipsProps {
  labels?: string[];
}
export interface TabsProps {
  items?: unknown[];
}
export interface MapViewProps {
  placeName?: string;
  zoom?: number;
}
export interface CartesianChartProps {
  labels?: string[];
  series?: unknown[];
  variant?: string;
  xLabel?: string;
  yLabel?: string;
}
export interface PieChartProps {
  labels?: string[];
  values?: number[];
  variant?: "pie" | "donut";
  appearance?: "circular" | "semiCircular";
}
export interface InputProps {
  name: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number" | "url";
  rules?: unknown;
  value?: unknown;
}
export interface TextAreaProps {
  name: string;
  placeholder?: string;
  rows?: number;
  rules?: unknown;
  value?: unknown;
}
export interface DatePickerProps {
  name: string;
  mode?: "single" | "range";
  rules?: unknown;
  value?: unknown;
}
export interface SelectProps {
  name: string;
  items?: unknown[];
  placeholder?: string;
  rules?: unknown;
  value?: unknown;
  size?: "small" | "medium" | "large";
}
export interface SliderProps {
  name: string;
  variant: "continuous" | "discrete";
  min: number;
  max: number;
  step?: number;
  defaultValue?: number[];
  label?: string;
  rules?: unknown;
  value?: unknown;
}
export interface FormControlProps {
  label: string;
  input?: unknown;
  hint?: string;
}
export interface ButtonProps {
  label: string;
  action?: unknown;
  variant?: "primary" | "secondary" | "tertiary";
  type?: "normal" | "destructive";
  size?: "extra-small" | "small" | "medium" | "large";
}
export interface ButtonsProps {
  buttons?: unknown[];
  direction?: "row" | "column";
}
export interface FormProps {
  name: string;
  buttons?: unknown;
  fields?: unknown[];
}

/** A design-system renderer for one component of the contract. */
export type Renderer<P> = (renderProps: {
  props: P;
  renderNode: (value: unknown) => ReactNode;
}) => ReactNode;

/**
 * One entry per contract component. TabItem, SelectItem and Series are
 * structural placeholders (consumed by their parents) and render nothing in
 * every design system, so they are not part of the renderer set.
 */
export interface GenosRenderers {
  Card: Renderer<CardProps>;
  CardHeader: Renderer<CardHeaderProps>;
  TextContent: Renderer<TextContentProps>;
  TextCallout: Renderer<TextCalloutProps>;
  ListItem: Renderer<ListItemProps>;
  Toggle: Renderer<ToggleProps>;
  ListBlock: Renderer<ListBlockProps>;
  KVList: Renderer<KVListProps>;
  HeroStat: Renderer<HeroStatProps>;
  StatTiles: Renderer<StatTilesProps>;
  ImageBlock: Renderer<ImageBlockProps>;
  PhotoGrid: Renderer<PhotoGridProps>;
  Bubbles: Renderer<BubblesProps>;
  Chips: Renderer<ChipsProps>;
  Tabs: Renderer<TabsProps>;
  MapView: Renderer<MapViewProps>;
  BarChart: Renderer<CartesianChartProps>;
  LineChart: Renderer<CartesianChartProps>;
  AreaChart: Renderer<CartesianChartProps>;
  PieChart: Renderer<PieChartProps>;
  HorizontalBarChart: Renderer<CartesianChartProps>;
  Form: Renderer<FormProps>;
  FormControl: Renderer<FormControlProps>;
  Input: Renderer<InputProps>;
  TextArea: Renderer<TextAreaProps>;
  Select: Renderer<SelectProps>;
  DatePicker: Renderer<DatePickerProps>;
  Slider: Renderer<SliderProps>;
  Buttons: Renderer<ButtonsProps>;
  Button: Renderer<ButtonProps>;
}

/** Compose the full GenOS library from one design system's renderers. */
export function buildGenosLibrary(renderers: GenosRenderers): Library {
  // defineComponent ties the renderer's prop type to z.infer of the schema;
  // our contract interfaces are hand-written equivalents, so bridge the two.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = <P,>(fn: Renderer<P>) => fn as unknown as ComponentRenderer<any>;

  // Text & headers
  const CardHeader = defineComponent({
    name: "CardHeader",
    props: z.object({ title: z.string(), subtitle: z.string().optional() }),
    description: "Screen header with an iOS large title and an optional subtitle line above it",
    component: r(renderers.CardHeader),
  });

  const TextContent = defineComponent({
    name: "TextContent",
    props: z.object({
      text: z.string(),
      style: z.enum(["small", "default", "large", "small-heavy", "large-heavy"]).optional(),
    }),
    description:
      "Text block. style: 'large-heavy' section titles · 'default' body · 'small' footnotes · '-heavy' = bold",
    component: r(renderers.TextContent),
  });

  const TextCallout = defineComponent({
    name: "TextCallout",
    props: z.object({
      variant: z.enum(["neutral", "info", "success", "warning", "danger"]),
      title: z.string(),
      description: z.string().optional(),
    }),
    description: "iOS notification-style banner for alerts, tips and status messages",
    component: r(renderers.TextCallout),
  });

  // Lists
  const ListItem = defineComponent({
    name: "ListItem",
    props: z.object({
      title: z.string(),
      subtitle: z.string().optional().nullable(),
      leading: z.union([z.string(), imageProp]).optional().nullable(),
      trailing: z.string().optional().nullable(),
      action: actionExpression.optional().nullable(),
    }),
    description:
      'Tappable list row. leading: an icon name ("wifi", "credit-card") shown as a colored badge, OR {src, alt} for a thumbnail image. trailing: small value text on the right ("82%", "4:32 PM", "$12.99"). Rows with an action show a navigation affordance.',
    component: r(renderers.ListItem),
  });

  const Toggle = defineComponent({
    name: "Toggle",
    props: z.object({
      title: z.string(),
      on: z.boolean(),
      icon: z.string().optional().nullable(),
      subtitle: z.string().optional().nullable(),
    }),
    description:
      "iOS switch row for settings screens - flips instantly on tap, no round trip. icon: optional icon name badge.",
    component: r(renderers.Toggle),
  });

  const ListBlock = defineComponent({
    name: "ListBlock",
    props: z.object({
      items: z.array(z.union([ListItem.ref, Toggle.ref])),
      header: z.string().optional().nullable(),
    }),
    description:
      "iOS inset grouped list - the core app navigation surface. items: ListItem and Toggle rows. header: small uppercase section label above the group.",
    component: r(renderers.ListBlock),
  });

  const KVList = defineComponent({
    name: "KVList",
    props: z.object({
      rows: z.array(z.object({ label: z.string(), value: z.string() })),
      header: z.string().optional().nullable(),
    }),
    description:
      "Compact label/value details group (order summary, flight details, nutrition facts, profile fields).",
    component: r(renderers.KVList),
  });

  // Stats & numbers
  const HeroStat = defineComponent({
    name: "HeroStat",
    props: z.object({
      value: z.string(),
      label: z.string().optional().nullable(),
      sublabel: z.string().optional().nullable(),
    }),
    description:
      'One huge centered number - the screen\'s headline stat (temperature "23°", balance "$4,820", steps "12,480").',
    component: r(renderers.HeroStat),
  });

  const StatTiles = defineComponent({
    name: "StatTiles",
    props: z.object({
      items: z.array(
        z.object({
          label: z.string(),
          value: z.string(),
          delta: z.string().optional(),
          icon: z.string().optional(),
        }),
      ),
    }),
    description:
      'Grid of 2-4 KPI tiles: {label, value, delta?, icon?}. delta strings starting with "+" render green, "-" red.',
    component: r(renderers.StatTiles),
  });

  // Media
  const ImageBlock = defineComponent({
    name: "ImageBlock",
    props: z.object({ src: z.string(), caption: z.string().optional().nullable() }),
    description:
      "Full-width hero image with rounded corners; caption overlays the bottom on a gradient.",
    component: r(renderers.ImageBlock),
  });

  const PhotoGrid = defineComponent({
    name: "PhotoGrid",
    props: z.object({ images: z.array(imageProp) }),
    description: "3-column photo grid of {src, alt} images - galleries, memories, product shots.",
    component: r(renderers.PhotoGrid),
  });

  // Messaging
  const Bubbles = defineComponent({
    name: "Bubbles",
    props: z.object({
      messages: z.array(
        z.object({
          text: z.string(),
          me: z.boolean().optional(),
          time: z.string().optional(),
        }),
      ),
    }),
    description:
      "Conversation thread of chat bubbles: {text, me?, time?}. me:true = my bubble aligned right; others aligned left.",
    component: r(renderers.Bubbles),
  });

  // Chips & tabs
  const Chips = defineComponent({
    name: "Chips",
    props: z.object({ labels: z.array(z.string()) }),
    description:
      "Horizontal filter/category pills. LIVE: tapping a chip regenerates the screen filtered to it - no action prop needed. Put the currently-active category first.",
    component: r(renderers.Chips),
  });

  const TabItem = defineComponent({
    name: "TabItem",
    props: z.object({
      label: z.string(),
      children: z.array(z.any()),
    }),
    description: "One tab: label + the content shown when selected.",
    component: () => null, // rendered by Tabs
  });

  const Tabs = defineComponent({
    name: "Tabs",
    props: z.object({ items: z.array(TabItem.ref) }),
    description:
      "Tab switcher that flips between TabItem contents instantly (no round trip).",
    component: r(renderers.Tabs),
  });

  // Map
  const MapView = defineComponent({
    name: "MapView",
    props: z.object({
      placeName: z.string(),
      zoom: z.number().optional(),
    }),
    description:
      'REAL interactive map centered on a place with a marker. placeName: specific place or area, e.g. "Sakura Sushi, Indiranagar, Bengaluru". zoom: 12 = city, 15 = neighborhood (default), 17 = street.',
    component: r(renderers.MapView),
  });

  // Charts
  const Series = defineComponent({
    name: "Series",
    props: z.object({ category: z.string(), values: z.array(z.number()) }),
    description: "One data series",
    component: () => null, // consumed by the chart components
  });

  const cartesianSchema = z.object({
    labels: z.array(z.string()),
    series: z.array(Series.ref),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
  });

  const BarChart = defineComponent({
    name: "BarChart",
    props: cartesianSchema.extend({ variant: z.enum(["grouped", "stacked"]).optional() }),
    description:
      "Vertical bars; use for comparing values across categories with one or more series",
    component: r(renderers.BarChart),
  });

  const HorizontalBarChart = defineComponent({
    name: "HorizontalBarChart",
    props: cartesianSchema.extend({ variant: z.enum(["grouped", "stacked"]).optional() }),
    description: "Horizontal bars; prefer when category labels are long or for ranked lists",
    component: r(renderers.HorizontalBarChart),
  });

  const LineChart = defineComponent({
    name: "LineChart",
    props: cartesianSchema.extend({ variant: z.enum(["linear", "natural", "step"]).optional() }),
    description: "Lines over categories; use for trends and continuous data over time",
    component: r(renderers.LineChart),
  });

  const AreaChart = defineComponent({
    name: "AreaChart",
    props: cartesianSchema.extend({ variant: z.enum(["linear", "natural", "step"]).optional() }),
    description: "Filled area under lines; use for cumulative totals or volume trends over time",
    component: r(renderers.AreaChart),
  });

  const PieChart = defineComponent({
    name: "PieChart",
    props: z.object({
      labels: z.array(z.string()),
      values: z.array(z.number()),
      variant: z.enum(["pie", "donut"]).optional(),
      appearance: z.enum(["circular", "semiCircular"]).optional(),
    }),
    description: "Circular slices; use plucked arrays: PieChart(data.categories, data.values)",
    component: r(renderers.PieChart),
  });

  // Forms & buttons
  const Input = defineComponent({
    name: "Input",
    props: z.object({
      name: z.string(),
      placeholder: z.string().optional(),
      type: z.enum(["text", "email", "password", "number", "url"]).optional(),
      rules: rulesProp.optional(),
      value: z.any().optional(),
    }),
    description: "",
    component: r(renderers.Input),
  });

  const TextArea = defineComponent({
    name: "TextArea",
    props: z.object({
      name: z.string(),
      placeholder: z.string().optional(),
      rows: z.number().optional(),
      rules: rulesProp.optional(),
      value: z.any().optional(),
    }),
    description: "",
    component: r(renderers.TextArea),
  });

  const DatePicker = defineComponent({
    name: "DatePicker",
    props: z.object({
      name: z.string(),
      mode: z.enum(["single", "range"]).optional(),
      rules: rulesProp.optional(),
      value: z.any().optional(),
    }),
    description: "",
    component: r(renderers.DatePicker),
  });

  const SelectItem = defineComponent({
    name: "SelectItem",
    props: z.object({ value: z.string(), label: z.string() }),
    description: "Option for Select",
    component: () => null, // consumed by Select
  });

  const Select = defineComponent({
    name: "Select",
    props: z.object({
      name: z.string(),
      items: z.array(SelectItem.ref),
      placeholder: z.string().optional(),
      rules: rulesProp.optional(),
      value: z.any().optional(),
      size: z.enum(["small", "medium", "large"]).optional(),
    }),
    description: "",
    component: r(renderers.Select),
  });

  const Slider = defineComponent({
    name: "Slider",
    props: z.object({
      name: z.string(),
      variant: z.enum(["continuous", "discrete"]),
      min: z.number(),
      max: z.number(),
      step: z.number().optional(),
      defaultValue: z.array(z.number()).optional(),
      label: z.string().optional(),
      rules: rulesProp.optional(),
      value: z.any().optional(),
    }),
    description: "Numeric slider input; supports continuous and discrete (stepped) variants",
    component: r(renderers.Slider),
  });

  const FormControl = defineComponent({
    name: "FormControl",
    props: z.object({
      label: z.string(),
      input: z.union([Input.ref, TextArea.ref, Select.ref, DatePicker.ref, Slider.ref]),
      hint: z.string().optional(),
    }),
    description: "Field with label, input component, and optional hint text",
    component: r(renderers.FormControl),
  });

  const Button = defineComponent({
    name: "Button",
    props: z.object({
      label: z.string(),
      action: actionExpression.optional(),
      variant: z.enum(["primary", "secondary", "tertiary"]).optional(),
      type: z.enum(["normal", "destructive"]).optional(),
      size: z.enum(["extra-small", "small", "medium", "large"]).optional(),
    }),
    description: "Clickable button",
    component: r(renderers.Button),
  });

  const Buttons = defineComponent({
    name: "Buttons",
    props: z.object({
      buttons: z.array(Button.ref),
      direction: z.enum(["row", "column"]).optional(),
    }),
    description: 'Group of Button components. direction: "row" (default) | "column".',
    component: r(renderers.Buttons),
  });

  const Form = defineComponent({
    name: "Form",
    props: z.object({
      name: z.string(),
      buttons: Buttons.ref,
      fields: z.array(FormControl.ref).optional(),
    }),
    description: "Form container with fields and explicit action buttons",
    component: r(renderers.Form),
  });

  // Root
  /** Everything that may appear directly inside the root screen. */
  const screenChild = z.union([
    CardHeader.ref,
    TextContent.ref,
    TextCallout.ref,
    ListBlock.ref,
    KVList.ref,
    HeroStat.ref,
    StatTiles.ref,
    ImageBlock.ref,
    PhotoGrid.ref,
    Bubbles.ref,
    Chips.ref,
    Tabs.ref,
    MapView.ref,
    BarChart.ref,
    LineChart.ref,
    AreaChart.ref,
    PieChart.ref,
    HorizontalBarChart.ref,
    Form.ref,
    Buttons.ref,
  ]);

  const Card = defineComponent({
    name: "Card",
    props: z.object({ children: z.array(screenChild) }),
    description: "Root of every screen - children stack vertically like a scrolling phone app.",
    component: r(renderers.Card),
  });

  return createLibrary({
    root: "Card",
    components: [
      Card,
      CardHeader,
      TextContent,
      TextCallout,
      ListItem,
      Toggle,
      ListBlock,
      KVList,
      HeroStat,
      StatTiles,
      ImageBlock,
      PhotoGrid,
      Bubbles,
      Chips,
      TabItem,
      Tabs,
      MapView,
      BarChart,
      LineChart,
      AreaChart,
      PieChart,
      HorizontalBarChart,
      Series,
      Form,
      FormControl,
      Input,
      TextArea,
      Select,
      SelectItem,
      DatePicker,
      Slider,
      Buttons,
      Button,
    ],
    componentGroups: [
      {
        name: "Structure",
        components: ["Card", "CardHeader", "TextContent", "TextCallout"],
        notes: [
          "Most screens start with CardHeader(title, subtitle?). Media-first screens (players, galleries, food) may start with ImageBlock instead.",
        ],
      },
      {
        name: "Lists",
        components: ["ListBlock", "ListItem", "Toggle", "KVList"],
        notes: [
          "ListBlock + ListItem rows are the core app navigation pattern - most screens should have one.",
          "Toggle rows are for settings switches; they flip locally without an action.",
        ],
      },
      {
        name: "Stats & Charts",
        components: [
          "HeroStat",
          "StatTiles",
          "BarChart",
          "LineChart",
          "AreaChart",
          "PieChart",
          "HorizontalBarChart",
          "Series",
        ],
        notes: [
          "Dashboards read best as: HeroStat or StatTiles first, then ONE chart, then a ListBlock of items.",
          "Chart values must be non-negative - negative numbers are clamped to 0.",
        ],
      },
      {
        name: "Media & Social",
        components: ["ImageBlock", "PhotoGrid", "Bubbles", "Chips", "Tabs", "TabItem", "MapView"],
        notes: [
          "MapView is a REAL map - use it on location screens (nearby, route, delivery tracking).",
        ],
      },
      {
        name: "Forms & Buttons",
        components: [
          "Form",
          "FormControl",
          "Input",
          "TextArea",
          "Select",
          "SelectItem",
          "DatePicker",
          "Slider",
          "Buttons",
          "Button",
        ],
        notes: [
          "Form ONLY for input screens (compose, checkout, search, booking). Buttons/Button also work standalone outside forms.",
        ],
      },
    ],
  });
}
