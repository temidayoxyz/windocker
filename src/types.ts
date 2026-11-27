export interface Widget {
  id: string;
  kind: string;
  settings: Record<string, unknown>;
}

export interface PinApp {
  type: "app";
  id: string;
}
export interface PinGroup {
  type: "group";
  id: string;
}
export interface PinFolder {
  type: "folder";
  id: string;
  name: string;
  path: string;
}
export type Pin = PinApp | PinGroup | PinFolder;

export interface FolderItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
  ext: string;
}

export interface QuickPreview {
  name: string;
  path: string;
  kind: "image" | "text" | "dir" | "binary";
  size: number;
  content: string | null;
  childCount: number | null;
}

export interface Group {
  id: string;
  name: string;
  appIds: string[];
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}
export interface Note {
  id: string;
  text: string;
  updatedMs: number;
}
export interface CalEvent {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  source: string;
}

export type DockStyle = "liquid-glass" | "glass" | "ios" | "midnight" | "black" | "white" | "clear";
export type IconPack = "windocker" | "squircle" | "dark" | "original";

export interface Config {
  version: number;
  firstLaunchComplete: boolean;
  style: DockStyle | string;
  accent: string;
  edge: "top" | "bottom";
  layout: "pill" | "full";
  scale: number;
  spacing: number;
  padding: number;
  edgeDistance: number;
  autoHide: boolean;
  magnification: boolean;
  showLabels: boolean;
  previews: boolean;
  lockDock: boolean;
  taskbarMode: "untouched" | "autohide" | "hidden";
  displayMode: "primary" | "follow" | "all";
  clock24h: boolean;
  launchAtStartup: boolean;
  iconPack: IconPack | string;
  squircleWrap: boolean;
  showRunningApps: boolean;
  dockDivider: boolean;
  nativeBlur: boolean;
  autoPauseMeeting: boolean;
  customIcons: Record<string, string>;
  widgets: Widget[];
  pins: Pin[];
  groups: Group[];
  todos: Todo[];
  notes: Note[];
  events: CalEvent[];
  weatherQuery: string;
  githubToken: string;
  icalUrl: string;
  deepseekKey: string;
  currencyFrom: string;
  currencyTo: string;
  currencyAmount: number;
  worldCities: string[];
  timerDeadlineMs: number | null;
  timerPausedMs: number | null;
  stopwatchAccumMs: number;
  stopwatchStartedMs: number | null;
  pomoDeadlineMs: number | null;
  pomoPhase: "focus" | "break";
  pomoRunning: boolean;
  pomoFocusMin: number;
  pomoBreakMin: number;
  pomoRound: number;
  pomoTotalRounds: number;
}

export interface AppEntry {
  id: string;
  name: string;
  launch: string;
  exe: string;
  icon: string | null;
}

export interface RunningWindow {
  hwnd: number;
  exe: string;
  title: string;
  name: string;
  icon: string | null;
}

export interface AiProviderStat {
  id: string;
  name: string;
  primaryLabel: string;
  primaryPct: number;
  primaryMeta: string;
  secondaryLabel: string;
  secondaryPct: number;
  secondaryMeta: string;
  model: string;
  detail: string;
  connected: boolean;
}

export interface WallpaperItem {
  path: string;
  name: string;
  thumb: string;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  connected: boolean;
}

export interface BluetoothDevice {
  name: string;
  address: string;
  connected: boolean;
  paired: boolean;
}

