/**
 * Shared chart renderers - lightweight react-native-svg charts, parameterized
 * by a small chart theme so every design system reuses the same geometry with
 * its own colors. Signatures/schemas live in ../contract.tsx.
 */
import React, { useState } from "react";
import { Text as RNText, View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import type { CartesianChartProps, GenosRenderers, PieChartProps, Renderer } from "../contract";

/** The colors a design system supplies to the shared charts. */
export interface ChartTheme {
  /** Gridline / hairline color. */
  sep: string;
  /** Secondary label color (ticks, legends). */
  ink2: string;
  /** Categorical series palette. */
  chartPalette: string[];
}

export type ChartRenderers = Pick<
  GenosRenderers,
  "BarChart" | "LineChart" | "AreaChart" | "PieChart" | "HorizontalBarChart"
>;

/** Evaluated Series element nodes arrive as {props: {category, values}}. */
interface SeriesNode {
  props?: { category?: string; values?: unknown[] };
}

interface SeriesData {
  category: string;
  values: number[];
}

function readSeries(raw: unknown[] | undefined): SeriesData[] {
  return (raw ?? [])
    .map((s) => {
      const p = (s as SeriesNode)?.props;
      if (!p) return null;
      // Charts render a [0..max] domain: negatives are clamped like
      // non-finites (the contract documents cartesian charts as
      // non-negative). Signed domains are a tracked follow-up.
      const values = (Array.isArray(p.values) ? p.values : []).map((v) =>
        typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0,
      );
      return { category: String(p.category ?? ""), values };
    })
    .filter((s): s is SeriesData => !!s && s.values.length > 0);
}

/** Round a domain max up to a "nice" tick value (1/2/2.5/5 × 10^k). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const f = v / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${+(v / 1_000).toFixed(1)}k`;
  return `${+v.toFixed(1)}`;
}

const CHART_HEIGHT = 170;
const GUTTER_L = 36;
const GUTTER_B = 20;
const GUTTER_T = 8;
const GUTTER_R = 8;

function Legend({ series, t }: { series: SeriesData[]; t: ChartTheme }) {
  if (series.length <= 1) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: 12,
        rowGap: 3,
        marginTop: 4,
      }}
    >
      {series.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: t.chartPalette[i % t.chartPalette.length],
            }}
          />
          <RNText style={{ fontSize: 10.5, color: t.ink2 }}>{s.category}</RNText>
        </View>
      ))}
    </View>
  );
}

function AxisTitles({ xLabel, t }: { xLabel?: string; t: ChartTheme }) {
  if (!xLabel) return null;
  return (
    <RNText style={{ textAlign: "center", fontSize: 10, color: t.ink2, marginTop: 2 }}>
      {xLabel}
    </RNText>
  );
}

/** Small y-axis caption above the plot (the contract's yLabel prop). */
function YAxisTitle({ yLabel, t }: { yLabel?: string; t: ChartTheme }) {
  if (!yLabel) return null;
  return <RNText style={{ fontSize: 10, color: t.ink2, marginBottom: 2 }}>{yLabel}</RNText>;
}

/** Shared measured-width chart container. */
function ChartBox({
  children,
  height = CHART_HEIGHT,
}: {
  children: (width: number) => React.ReactNode;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  return (
    <View style={{ width: "100%", height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 40 ? children(width) : null}
    </View>
  );
}

/** Horizontal gridlines + y tick labels + x category labels. */
function CartesianFrame({
  width,
  max,
  labels,
  t,
  xCenters,
}: {
  width: number;
  max: number;
  labels: string[];
  t: ChartTheme;
  xCenters: number[];
}) {
  const plotH = CHART_HEIGHT - GUTTER_T - GUTTER_B;
  const ticks = [0, 0.5, 1];
  // Thin dense x labels so they never collide (~44px each).
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(width / 44))));
  return (
    <G>
      {ticks.map((f, i) => {
        const y = GUTTER_T + plotH * (1 - f);
        return (
          <G key={i}>
            <Path
              d={`M ${GUTTER_L} ${y} H ${width - GUTTER_R}`}
              stroke={t.sep}
              strokeWidth={0.75}
            />
            <SvgText x={GUTTER_L - 5} y={y + 3} fontSize={10} fill={t.ink2} textAnchor="end">
              {formatTick(max * f)}
            </SvgText>
          </G>
        );
      })}
      {labels.map((l, i) =>
        i % every === 0 ? (
          <SvgText
            key={i}
            x={xCenters[i]}
            y={CHART_HEIGHT - 6}
            fontSize={10}
            fill={t.ink2}
            textAnchor="middle"
          >
            {l.length > 8 ? `${l.slice(0, 7)}…` : l}
          </SvgText>
        ) : null,
      )}
    </G>
  );
}

