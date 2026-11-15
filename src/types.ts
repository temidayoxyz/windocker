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
export type Pin = PinApp | PinGroup;

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

export interface Config {
  version: number;
  firstLaunchComplete: boolean;
  style: string;
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
  displayMode: "primary" | "follow";
  clock24h: boolean;
  launchAtStartup: boolean;
  widgets: Widget[];
  pins: Pin[];
  groups: Group[];
  todos: Todo[];
  notes: Note[];
  events: CalEvent[];
  weatherQuery: string;
  githubToken: string;
  icalUrl: string;
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
  wifiOn: boolean | null;
  bluetoothOn: boolean | null;
  brightness: number | null;
  toastsEnabled: boolean | null;
  lightTheme: boolean;
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
    hi: number;
    lo: number;
    hourly: { label: string; tempC: number; code: number }[];
    daily: { label: string; hi: number; lo: number; code: number }[];
    error: string | null;
  } | null;
  github: { login: string; total: number; streak: number; cells: number[]; error: string | null } | null;
  currency: { from: string; to: string; rate: number; amount: number; error: string | null } | null;
  remoteEvents: CalEvent[];
  selfCpu: number;
  selfMem: number;
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
  { kind: "apps", name: "Apps", category: "Apps", blurb: "Start, pinned apps, and open windows." },
  { kind: "search", name: "Search", category: "Apps", blurb: "Search the web, or open a folder path." },
  { kind: "commands", name: "Commands", category: "Apps", blurb: "Type a name to launch an app or an action." },
  { kind: "recycle", name: "Recycle Bin", category: "Apps", blurb: "What the bin holds, and a way to empty it." },
  { kind: "storage", name: "Storage", category: "Apps", blurb: "Free space on each drive." },
  { kind: "cpu", name: "CPU", category: "System", blurb: "Processor load as a ring." },
  { kind: "ram", name: "Memory", category: "System", blurb: "Memory in use as a ring." },
  { kind: "network", name: "Network", category: "System", blurb: "Download and upload speed." },
  { kind: "top", name: "Top apps", category: "System", blurb: "The apps using the most CPU and memory." },
  { kind: "battery", name: "Battery", category: "System", blurb: "Charge level and charging state." },
  { kind: "brightness", name: "Brightness", category: "System", blurb: "Display brightness, when the panel exposes it." },
  { kind: "quick", name: "Quick toggles", category: "System", blurb: "Wi-Fi, Bluetooth, theme, and notification toasts." },
  { kind: "volume", name: "Volume", category: "Media", blurb: "Output volume. Scroll the tile to change it." },
  { kind: "mic", name: "Microphone", category: "Media", blurb: "Mute the microphone." },
  { kind: "now-playing", name: "Now playing", category: "Media", blurb: "The track reported to Windows, with play and skip." },
  { kind: "clock", name: "Clock", category: "Clocks", blurb: "The time, with seconds." },
  { kind: "date", name: "Date", category: "Clocks", blurb: "Today as a calendar page." },
  { kind: "world-clock", name: "World clocks", category: "Clocks", blurb: "Three cities, with the local offset." },
  { kind: "day-progress", name: "Day progress", category: "Clocks", blurb: "How much of today is behind you." },
  { kind: "timer", name: "Timer", category: "Productivity", blurb: "A countdown you start from the bar." },
  { kind: "stopwatch", name: "Stopwatch", category: "Productivity", blurb: "Start, pause, and reset." },
  { kind: "pomodoro", name: "Focus", category: "Productivity", blurb: "Focus rounds and breaks." },
  { kind: "todos", name: "To-dos", category: "Productivity", blurb: "The next open task, ticked from the dock." },
  { kind: "notes", name: "Notes", category: "Productivity", blurb: "A note kept on this PC." },
  { kind: "calendar", name: "Calendar", category: "Productivity", blurb: "Local events, plus an iCal link if you add one." },
  { kind: "screen-time", name: "Screen Time", category: "Productivity", blurb: "Today, by hour and by app. Kept on this PC." },
  { kind: "weather", name: "Weather", category: "Weather", blurb: "Temperature now, the next hours, and the next days." },
  { kind: "github", name: "GitHub", category: "Developer", blurb: "Your contribution year, from a personal access token." },
  { kind: "currency", name: "Currency", category: "Finance", blurb: "A live rate from the European Central Bank feed." },
];

export const CATEGORIES = ["Apps", "System", "Media", "Clocks", "Productivity", "Weather", "Developer", "Finance"];