export interface Snapshot {
  nowMs: number;
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  netDown: number;
  netUp: number;
  batteryPct: number | null;
  batteryCharging: boolean;
  onAc: boolean;
  volume: number;
  muted: boolean;
  micMuted: boolean;
  audioDevice: string;
  wifiOn: boolean | null;
  bluetoothOn: boolean | null;
  brightness: number | null;
  toastsEnabled: boolean | null;
  lightTheme: boolean;
  wallpaperThumb: string | null;
  running: RunningWindow[];
  media: { title: string; artist: string; status: string; positionSec: number; durationSec: number } | null;
  disks: { name: string; mount: string; total: number; free: number }[];
  topCpu: { name: string; value: number }[];
  topRam: { name: string; value: number }[];
  recycleCount: number;
  recycleBytes: number;
  screenTodaySec: number;
  screenHours: number[];
  screenApps: { name: string; seconds: number }[];
  clocks: { label: string; time: string; offset: string }[];
  weather: {
    city: string;
    tempC: number;
    code: number;
    wind: number;
    humidity: number;
    precip: number;
    hi: number;
    lo: number;
    sunrise: string;
    sunset: string;
    hourly: { label: string; tempC: number; code: number }[];
    daily: { label: string; hi: number; lo: number; code: number }[];
    error: string | null;
  } | null;
  github: { login: string; total: number; streak: number; cells: number[]; error: string | null } | null;
  currency: { from: string; to: string; rate: number; amount: number; error: string | null } | null;
  aiUsage: AiProviderStat[];
  remoteEvents: CalEvent[];
  selfCpu: number;
  selfMem: number;
  foregroundHwnd: number;
  fullscreen: boolean;
  screenCssWidth: number;
  screenCssHeight: number;
  monitorScale: number;
}

export interface CatalogItem {
  kind: string;
  name: string;
  category: string;
  blurb: string;
}

export const CATALOG: CatalogItem[] = [
  { kind: "apps", name: "macOS App Dock", category: "Apps", blurb: "Launchpad, pinned apps, running Windows apps & Finder." },
  { kind: "launchpad", name: "Launchpad", category: "Apps", blurb: "Full macOS app grid launcher in one click." },
  { kind: "commands", name: "Spotlight", category: "Apps", blurb: "macOS-style command, math, and app launcher." },
  { kind: "search", name: "Quick Search", category: "Apps", blurb: "Search the web or open any local Windows path." },
  { kind: "recycle", name: "macOS Trash", category: "Apps", blurb: "macOS Trash bin icon with item count & empty action." },
  { kind: "storage", name: "Storage", category: "Apps", blurb: "Free disk space bar across your Windows drives." },
  { kind: "screenshot", name: "Capture Tools", category: "Apps", blurb: "Full screen, active window, and captures folder." },
  { kind: "wallpaper", name: "Wallpaper", category: "Apps", blurb: "Live desktop wallpaper preview & switcher." },
  { kind: "system-rings", name: "System Rings", category: "System", blurb: "Dual CPU & RAM circular gauges like LumaBar." },
  { kind: "cpu", name: "CPU Ring", category: "System", blurb: "Live processor load circular gauge." },
  { kind: "ram", name: "Memory Ring", category: "System", blurb: "Live RAM usage circular gauge." },
  { kind: "network", name: "Network Speed", category: "System", blurb: "Live download/upload throughput & sparkline." },
  { kind: "top", name: "Top Processes", category: "System", blurb: "Top CPU and RAM apps with Task Manager link." },
  { kind: "battery", name: "Battery Wave", category: "System", blurb: "Liquid wave or squircle charge indicator." },
  { kind: "brightness", name: "Brightness", category: "System", blurb: "Inline macOS Control Center brightness slider." },
  { kind: "quick", name: "Control Center", category: "System", blurb: "Wi-Fi, Bluetooth, Dark Mode & Focus/Toasts pills." },
  { kind: "volume", name: "Audio & Volume", category: "Media", blurb: "Active audio device name, mute & inline slider." },
  { kind: "mic", name: "Microphone", category: "Media", blurb: "Instant system microphone mute toggle." },
  { kind: "now-playing", name: "Now Playing", category: "Media", blurb: "Live Windows media session with inline play/skip." },
  { kind: "today", name: "Today & Weather", category: "Clocks", blurb: "Date, live time & current weather in one bento tile." },
  { kind: "clock", name: "Clock & Date", category: "Clocks", blurb: "Tabular clock with seconds and short date." },
  { kind: "flip-clock", name: "Flip Clock", category: "Clocks", blurb: "Split-flap digital clock cards." },
  { kind: "analog-clock", name: "Analog Clock", category: "Clocks", blurb: "Minimal dark macOS watch face with sweeping hand." },
  { kind: "date", name: "Calendar Badge", category: "Clocks", blurb: "macOS-style red-header day calendar tile." },
  { kind: "world-clock", name: "World Clocks", category: "Clocks", blurb: "Live cities and UTC offsets." },
  { kind: "day-progress", name: "Day Dot Matrix", category: "Clocks", blurb: "Dot-matrix progress grid for today." },
  { kind: "ai-limits", name: "AI Usage", category: "AI & Dev", blurb: "Local Claude, Codex & Gemini usage + DeepSeek balance." },
  { kind: "github", name: "GitHub Activity", category: "AI & Dev", blurb: "Contribution heatmap & streak via local token." },
  { kind: "pomodoro", name: "Focus Timer", category: "Productivity", blurb: "Red-accented 25m focus & break rounds with inline play." },
  { kind: "timer", name: "Quick Timer", category: "Productivity", blurb: "Blue-bordered countdown with one-click play." },
  { kind: "stopwatch", name: "Stopwatch", category: "Productivity", blurb: "Precision start, pause, and reset." },
  { kind: "todos", name: "Reminders", category: "Productivity", blurb: "Inline checkable tasks & open count badge." },
  { kind: "notes", name: "macOS Notes", category: "Productivity", blurb: "Notes app icon with live snippet & quick edit." },
  { kind: "calendar", name: "Calendar", category: "Productivity", blurb: "Upcoming local & iCal events with meeting auto-pause." },
  { kind: "screen-time", name: "Screen Time", category: "Productivity", blurb: "Hourly PC usage chart & top foreground apps." },
  { kind: "weather", name: "Weather", category: "Weather", blurb: "Current temperature, icon & sky condition." },
  { kind: "weather-details", name: "Weather Details", category: "Weather", blurb: "Wind, precipitation, and daily high/low range." },
  { kind: "currency", name: "Currency", category: "Finance", blurb: "Live ECB exchange rate converter tile." },
  { kind: "spacer", name: "Divider", category: "Apps", blurb: "Subtle macOS dock vertical separator." },
];