/** Build the five chart renderers around a design system's theme hook. */
export function createChartRenderers(useChartTheme: () => ChartTheme): ChartRenderers {
  function BarChartView({
    props,
    horizontal,
  }: {
    props: CartesianChartProps;
    horizontal?: boolean;
  }) {
  const t = useChartTheme();
  const labels = props.labels ?? [];
  const series = readSeries(props.series);
  if (!labels.length || !series.length) return null;
  const stacked = props.variant === "stacked";

  const maxRaw = stacked
    ? Math.max(...labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)))
    : Math.max(...series.flatMap((s) => s.values));
  const max = niceMax(maxRaw);

  // The horizontal variant renders the same geometry rotated: categories on
  // the y axis, values on x. Implemented separately for readable labels.
  if (horizontal) {
    const rowH = 26;
    const height = GUTTER_T + labels.length * rowH + 24;
    return (
      <View>
        <YAxisTitle yLabel={props.yLabel} t={t} />
        <ChartBox height={height}>
          {(width) => {
            const gutterL = 64;
            const plotW = width - gutterL - GUTTER_R;
            return (
              <Svg width={width} height={height}>
                {[0, 0.5, 1].map((f, i) => (
                  <G key={i}>
                    <Path
                      d={`M ${gutterL + plotW * f} ${GUTTER_T} V ${height - 20}`}
                      stroke={t.sep}
                      strokeWidth={0.75}
                    />
                    <SvgText
                      x={gutterL + plotW * f}
                      y={height - 7}
                      fontSize={10}
                      fill={t.ink2}
                      textAnchor="middle"
                    >
                      {formatTick(max * f)}
                    </SvgText>
                  </G>
                ))}
                {labels.map((l, i) => {
                  const y0 = GUTTER_T + i * rowH;
                  const inner = stacked ? rowH - 10 : (rowH - 10) / series.length;
                  let acc = 0;
                  return (
                    <G key={i}>
                      <SvgText
                        x={gutterL - 6}
                        y={y0 + rowH / 2 + 3}
                        fontSize={10}
                        fill={t.ink2}
                        textAnchor="end"
                      >
                        {l.length > 9 ? `${l.slice(0, 8)}…` : l}
                      </SvgText>
                      {series.map((s, si) => {
                        const v = s.values[i] ?? 0;
                        const w = (v / max) * plotW;
                        const x = stacked ? gutterL + (acc / max) * plotW : gutterL;
                        if (stacked) acc += v;
                        const y = stacked ? y0 + 5 : y0 + 5 + si * inner;
                        return (
                          <Rect
                            key={si}
                            x={x}
                            y={y}
                            width={Math.max(0, w)}
                            height={stacked ? rowH - 10 : Math.max(1, inner - 1)}
                            rx={3}
                            fill={t.chartPalette[si % t.chartPalette.length]}
                          />
                        );
                      })}
                    </G>
                  );
                })}
              </Svg>
            );
          }}
        </ChartBox>
        <Legend series={series} t={t} />
        <AxisTitles xLabel={props.xLabel} t={t} />
      </View>
    );
  }

  return (
    <View>
      <YAxisTitle yLabel={props.yLabel} t={t} />
      <ChartBox>
        {(width) => {
          const plotW = width - GUTTER_L - GUTTER_R;
          const plotH = CHART_HEIGHT - GUTTER_T - GUTTER_B;
          const slot = plotW / labels.length;
          const groupW = Math.min(slot * 0.66, 34);
          const xCenters = labels.map((_, i) => GUTTER_L + slot * i + slot / 2);
          return (
            <Svg width={width} height={CHART_HEIGHT}>
              <CartesianFrame width={width} max={max} labels={labels} t={t} xCenters={xCenters} />
              {labels.map((_, i) => {
                let acc = 0;
                const barW = stacked ? groupW : groupW / series.length;
                return (
                  <G key={i}>
                    {series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      const h = (v / max) * plotH;
                      const x = stacked
                        ? xCenters[i] - groupW / 2
                        : xCenters[i] - groupW / 2 + si * barW;
                      const y = stacked
                        ? GUTTER_T + plotH - h - (acc / max) * plotH
                        : GUTTER_T + plotH - h;
                      if (stacked) acc += v;
                      return (
                        <Rect
                          key={si}
                          x={x}
                          y={y}
                          width={Math.max(1, barW - 1)}
                          height={Math.max(0, h)}
                          rx={3}
                          fill={t.chartPalette[si % t.chartPalette.length]}
                        />
                      );
                    })}
                  </G>
                );
              })}
            </Svg>
          );
        }}
      </ChartBox>
      <Legend series={series} t={t} />
      <AxisTitles xLabel={props.xLabel} t={t} />
    </View>
  );
}

