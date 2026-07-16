/** Cupertino charts - shared geometry, iOS colors. */
import { createChartRenderers } from "../shared/charts";
import { useCds } from "./theme";

export const { BarChart, LineChart, AreaChart, PieChart, HorizontalBarChart } =
  createChartRenderers(useCds);