export const CATEGORIES = ["Apps", "System", "Media", "Clocks", "Productivity", "AI & Dev", "Weather", "Finance"];

export const STYLE_OPTIONS: { id: DockStyle; name: string; swatch: string }[] = [
  { id: "liquid-glass", name: "Liquid Glass", swatch: "linear-gradient(135deg, rgba(45,55,75,0.85), rgba(18,20,28,0.9))" },
  { id: "glass", name: "macOS Dark", swatch: "rgba(22,24,30,0.86)" },
  { id: "ios", name: "iOS Frosted", swatch: "rgba(242,244,248,0.86)" },
  { id: "midnight", name: "Midnight", swatch: "rgba(8,11,20,0.92)" },
  { id: "black", name: "Pure Black", swatch: "#141416" },
  { id: "white", name: "Pure White", swatch: "#f5f5f7" },
  { id: "clear", name: "Clear", swatch: "transparent" },
];

export const ICON_PACKS: { id: IconPack; name: string; desc: string }[] = [
  { id: "windocker", name: "Windocker", desc: "Authentic app icons with bespoke system controls" },
  { id: "squircle", name: "Squircle Frame", desc: "Native app icons framed in glass squircles" },
  { id: "dark", name: "Dark Frame", desc: "Native app icons framed in dark slate squircles" },
  { id: "original", name: "Original", desc: "Unframed native Windows icons" },
];

export const ACCENT_PRESETS = [
  "#0a84ff",
  "#5e5ce6",
  "#bf5af2",
  "#ff375f",
  "#ff453a",
  "#ff9f0a",
  "#30d158",
  "#64d2ff",
];
