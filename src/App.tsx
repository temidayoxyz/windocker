import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, CATEGORIES, type AppEntry, type Config, type Pin, type RunningWindow, type Snapshot, type Widget } from "./types";

const emptySnap = (): Snapshot => ({
  nowMs: Date.now(),
  cpu: 0,
  ramUsed: 0,
  ramTotal: 1,
  netDown: 0,
  netUp: 0,
  batteryPct: null,
  batteryCharging: false,
  onAc: true,
  volume: 0,
  muted: false,
  micMuted: false,
  wifiOn: null,
  bluetoothOn: null,
  brightness: null,
  toastsEnabled: null,
  lightTheme: false,
  running: [],
  media: null,
  disks: [],
  topCpu: [],
  topRam: [],
  recycleCount: 0,
  recycleBytes: 0,
  screenTodaySec: 0,
  screenHours: Array(24).fill(0),
  screenApps: [],
  clocks: [],
  weather: null,
  github: null,
  currency: null,
  remoteEvents: [],
  selfCpu: 0,
  selfMem: 0,
  fullscreen: false,
  screenCssWidth: 1280,
  screenCssHeight: 800,
  monitorScale: 1,
});

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
function speed(n: number) {
  return `${bytes(n)}/s`;
}
function mins(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function clock(ms: number, h24: boolean) {
  const d = new Date(ms);
  if (h24) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}
function fileOf(path: string) {
  return path.split(/[/\\]/).pop()?.toLowerCase() ?? path.toLowerCase();
}
function winsFor(app: AppEntry, running: RunningWindow[]) {
  const file = fileOf(app.exe);
  if (!file) return [];
  return running.filter((w) => fileOf(w.exe) === file);
}
function sky(code: number) {
  if (code < 0) return "Set a city";
  if (code === 0) return "Clear";
  if (code < 3) return "Fair";
  if (code < 50) return "Cloud";
  if (code < 60) return "Fog";
  if (code < 70) return "Rain";
  if (code < 80) return "Snow";
  if (code < 90) return "Showers";
  return "Storm";
}
function remain(deadline: number | null, paused: number | null, now: number) {
  if (paused != null) return paused;
  if (deadline == null) return 0;
  return Math.max(0, deadline - now);
}
function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [catalog, setCatalog] = useState<AppEntry[]>([]);
  const [snap, setSnap] = useState<Snapshot>(emptySnap);
  const [panel, setPanel] = useState<"welcome" | "picker" | "settings" | string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: { label: string; run: () => void; danger?: boolean }[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("All");
  const stageRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<number[]>(Array(28).fill(0));
  const chimed = useRef<number | null>(null);

  const fail = (error: unknown) => setToast(error instanceof Error ? error.message : String(error));
  const call = async (cmd: string, args?: Record<string, unknown>) => {
    try {
      const next = await invoke<Config | void>(cmd, args);
      if (next && typeof next === "object" && "widgets" in next) setConfig(next);
    } catch (error) {
      fail(error);
    }
  };

  useEffect(() => {
    let stop = false;
    const un: Array<() => void> = [];
    invoke<{ config: Config; catalog: AppEntry[] }>("bootstrap").then((boot) => {
      if (stop) return;
      setConfig(boot.config);
      setCatalog(boot.catalog);
      if (!boot.config.firstLaunchComplete) setPanel("welcome");
    }).catch(fail);
    listen<Snapshot>("snapshot", (e) => setSnap(e.payload)).then((f) => un.push(f));
    listen<AppEntry[]>("catalog", (e) => setCatalog(e.payload)).then((f) => un.push(f));
    listen<Config>("config", (e) => setConfig(e.payload)).then((f) => un.push(f));
    listen("open-settings", () => setPanel("settings")).then((f) => un.push(f));
    listen<{ paths?: string[] }>("tauri://drag-drop", (event) => {
      for (const path of event.payload.paths ?? []) {
        invoke<Config>("pin_drop", { path }).then(setConfig).catch(fail);
      }
    }).then((f) => un.push(f));
    return () => {
      stop = true;
      un.forEach((f) => f());
    };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !config) return;
    let frame = 0;
    let lastW = 0;
    let lastH = 0;
    const send = () => {
      const r = el.getBoundingClientRect();
      const kids = Array.from(el.children).reduce((sum, child) => sum + Math.max(child.getBoundingClientRect().height, child.scrollHeight), 0);
      const width = Math.ceil(Math.max(el.scrollWidth, r.width) + 8);
      const height = Math.ceil(Math.max(el.scrollHeight, r.height, kids + 36));
      if (Math.abs(width - lastW) < 4 && Math.abs(height - lastH) < 4) return;
      lastW = width;
      lastH = height;
      invoke("fit_window", { width, height }).catch(() => undefined);
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(send);
    });
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, [config?.style, config?.layout, config?.edge, config?.widgets.length, panel]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!config) return;
    const left = remain(config.timerDeadlineMs, null, snap.nowMs);
    if (config.timerDeadlineMs && config.timerPausedMs == null && left === 0 && chimed.current !== config.timerDeadlineMs) {
      chimed.current = config.timerDeadlineMs;
      invoke("chime").catch(() => undefined);
      call("patch_config", { patch: { timerDeadlineMs: null } });
    }
    const pomoLeft = remain(config.pomoDeadlineMs, null, snap.nowMs);
    if (config.pomoRunning && config.pomoDeadlineMs && pomoLeft === 0 && chimed.current !== config.pomoDeadlineMs) {
      chimed.current = config.pomoDeadlineMs;
      invoke("chime").catch(() => undefined);
      const next = config.pomoPhase === "focus" ? "break" : "focus";
      const mins = next === "focus" ? config.pomoFocusMin : config.pomoBreakMin;
      call("patch_config", { patch: { pomoPhase: next, pomoDeadlineMs: snap.nowMs + mins * 60000, pomoRunning: false } });
    }
  }, [snap.nowMs, config?.timerDeadlineMs, config?.pomoDeadlineMs, config?.pomoRunning]);

  useEffect(() => {
    netRef.current = [...netRef.current.slice(1), snap.netDown];
  }, [snap.netDown]);

  const apps = useMemo(() => new Map(catalog.map((a) => [a.id, a])), [catalog]);
  const dragPin = useRef<string | null>(null);
  const movePin = (from: string, to: string) => {
    if (!config || from === to) return;
    const ids = config.pins.map((pin) => pin.id);
    const fromIndex = ids.indexOf(from);
    const toIndex = ids.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return;
    ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, from);
    call("reorder_pins", { ids });
  };

  if (!config) return null;
  const openCard = typeof panel === "string" && !["welcome", "picker", "settings"].includes(panel) ? panel : null;
  const vars = {
    "--accent": config.accent,
    "--scale": String(config.scale),
    "--h": `calc(46px * ${config.scale})`,
    "--gap": `${config.spacing}px`,
    "--pad": `${config.padding}px`,
    "--screen": `${Math.max(640, snap.screenCssWidth)}px`,
    "--text": config.style === "white" || config.style === "ios" ? "#1d1d1f" : "#f5f5f7",
    "--muted": config.style === "white" || config.style === "ios" ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.62)",
    "--pill": pillColor(config.style),
    "--chip": config.style === "white" ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.08)",
    "--card": config.style === "white" || config.style === "ios" ? "rgba(255,255,255,.9)" : "rgba(22,22,24,.86)",
    "--line": config.style === "white" || config.style === "ios" ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.14)",
    "--sheen": "rgba(255,255,255,.22)",
    "--up": "#30d158",
  } as React.CSSProperties;

  const onMenu = (event: React.MouseEvent, items: { label: string; run: () => void; danger?: boolean }[]) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  };

  const moveWidget = (id: string, delta: number) => {
    const ids = config.widgets.map((w) => w.id);
    const index = ids.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    call("reorder_widgets", { ids });
  };

  return (
    <div
      ref={stageRef}
      className="stage"
      data-style={config.style}
      data-edge={config.edge}
      data-layout={config.layout}
      data-mag={config.magnification ? "1" : "0"}
      style={vars}
      onMouseDown={() => setMenu(null)}
      onContextMenu={(event) => onMenu(event, [
        { label: "Widgets", run: () => setPanel("picker") },
        { label: "Settings", run: () => setPanel("settings") },
        { label: config.edge === "bottom" ? "Move to top" : "Move to bottom", run: () => call("patch_config", { patch: { edge: config.edge === "bottom" ? "top" : "bottom" } }) },
        { label: "Quit Windocker", run: () => invoke("quit"), danger: true },
      ])}
    >
      {panel === "welcome" && <Welcome config={config} onDone={(patch) => { call("patch_config", { patch: { ...patch, firstLaunchComplete: true } }); setPanel(null); }} />}
      {panel === "picker" && (
        <Picker
          config={config}
          filter={filter}
          category={category}
          onFilter={setFilter}
          onCategory={setCategory}
          onAdd={(kind) => call("add_widget", { kind })}
          onRemove={(id) => call("remove_widget", { id })}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "settings" && <Settings config={config} snap={snap} onPatch={(patch) => call("patch_config", { patch })} onClose={() => setPanel(null)} />}
      {openCard && <WidgetCard id={openCard} config={config} snap={snap} apps={apps} onPatch={(patch) => call("patch_config", { patch })} onCall={call} onClose={() => { setPanel(null); invoke("clear_preview").catch(() => undefined); }} />}
      <div className="pill">
        {config.widgets.map((widget) => (
          <Tile
            key={widget.id}
            widget={widget}
            config={config}
            snap={snap}
            apps={apps}
            onOpen={() => setPanel(widget.id)}
            onMenu={(event) => onMenu(event, [
              { label: "Move left", run: () => moveWidget(widget.id, -1) },
              { label: "Move right", run: () => moveWidget(widget.id, 1) },
              { label: "Remove", run: () => call("remove_widget", { id: widget.id }), danger: true },
            ])}
            onCall={call}
            setPanel={setPanel}
            dragPin={dragPin}
            movePin={movePin}
            openMenu={(event, items) => {
              event.preventDefault();
              event.stopPropagation();
              setMenu({ x: event.clientX, y: event.clientY, items });
            }}
          />
        ))}
      </div>
      {menu && (
        <div className="menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
          {menu.items.map((item, index) => (
            <button key={`${item.label}-${index}`} className={item.danger ? "danger" : ""} onClick={() => { item.run(); setMenu(null); }}>{item.label}</button>
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function pillColor(style: string) {
  if (style === "white") return "rgba(255,255,255,.88)";
  if (style === "ios") return "rgba(255,255,255,.55)";
  if (style === "midnight") return "rgba(8,10,16,.72)";
  if (style === "black") return "#1c1c1e";
  if (style === "clear") return "transparent";
  return "rgba(16,18,22,.46)";
}

function Icon({ app, running }: { app?: AppEntry; running?: boolean }) {
  const hue = app ? [...app.name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360 : 210;
  return (
    <span className={running ? "app run" : "app"} style={{ background: app?.icon ? "transparent" : `hsl(${hue} 55% 42%)` }}>
      {app?.icon ? <img src={app.icon} alt="" /> : <span className="letter">{(app?.name ?? "?").slice(0, 1)}</span>}
    </span>
  );
}

function Ring({ value }: { value: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg className="ring" viewBox="0 0 28 28" aria-hidden>
      <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(127,127,127,.25)" strokeWidth="3" />
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 14 14)" />
    </svg>
  );
}

function Tile(props: {
  widget: Widget;
  config: Config;
  snap: Snapshot;
  apps: Map<string, AppEntry>;
  onOpen: () => void;
  onMenu: (event: React.MouseEvent) => void;
  onCall: (cmd: string, args?: Record<string, unknown>) => void;
  setPanel: (panel: string) => void;
  dragPin: React.MutableRefObject<string | null>;
  movePin: (from: string, to: string) => void;
  openMenu: (event: React.MouseEvent, items: { label: string; run: () => void; danger?: boolean }[]) => void;
}) {
  const { widget, config, snap, apps, onOpen, onMenu, onCall } = props;
  const common = { className: `tile ${widget.kind}`, onContextMenu: onMenu, onClick: onOpen };
  if (widget.kind === "apps") {
    return (
      <div className="tile apps" onContextMenu={onMenu}>
        <button className="start" title="Start" onClick={() => invoke("open_start")}>W</button>
        {config.pins.map((pin, index) => (
          <PinButton
            key={pin.type + pin.id}
            pin={pin}
            config={config}
            snap={snap}
            apps={apps}
            onCall={onCall}
            setPanel={props.setPanel}
            onDragPin={(id) => { props.dragPin.current = id; }}
            onDropPin={(id) => { if (props.dragPin.current) props.movePin(props.dragPin.current, id); }}
            onPinMenu={props.openMenu}
            nextAppId={config.pins.slice(index + 1).find((item) => item.type === "app")?.id}
          />
        ))}
      </div>
    );
  }
  if (widget.kind === "clock") return <button {...common}><span className="value">{clock(snap.nowMs, config.clock24h)}</span></button>;
  if (widget.kind === "date") {
    const d = new Date(snap.nowMs);
    return <button {...common} className="tile date-badge"><span>{d.toLocaleDateString([], { weekday: "short" }).toUpperCase()}</span><b>{d.getDate()}</b></button>;
  }
  if (widget.kind === "cpu") return <button {...common}><Ring value={snap.cpu} /><span className="stack"><span className="kicker">CPU</span><span className="value">{Math.round(snap.cpu)}%</span></span></button>;
  if (widget.kind === "ram") {
    const pct = snap.ramTotal ? (snap.ramUsed / snap.ramTotal) * 100 : 0;
    return <button {...common}><Ring value={pct} /><span className="stack"><span className="kicker">Memory</span><span className="value">{Math.round(pct)}%</span></span></button>;
  }
  if (widget.kind === "battery") {
    const text = snap.batteryPct == null ? "AC" : `${snap.batteryCharging ? "+" : ""}${snap.batteryPct}`;
    return <button {...common} className="tile battery-pill">{text}</button>;
  }
  if (widget.kind === "volume") {
    return (
      <div className="tile" onContextMenu={onMenu} onWheel={(e) => { e.preventDefault(); onCall("set_volume", { value: Math.min(1, Math.max(0, snap.volume + (e.deltaY < 0 ? 0.04 : -0.04))) }); }}>
        <button onClick={() => onCall("toggle_mute")}>{snap.muted ? "Muted" : `${Math.round(snap.volume * 100)}`}</button>
        <input aria-label="Volume" type="range" min={0} max={1} step={0.01} value={snap.volume} onChange={(e) => onCall("set_volume", { value: Number(e.target.value) })} />
      </div>
    );
  }
  if (widget.kind === "mic") return <button {...common} onClick={() => onCall("toggle_mic")}>{snap.micMuted ? "Mic off" : "Mic on"}</button>;
  if (widget.kind === "now-playing") {
    const media = snap.media;
    return (
      <button {...common}>
        <span className={media?.status === "playing" ? "bars playing" : "bars"}><i style={{ height: 14 }} /><i style={{ height: 20 }} /><i style={{ height: 10 }} /></span>
        <span className="stack"><span className="value truncate">{media?.title || "Nothing playing"}</span><span className="tiny truncate">{media?.artist || "Windows media session"}</span></span>
      </button>
    );
  }
  if (widget.kind === "weather") {
    const w = snap.weather;
    return <button {...common}><span className="stack"><span className="kicker">{w?.city || "Weather"}</span><span className="value">{w && !w.error ? `${Math.round(w.tempC)}°` : "—"}</span></span><span className="tiny">{w ? sky(w.code) : ""}</span></button>;
  }
  if (widget.kind === "network") return <button {...common}><span className="stack"><span className="tiny">Down {speed(snap.netDown)}</span><span className="tiny">Up {speed(snap.netUp)}</span></span></button>;
  if (widget.kind === "screen-time") return <button {...common}><span className="stack"><span className="kicker">Screen Time</span><span className="value">{mins(snap.screenTodaySec)}</span></span></button>;
  if (widget.kind === "todos") {
    const open = config.todos.filter((t) => !t.done);
    const next = open[0];
    return <button {...common}><span className="stack"><span className="kicker">{open.length} open</span><span className="value truncate">{next?.text || "All done"}</span></span></button>;
  }
  if (widget.kind === "notes") return <button {...common}><span className="stack"><span className="kicker">Note</span><span className="tiny truncate">{config.notes[0]?.text || "Write a note"}</span></span></button>;
  if (widget.kind === "calendar") {
    const events = [...config.events, ...snap.remoteEvents].sort((a, b) => a.startMs - b.startMs).filter((e) => e.endMs >= snap.nowMs);
    const next = events[0];
    return <button {...common}><span className="stack"><span className="kicker">{next ? new Date(next.startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Calendar"}</span><span className="value truncate">{next?.title || "No upcoming events"}</span></span></button>;
  }
  if (widget.kind === "timer") return <button {...common}><span className="value">{fmt(remain(config.timerDeadlineMs, config.timerPausedMs, snap.nowMs))}</span></button>;
  if (widget.kind === "stopwatch") {
    const extra = config.stopwatchStartedMs ? snap.nowMs - config.stopwatchStartedMs : 0;
    return <button {...common}><span className="value">{fmt(config.stopwatchAccumMs + extra)}</span></button>;
  }
  if (widget.kind === "pomodoro") return <button {...common}><span className="stack"><span className="kicker">{config.pomoPhase === "focus" ? "Focus" : "Break"}</span><span className="value">{fmt(remain(config.pomoDeadlineMs, config.pomoRunning ? null : remain(config.pomoDeadlineMs, null, snap.nowMs), snap.nowMs))}</span></span></button>;
  if (widget.kind === "github") return <button {...common}><span className="stack"><span className="kicker">{snap.github?.login || "GitHub"}</span><span className="value">{snap.github && !snap.github.error ? snap.github.total : "Connect"}</span></span></button>;
  if (widget.kind === "currency") {
    const c = snap.currency;
    const out = c && !c.error ? (c.amount * c.rate).toFixed(2) : "—";
    return <button {...common}><span className="stack"><span className="kicker">{c ? `${c.amount} ${c.from}` : "Currency"}</span><span className="value">{out} {c?.to ?? ""}</span></span></button>;
  }
  if (widget.kind === "storage") {
    const disk = snap.disks[0];
    const pct = disk && disk.total ? Math.round((1 - disk.free / disk.total) * 100) : 0;
    return <button {...common}><span className="stack"><span className="kicker">{disk?.mount || "Storage"}</span><span className="value">{disk ? bytes(disk.free) : "—"}</span></span><span className="track"><span style={{ width: `${pct}%` }} /></span></button>;
  }
  if (widget.kind === "recycle") return <button {...common}><span className="stack"><span className="kicker">Recycle Bin</span><span className="value">{snap.recycleCount}</span></span></button>;
  if (widget.kind === "quick") return <button {...common}><span className="tiny">{snap.wifiOn == null ? "Wi-Fi" : snap.wifiOn ? "Wi-Fi on" : "Wi-Fi off"}</span><span className="tiny">{snap.lightTheme ? "Light" : "Dark"}</span></button>;
  if (widget.kind === "brightness") return <button {...common}><span className="stack"><span className="kicker">Brightness</span><span className="value">{snap.brightness == null ? "n/a" : `${snap.brightness}%`}</span></span></button>;
  if (widget.kind === "top") return <button {...common}><span className="stack"><span className="kicker">Top CPU</span><span className="tiny truncate">{snap.topCpu[0] ? `${snap.topCpu[0].name} ${Math.round(snap.topCpu[0].value)}%` : "Quiet"}</span></span></button>;
  if (widget.kind === "day-progress") {
    const d = new Date(snap.nowMs);
    const pct = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400) * 100;
    return <button {...common}><span className="stack"><span className="kicker">Today</span><span className="value">{Math.round(pct)}%</span></span></button>;
  }
  if (widget.kind === "world-clock") {
    const first = snap.clocks[0];
    return <button {...common}><span className="stack"><span className="kicker">{first?.label || "World"}</span><span className="value">{first?.time || "—"}</span></span></button>;
  }
  if (widget.kind === "search" || widget.kind === "commands") return <button {...common}><span className="value">{widget.kind === "search" ? "Search" : "Commands"}</span></button>;
  return <button {...common}><span className="value">{widget.kind}</span></button>;
}

function PinButton(props: {
  pin: Pin;
  config: Config;
  snap: Snapshot;
  apps: Map<string, AppEntry>;
  onCall: (cmd: string, args?: Record<string, unknown>) => void;
  setPanel: (id: string) => void;
  onDragPin: (id: string) => void;
  onDropPin: (id: string) => void;
  onPinMenu: (event: React.MouseEvent, items: { label: string; run: () => void; danger?: boolean }[]) => void;
  nextAppId?: string;
}) {
  const { pin, config, snap, apps, onCall, setPanel } = props;
  if (pin.type === "group") {
    const group = config.groups.find((g) => g.id === pin.id);
    return (
      <button
        className="app"
        title={group?.name || "Group"}
        draggable
        onDragStart={() => props.onDragPin(pin.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); props.onDropPin(pin.id); }}
        onClick={() => setPanel(`group:${pin.id}`)}
      >
        <span className="letter">{(group?.name || "G").slice(0, 1)}</span>
      </button>
    );
  }
  const app = apps.get(pin.id);
  const windows = app ? winsFor(app, snap.running) : [];
  return (
    <button
      className="app-hit"
      title={app?.name || pin.id}
      draggable
      onDragStart={() => props.onDragPin(pin.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); props.onDropPin(pin.id); }}
      onClick={() => {
        if (!app) return;
        if (windows.length === 0) onCall("launch_app", { id: app.id });
        else if (windows.length === 1) onCall("activate_window", { hwnd: windows[0].hwnd });
        else setPanel(`windows:${app.id}`);
      }}
      onContextMenu={(event) => {
        const next = props.nextAppId;
        props.onPinMenu(event, [
        { label: "Unpin", run: () => onCall("unpin_app", { id: pin.id }) },
        ...(next ? [{ label: "Group with the next app", run: () => onCall("group_apps", { first: pin.id, second: next }) }] : []),
        ...windows.map((window) => ({ label: `Close ${window.title || "window"}`, run: () => onCall("close_window", { hwnd: window.hwnd }) })),
        ...windows.map((window) => ({ label: "End task", danger: true, run: () => onCall("end_task", { hwnd: window.hwnd }) })),
      ]);
      }}
    >
      <Icon app={app} running={windows.length > 0} />
    </button>
  );
}

function Welcome({ config, onDone }: { config: Config; onDone: (patch: Partial<Config>) => void }) {
  const [mode, setMode] = useState(config.taskbarMode);
  return (
    <section className="card">
      <header><h2>Windocker</h2></header>
      <p className="tiny">A dock for the edge of the screen. Apps and live tiles sit together. Windows itself is left intact, and quitting puts the taskbar back.</p>
      <div className="seg" style={{ marginTop: 10 }}>
        {(["autohide", "hidden", "untouched"] as const).map((item) => (
          <button key={item} className={mode === item ? "on" : ""} onClick={() => setMode(item)}>{item === "autohide" ? "Auto-hide taskbar" : item === "hidden" ? "Hide taskbar" : "Leave taskbar"}</button>
        ))}
      </div>
      <div className="actions"><button className="primary" onClick={() => onDone({ taskbarMode: mode })}>Start</button></div>
    </section>
  );
}

function Picker(props: { config: Config; filter: string; category: string; onFilter: (v: string) => void; onCategory: (v: string) => void; onAdd: (kind: string) => void; onRemove: (id: string) => void; onClose: () => void }) {
  const items = CATALOG.filter((item) => (props.category === "All" || item.category === props.category) && `${item.name} ${item.blurb}`.toLowerCase().includes(props.filter.toLowerCase()));
  return (
    <section className="card picker">
      <div className="panel-head"><h2>Widgets</h2><button className="x" onClick={props.onClose}>×</button></div>
      <input className="field" placeholder="Search widgets" value={props.filter} onChange={(e) => props.onFilter(e.target.value)} />
      <div className="cats">
        <button className={props.category === "All" ? "on" : ""} onClick={() => props.onCategory("All")}>All</button>
        {CATEGORIES.map((cat) => <button key={cat} className={props.category === cat ? "on" : ""} onClick={() => props.onCategory(cat)}>{cat}</button>)}
      </div>
      <div className="grid">
        {items.map((item) => {
          const existing = props.config.widgets.find((w) => w.kind === item.kind);
          return (
            <article key={item.kind}>
              <strong>{item.name}</strong>
              <div className="tiny">{item.blurb}</div>
              <div className="actions">
                {existing ? <button className="ghost" onClick={() => props.onRemove(existing.id)}>Remove</button> : <button className="primary" onClick={() => props.onAdd(item.kind)}>Add</button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Settings(props: { config: Config; snap: Snapshot; onPatch: (patch: Partial<Config>) => void; onClose: () => void }) {
  const { config, snap, onPatch } = props;
  return (
    <section className="card picker">
      <div className="panel-head"><h2>Settings</h2><button className="x" onClick={props.onClose}>×</button></div>
      <div className="set-row"><span>Style</span><div className="seg">{["glass", "ios", "midnight", "black", "white", "clear"].map((style) => <button key={style} className={config.style === style ? "on" : ""} onClick={() => onPatch({ style })}>{style}</button>)}</div></div>
      <div className="set-row"><span>Accent</span><input aria-label="Accent" type="color" value={config.accent} onChange={(e) => onPatch({ accent: e.target.value })} /></div>
      <div className="set-row"><span>Size {config.scale.toFixed(2)}</span><input type="range" min={0.75} max={1.45} step={0.01} value={config.scale} onChange={(e) => onPatch({ scale: Number(e.target.value) })} /></div>
      <div className="set-row"><span>Spacing {config.spacing}</span><input type="range" min={0} max={24} step={1} value={config.spacing} onChange={(e) => onPatch({ spacing: Number(e.target.value) })} /></div>
      <div className="set-row"><span>Padding {config.padding}</span><input type="range" min={2} max={20} step={1} value={config.padding} onChange={(e) => onPatch({ padding: Number(e.target.value) })} /></div>
      <div className="set-row"><span>Distance {config.edgeDistance}</span><input type="range" min={0} max={48} step={1} value={config.edgeDistance} onChange={(e) => onPatch({ edgeDistance: Number(e.target.value) })} /></div>
      <div className="set-row"><span>Edge</span><div className="seg"><button className={config.edge === "bottom" ? "on" : ""} onClick={() => onPatch({ edge: "bottom" })}>Bottom</button><button className={config.edge === "top" ? "on" : ""} onClick={() => onPatch({ edge: "top" })}>Top</button></div></div>
      <div className="set-row"><span>Layout</span><div className="seg"><button className={config.layout === "pill" ? "on" : ""} onClick={() => onPatch({ layout: "pill" })}>Pill</button><button className={config.layout === "full" ? "on" : ""} onClick={() => onPatch({ layout: "full" })}>Full width</button></div></div>
      <div className="set-row"><span>Taskbar</span><div className="seg">{(["untouched", "autohide", "hidden"] as const).map((mode) => <button key={mode} className={config.taskbarMode === mode ? "on" : ""} onClick={() => onPatch({ taskbarMode: mode })}>{mode}</button>)}</div></div>
      <div className="set-row"><span>Displays</span><div className="seg"><button className={config.displayMode === "primary" ? "on" : ""} onClick={() => onPatch({ displayMode: "primary" })}>Primary</button><button className={config.displayMode === "follow" ? "on" : ""} onClick={() => onPatch({ displayMode: "follow" })}>Follow pointer</button></div></div>
      <Toggle label="Auto-hide" on={config.autoHide} set={(v) => onPatch({ autoHide: v })} />
      <Toggle label="Magnify apps" on={config.magnification} set={(v) => onPatch({ magnification: v })} />
      <Toggle label="24-hour clock" on={config.clock24h} set={(v) => onPatch({ clock24h: v })} />
      <Toggle label="Launch at startup" on={config.launchAtStartup} set={(v) => onPatch({ launchAtStartup: v })} />
      <p className="tiny">Windocker 1.0.0. This process is using about {snap.selfCpu.toFixed(1)}% CPU and {bytes(snap.selfMem)}. Updates are a new installer, not a background service.</p>
      <div className="actions"><button className="ghost" onClick={() => invoke("quit")}>Quit</button></div>
    </section>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return <div className="set-row"><span>{label}</span><button className={on ? "primary" : "ghost"} onClick={() => set(!on)}>{on ? "On" : "Off"}</button></div>;
}

function WidgetCard(props: { id: string; config: Config; snap: Snapshot; apps: Map<string, AppEntry>; onPatch: (patch: Partial<Config>) => void; onCall: (cmd: string, args?: Record<string, unknown>) => void; onClose: () => void }) {
  const { id, config, snap, apps, onPatch, onCall, onClose } = props;
  if (id.startsWith("group:")) {
    const group = config.groups.find((g) => g.id === id.slice(6));
    return (
      <section className="card">
        <div className="panel-head"><h2>{group?.name || "Group"}</h2><button className="x" onClick={onClose}>×</button></div>
        <input className="field" defaultValue={group?.name || ""} onBlur={(e) => onCall("rename_group", { id: group?.id, name: e.target.value })} />
        <div className="list">
          {group?.appIds.map((appId) => {
            const app = apps.get(appId);
            return <button key={appId} onClick={() => onCall("launch_app", { id: appId })}><span>{app?.name || appId}</span></button>;
          })}
        </div>
      </section>
    );
  }
  if (id.startsWith("windows:")) {
    const app = apps.get(id.slice(8));
    const windows = app ? winsFor(app, snap.running) : [];
    return (
      <section className="card">
        <div className="panel-head"><h2>{app?.name || "Windows"}</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="list">
          {windows.map((w) => (
            <button key={w.hwnd} onClick={() => onCall("activate_window", { hwnd: w.hwnd })}>
              <span className="truncate">{w.title}</span>
              <span className="tiny" onClick={(e) => { e.stopPropagation(); onCall("close_window", { hwnd: w.hwnd }); }}>Close</span>
            </button>
          ))}
        </div>
      </section>
    );
  }
  const widget = config.widgets.find((w) => w.id === id);
  if (!widget) return null;
  return (
    <section className="card">
      <div className="panel-head"><h2>{CATALOG.find((c) => c.kind === widget.kind)?.name || widget.kind}</h2><button className="x" onClick={onClose}>×</button></div>
      <CardBody widget={widget} config={config} snap={snap} apps={apps} onPatch={onPatch} onCall={onCall} />
    </section>
  );
}

function CardBody(props: { widget: Widget; config: Config; snap: Snapshot; apps: Map<string, AppEntry>; onPatch: (patch: Partial<Config>) => void; onCall: (cmd: string, args?: Record<string, unknown>) => void }) {
  const { widget, config, snap, apps, onPatch, onCall } = props;
  const [text, setText] = useState("");
  if (widget.kind === "now-playing") {
    const media = snap.media;
    return (
      <div>
        <div className="value">{media?.title || "Nothing is playing"}</div>
        <div className="tiny">{media?.artist || "Play something in Spotify, a browser, or any app that reports to Windows."}</div>
        <div className="actions">
          <button className="ghost" onClick={() => onCall("media", { command: "previous" })}>Prev</button>
          <button className="primary" onClick={() => onCall("media", { command: "toggle" })}>{media?.status === "playing" ? "Pause" : "Play"}</button>
          <button className="ghost" onClick={() => onCall("media", { command: "next" })}>Next</button>
        </div>
      </div>
    );
  }
  if (widget.kind === "weather") {
    const w = snap.weather;
    return (
      <div>
        <input className="field" placeholder="City" defaultValue={config.weatherQuery} onBlur={(e) => onPatch({ weatherQuery: e.target.value })} />
        {w?.error && <p className="tiny">{w.error}</p>}
        {w && !w.error && <p>{Math.round(w.tempC)}° · {sky(w.code)} · wind {Math.round(w.wind)} km/h · {Math.round(w.lo)}° to {Math.round(w.hi)}°</p>}
        <div className="list">{w?.hourly.map((h) => <div key={h.label} className="set-row"><span>{h.label}</span><span>{Math.round(h.tempC)}°</span></div>)}</div>
      </div>
    );
  }
  if (widget.kind === "todos") {
    return (
      <div>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onCall("add_todo", { text }); setText(""); } }}>
          <input className="field" value={text} placeholder="Add a task" onChange={(e) => setText(e.target.value)} />
        </form>
        <div className="list">
          {config.todos.map((todo) => (
            <button key={todo.id} onClick={() => onCall("toggle_todo", { id: todo.id })}>
              <span style={{ textDecoration: todo.done ? "line-through" : "none" }}>{todo.text}</span>
              <span className="danger" onClick={(e) => { e.stopPropagation(); onCall("delete_todo", { id: todo.id }); }}>Delete</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (widget.kind === "notes") {
    const note = config.notes[0];
    return <textarea defaultValue={note?.text || ""} onBlur={(e) => onCall("save_note", { id: note?.id || "", text: e.target.value })} />;
  }
  if (widget.kind === "calendar") {
    const events = [...config.events, ...snap.remoteEvents].sort((a, b) => a.startMs - b.startMs);
    return (
      <div>
        <form className="list" onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const title = String(data.get("title") || "");
          const when = String(data.get("when") || "");
          if (!title || !when) return;
          const start = new Date(when).getTime();
          onCall("add_event", { title, startMs: start, endMs: start + 3600000 });
          e.currentTarget.reset();
        }}>
          <input className="field" name="title" placeholder="Event" />
          <input className="field" name="when" type="datetime-local" />
          <button className="primary" type="submit">Add</button>
        </form>
        <input className="field" style={{ marginTop: 8 }} placeholder="iCal URL (optional)" defaultValue={config.icalUrl} onBlur={(e) => onPatch({ icalUrl: e.target.value })} />
        <div className="list">
          {events.map((event) => (
            <div key={event.id} className="set-row">
              <span>{new Date(event.startMs).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {event.title}</span>
              {event.source === "local" && <button className="danger" onClick={() => onCall("delete_event", { id: event.id })}>Delete</button>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (widget.kind === "timer") {
    return (
      <div className="actions">
        {[1, 5, 15, 25].map((m) => <button key={m} className="ghost" onClick={() => onPatch({ timerPausedMs: null, timerDeadlineMs: Date.now() + m * 60000 })}>{m}m</button>)}
        <button className="primary" onClick={() => onPatch({ timerDeadlineMs: null, timerPausedMs: null })}>Reset</button>
      </div>
    );
  }
  if (widget.kind === "stopwatch") {
    const running = config.stopwatchStartedMs != null;
    return (
      <div className="actions">
        <button className="primary" onClick={() => onPatch(running ? { stopwatchAccumMs: config.stopwatchAccumMs + (Date.now() - (config.stopwatchStartedMs || Date.now())), stopwatchStartedMs: null } : { stopwatchStartedMs: Date.now() })}>{running ? "Pause" : "Start"}</button>
        <button className="ghost" onClick={() => onPatch({ stopwatchAccumMs: 0, stopwatchStartedMs: null })}>Reset</button>
      </div>
    );
  }
  if (widget.kind === "pomodoro") {
    return (
      <div>
        <div className="actions">
          <button className="primary" onClick={() => onPatch({ pomoRunning: true, pomoPhase: "focus", pomoDeadlineMs: Date.now() + config.pomoFocusMin * 60000 })}>Start focus</button>
          <button className="ghost" onClick={() => onPatch({ pomoRunning: false, pomoDeadlineMs: null })}>Stop</button>
        </div>
        <div className="set-row"><span>Focus minutes</span><input type="range" min={5} max={90} value={config.pomoFocusMin} onChange={(e) => onPatch({ pomoFocusMin: Number(e.target.value) })} /></div>
      </div>
    );
  }
  if (widget.kind === "github") {
    return (
      <div>
        <input className="field" type="password" placeholder="GitHub token, stored only on this PC" defaultValue={config.githubToken} onBlur={(e) => onPatch({ githubToken: e.target.value })} />
        {snap.github?.error && <p className="tiny">{snap.github.error}</p>}
        {snap.github && !snap.github.error && <p>{snap.github.login} · {snap.github.total} this year · streak {snap.github.streak}</p>}
        <div className="contrib" aria-hidden>
          {snap.github?.cells.slice(-98).map((n, i) => <span key={i} style={{ background: n === 0 ? undefined : `rgba(48,209,88,${0.25 + Math.min(n, 12) / 16})` }} />)}
        </div>
      </div>
    );
  }
  if (widget.kind === "currency") {
    return (
      <div>
        <div className="row">
          <input className="field" defaultValue={config.currencyAmount} onBlur={(e) => onPatch({ currencyAmount: Number(e.target.value) || 0 })} />
          <input className="field" defaultValue={config.currencyFrom} onBlur={(e) => onPatch({ currencyFrom: e.target.value.toUpperCase() })} />
          <input className="field" defaultValue={config.currencyTo} onBlur={(e) => onPatch({ currencyTo: e.target.value.toUpperCase() })} />
        </div>
        {snap.currency?.error && <p className="tiny">{snap.currency.error}</p>}
        {snap.currency && !snap.currency.error && <p>1 {snap.currency.from} = {snap.currency.rate} {snap.currency.to}</p>}
      </div>
    );
  }
  if (widget.kind === "screen-time") {
    const max = Math.max(1, ...snap.screenHours);
    return (
      <div>
        <div className="hours">{snap.screenHours.map((n, i) => <i key={i} style={{ height: `${(n / max) * 100}%` }} title={`${i}:00`} />)}</div>
        <div className="list">{snap.screenApps.map((a) => <div key={a.name} className="set-row"><span>{a.name}</span><span>{mins(a.seconds)}</span></div>)}</div>
        <p className="tiny">Counted on this PC for the foreground app. Idle time after five minutes is not counted.</p>
      </div>
    );
  }
  if (widget.kind === "storage") {
    return <div className="list">{snap.disks.map((d) => <div key={d.mount} className="set-row"><span>{d.mount || d.name}</span><span>{bytes(d.free)} free of {bytes(d.total)}</span></div>)}</div>;
  }
  if (widget.kind === "recycle") {
    return <div><p>{snap.recycleCount} items · {bytes(snap.recycleBytes)}</p><button className="danger" onClick={() => onCall("empty_recycle")}>Empty bin</button></div>;
  }
  if (widget.kind === "quick") {
    return (
      <div className="actions">
        <button className="ghost" onClick={() => onCall("toggle_radio", { kind: "wifi" })}>Wi-Fi</button>
        <button className="ghost" onClick={() => onCall("toggle_radio", { kind: "bluetooth" })}>Bluetooth</button>
        <button className="ghost" onClick={() => onCall("toggle_theme")}>Theme</button>
        <button className="ghost" onClick={() => onCall("toggle_toasts")}>Toasts</button>
        <button className="ghost" onClick={() => invoke("show_desktop")}>Desktop</button>
        <button className="ghost" onClick={() => invoke("open_keyboard")}>Keyboard</button>
        <button className="ghost" onClick={() => onCall("screenshot", { mode: "screen" })}>Screenshot</button>
      </div>
    );
  }
  if (widget.kind === "brightness") {
    return snap.brightness == null ? <p className="tiny">This display does not expose a brightness control to Windows. External monitors often do not.</p> : <input type="range" min={0} max={100} defaultValue={snap.brightness} onChange={(e) => onCall("set_brightness", { value: Number(e.target.value) })} />;
  }
  if (widget.kind === "top") {
    return (
      <div>
        {snap.topCpu.map((p) => <div key={p.name} className="set-row"><span>{p.name}</span><span>{p.value.toFixed(1)}% CPU</span></div>)}
        {snap.topRam.map((p) => <div key={p.name + "r"} className="set-row"><span>{p.name}</span><span>{p.value.toFixed(0)} MB</span></div>)}
      </div>
    );
  }
  if (widget.kind === "search") {
    return <form onSubmit={(e) => { e.preventDefault(); onCall("search", { query: text }); }}><input className="field" placeholder="Search or C:\path" value={text} onChange={(e) => setText(e.target.value)} /></form>;
  }
  if (widget.kind === "commands") {
    const matches = [...apps.values()].filter((a) => a.name.toLowerCase().includes(text.toLowerCase())).slice(0, 8);
    return (
      <div>
        <input className="field" placeholder="App, screenshot, desktop, quit" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const q = text.toLowerCase();
          if (q === "quit") invoke("quit");
          else if (q === "screenshot") onCall("screenshot", { mode: "screen" });
          else if (q === "desktop") invoke("show_desktop");
          else if (matches[0]) onCall("launch_app", { id: matches[0].id });
        }} />
        <div className="list">{matches.map((a) => <button key={a.id} onClick={() => onCall("launch_app", { id: a.id })}>{a.name}</button>)}</div>
      </div>
    );
  }
  if (widget.kind === "apps") {
    const pinned = new Set(config.pins.flatMap((p) => (p.type === "app" ? [p.id] : [])));
    const list = [...apps.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80);
    return (
      <div className="list">
        {list.map((app) => (
          <button key={app.id} onClick={() => onCall(pinned.has(app.id) ? "unpin_app" : "pin_app", { id: app.id })}>
            <span>{app.name}</span><span className="tiny">{pinned.has(app.id) ? "Unpin" : "Pin"}</span>
          </button>
        ))}
      </div>
    );
  }
  if (widget.kind === "world-clock") {
    return (
      <div>
        <div className="list">{snap.clocks.map((city) => <div key={city.label} className="set-row"><span>{city.label}</span><span>{city.time} <span className="tiny">UTC{city.offset}</span></span></div>)}</div>
        <input className="field" defaultValue={config.worldCities.join(", ")} onBlur={(e) => onPatch({ worldCities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        <p className="tiny">Use timezone names such as America/New_York, Europe/London, Asia/Tokyo.</p>
      </div>
    );
  }
  if (widget.kind === "cpu" || widget.kind === "ram" || widget.kind === "network" || widget.kind === "clock" || widget.kind === "date" || widget.kind === "day-progress" || widget.kind === "volume" || widget.kind === "mic" || widget.kind === "battery") {
    return <p className="tiny">This tile is live. Right-click it to move or remove it.</p>;
  }
  return <p className="tiny">Open from the dock.</p>;
}