/** Catmull-Rom → cubic bezier smoothing for the "natural" variant. */
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function linePath(pts: Array<[number, number]>, variant?: string): string {
  if (pts.length < 2) return "";
  if (variant === "natural") return smoothPath(pts);
  if (variant === "step") {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` H ${pts[i][0]} V ${pts[i][1]}`;
    }
    return d;
  }
  return `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(" L ")}`;
}

function LineChartView({ props, area }: { props: CartesianChartProps; area?: boolean }) {
  const t = useChartTheme();
  const labels = props.labels ?? [];
  const series = readSeries(props.series);
  if (!labels.length || !series.length) return null;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));

  return (
    <View>
      <YAxisTitle yLabel={props.yLabel} t={t} />
      <ChartBox>
        {(width) => {
          const plotW = width - GUTTER_L - GUTTER_R;
          const plotH = CHART_HEIGHT - GUTTER_T - GUTTER_B;
          const n = Math.max(labels.length - 1, 1);
          const xCenters = labels.map((_, i) => GUTTER_L + (plotW * i) / n);
          return (
            <Svg width={width} height={CHART_HEIGHT}>
              <CartesianFrame width={width} max={max} labels={labels} t={t} xCenters={xCenters} />
              {series.map((s, si) => {
                const pts: Array<[number, number]> = s.values
                  .slice(0, labels.length)
                  .map((v, i) => [xCenters[i], GUTTER_T + plotH - (v / max) * plotH]);
                const color = t.chartPalette[si % t.chartPalette.length];
                const d = linePath(pts, props.variant);
                const baseline = GUTTER_T + plotH;
                return (
                  <G key={si}>
                    {area && pts.length >= 2 && (
                      <Path
                        d={`${d} L ${pts[pts.length - 1][0]} ${baseline} L ${pts[0][0]} ${baseline} Z`}
                        fill={color}
                        opacity={0.18}
                      />
                    )}
                    <Path d={d} stroke={color} strokeWidth={2} fill="none" />
                    {pts.length <= 16 &&
                      pts.map((p, i) => (
                        <Circle key={i} cx={p[0]} cy={p[1]} r={2.4} fill={color} />
                      ))}
                  </G>
                );
              })}
            </Svg>
          );
        }}
      </ChartBox>
      <Legend series={series} t={t} />
      <AxisTitles xLabel={props.xLabel} t={t} />
    </View>
  );
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number, inner: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  if (inner <= 0) {
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  }
  const xi0 = cx + inner * Math.cos(a1);
  const yi0 = cy + inner * Math.sin(a1);
  const xi1 = cx + inner * Math.cos(a0);
  const yi1 = cy + inner * Math.sin(a0);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi0} ${yi0} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
}

// Public chart renderers
const BarChart: Renderer<CartesianChartProps> = ({ props }) => (
  <BarChartView props={props} />
);

const HorizontalBarChart: Renderer<CartesianChartProps> = ({ props }) => (
  <BarChartView props={props} horizontal />
);

const LineChart: Renderer<CartesianChartProps> = ({ props }) => (
  <LineChartView props={props} />
);

const AreaChart: Renderer<CartesianChartProps> = ({ props }) => (
  <LineChartView props={props} area />
);

const PieChart: Renderer<PieChartProps> = ({ props }) => {
  const t = useChartTheme();
  const labels = props.labels ?? [];
  const values = (props.values ?? []).map((v) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0,
  );
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const semi = props.appearance === "semiCircular";
  const height = semi ? 110 : CHART_HEIGHT;
  return (
    <View>
      <ChartBox height={height}>
        {(width) => {
          const r = semi ? Math.min(width / 2 - 8, 92) : Math.min(height / 2 - 8, 78);
          const inner = props.variant === "donut" ? r * 0.6 : 0;
          const cx = width / 2;
          const cy = semi ? height - 6 : height / 2;
          const start = semi ? Math.PI : -Math.PI / 2;
          const span = semi ? Math.PI : Math.PI * 2;
          let a = start;
          return (
            <Svg width={width} height={height}>
              {values.map((v, i) => {
                const a0 = a;
                const a1 = a + (v / total) * span;
                a = a1;
                if (v <= 0) return null;
                return (
                  <Path
                    key={i}
                    d={arcPath(cx, cy, r, a0, a1 - 0.008, inner)}
                    fill={t.chartPalette[i % t.chartPalette.length]}
                  />
                );
              })}
            </Svg>
          );
        }}
      </ChartBox>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: 12,
          rowGap: 3,
          marginTop: 4,
        }}
      >
        {labels.slice(0, values.length).map((l, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: t.chartPalette[i % t.chartPalette.length],
              }}
            />
            <RNText style={{ fontSize: 10.5, color: t.ink2 }}>{l}</RNText>
          </View>
        ))}
      </View>
    </View>
  );
};

  return { BarChart, LineChart, AreaChart, PieChart, HorizontalBarChart };
}
