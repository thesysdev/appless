export interface AppDef {
  id: string;
  name: string;
  emoji: string;
  /** Gradient stops for the icon tile. */
  tile: [string, string];
  /** The request sent to the model to open the app's home screen. */
  request: string;
}

export const DEFAULT_TILE: [string, string] = ["#5e5ce6", "#bf5af2"];

const app = (
  id: string,
  name: string,
  emoji: string,
  tile: [string, string],
  request: string,
): AppDef => ({
  id,
  name,
  emoji,
  tile,
  request,
});

export const APPS: AppDef[] = [
  app(
    "messages",
    "Messages",
    "💬",
    ["#34c759", "#28a745"],
    'Open the "Messages" app home screen: an inbox list of 7 conversations with contact names, last message snippets, timestamps, and a compose button.',
  ),
  app(
    "food",
    "Food",
    "🍜",
    ["#ff9f0a", "#ff6b22"],
    'Open the "Food" delivery app home screen: hero image, cuisine filter chips, and a list of popular restaurants with ratings, delivery times, and thumbnail images.',
  ),
  app(
    "fitness",
    "Fitness",
    "💪",
    ["#ff375f", "#c2185b"],
    'Open the "Fitness" app home screen: today\'s activity stats, a weekly workout bar chart, and a list of recent workouts with durations and calories.',
  ),
  app(
    "banking",
    "Banking",
    "💳",
    ["#30d158", "#0a84ff"],
    'Open the "Banking" app home screen: current balance, a monthly spending line chart, spending category chips, and a list of recent transactions with merchants and amounts.',
  ),
  app(
    "flights",
    "Flights",
    "✈️",
    ["#0a84ff", "#5e5ce6"],
    'Open the "Flights" app home screen: an upcoming flight status card with route and gate, plus a list of cheap weekend destinations with prices and thumbnail images.',
  ),
  app(
    "calendar",
    "Calendar",
    "📅",
    ["#ff453a", "#ff9f0a"],
    'Open the "Calendar" app home screen: today\'s date header and a list of 6 events for today with times, titles, locations, and a new-event button.',
  ),
  app(
    "music",
    "Music",
    "🎵",
    ["#bf5af2", "#ff375f"],
    'Open the "Music" app home screen: a now-playing section with album art image, playback buttons, and a list of playlists and recently played albums with cover images.',
  ),
  app(
    "photos",
    "Photos",
    "🌅",
    ["#64d2ff", "#5e5ce6"],
    'Open the "Photos" app home screen: a memories highlight image, an image gallery of 6 recent photos, and a tappable albums list (Summer, Food, Friends...) with photo counts.',
  ),
  app(
    "weather",
    "Weather",
    "⛅",
    ["#5ac8fa", "#007aff"],
    'Open the "Weather" app home screen: current conditions for Bengaluru with a big temperature, an hourly temperature area chart, and a 5-day forecast list.',
  ),
  app(
    "notes",
    "Notes",
    "📝",
    ["#ffd60a", "#ff9f0a"],
    'Open the "Notes" app home screen: a search field, pinned note callout, and a list of 6 notes with titles, snippets, and edited timestamps, plus a new-note button.',
  ),
  app(
    "maps",
    "Maps",
    "🗺️",
    ["#32d74b", "#0a84ff"],
    'Open the "Maps" app home screen: a search field, a MapView of the Bengaluru city center, and a nearby places list with categories, distances, and ratings.',
  ),
  app(
    "settings",
    "Settings",
    "⚙️",
    ["#8e8e93", "#48484a"],
    'Open the "Settings" app home screen: a profile row, then settings rows for Wi-Fi, Display, Sound, Battery, and Privacy with current-state subtitles.',
  ),
];

export function summonApp(name: string): AppDef {
  return {
    id: `summon-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    emoji: "✨",
    tile: DEFAULT_TILE,
    request: `Open an app called "${name}". Invent a plausible, polished home screen for it with realistic content and tappable rows or buttons for its main features.`,
  };
}

/**
 * Rotating suggestion chips on the appless home. Each is phrased as a spoken
 * command and routed through the same pipeline as voice - chips ARE voice.
 */
export interface Suggestion {
  emoji: string;
  label: string;
  command: string;
}

export const SUGGESTIONS: Suggestion[] = [
  { emoji: "🍜", label: "Order dinner", command: "order some dinner from a great place nearby" },
  { emoji: "💳", label: "My spending", command: "show my spending this month" },
  { emoji: "💬", label: "Text Maya", command: "text Maya that I'm running 15 minutes late" },
  { emoji: "✈️", label: "Weekend in Goa", command: "plan a weekend trip to Goa" },
  { emoji: "📅", label: "My day", command: "what does my day look like" },
  { emoji: "🎵", label: "Play something", command: "play something upbeat" },
  { emoji: "⛅", label: "Weather", command: "what's the weather this week" },
  { emoji: "🏃", label: "My workouts", command: "show my workouts this week" },
  { emoji: "🗺️", label: "Coffee nearby", command: "find a good coffee shop near me" },
  { emoji: "📝", label: "New note", command: "start a note for my grocery list" },
];
