/** The Material 3 (Android) renderer set for the AppLess contract. */
import type { ApplessRenderers } from "../contract";
import { createChartRenderers } from "../shared/charts";
import {
  Bubbles,
  Card,
  CardHeader,
  Chips,
  HeroStat,
  ImageBlock,
  KVList,
  ListBlock,
  ListItem,
  PhotoGrid,
  StatTiles,
  Tabs,
  TextCallout,
  TextContent,
  Toggle,
} from "./components";
import {
  Button,
  Buttons,
  DatePicker,
  Form,
  FormControl,
  Input,
  Select,
  Slider,
  TextArea,
} from "./forms";
import { MapView } from "./map";
import { useMdChartTheme } from "./theme";

const { BarChart, LineChart, AreaChart, PieChart, HorizontalBarChart } =
  createChartRenderers(useMdChartTheme);

export const materialRenderers: ApplessRenderers = {
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
  Tabs,
  MapView,
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  HorizontalBarChart,
  Form,
  FormControl,
  Input,
  TextArea,
  Select,
  DatePicker,
  Slider,
  Buttons,
  Button,
};
