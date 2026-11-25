import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { LaunchpadModal, Picker, Settings, Welcome, WidgetCard } from "./components/Panels";
import { Tile, remain, type MenuItem } from "./components/Widgets";
import type { AppEntry, Config, Snapshot } from "./types";

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
  audioDevice: "Speakers",
  wifiOn: null,
  bluetoothOn: null,
  brightness: null,
  toastsEnabled: null,
  lightTheme: false,
  wallpaperThumb: null,
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
  aiUsage: [],
  remoteEvents: [],
  selfCpu: 0,
  selfMem: 0,
  fullscreen: false,
  screenCssWidth: 1280,
  screenCssHeight: 800,
  monitorScale: 1,
});

function pillColor(style: string) {
  if (style === "white") return "rgba(255, 255, 255, 0.92)";
  if (style === "ios") return "rgba(244, 246, 251, 0.72)";
  if (style === "midnight") return "rgba(7, 10, 18, 0.84)";
  if (style === "black") return "rgba(18, 18, 20, 0.94)";
  if (style === "clear") return "transparent";
  if (style === "glass") return "rgba(22, 24, 29, 0.74)";
  return "linear-gradient(180deg, rgba(36, 40, 50, 0.72) 0%, rgba(16, 18, 24, 0.78) 100%)";
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [catalog, setCatalog] = useState<AppEntry[]>([]);
  const [snap, setSnap] = useState<Snapshot>(emptySnap);
  const [panel, setPanel] = useState<"welcome" | "picker" | "settings" | "launchpad" | string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("All");
  const stageRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<number[]>(Array(24).fill(0));
  const chimed = useRef<number | null>(null);
  const dragPin = useRef<string | null>(null);

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
    invoke<{ config: Config; catalog: AppEntry[] }>("bootstrap")
      .then((boot) => {
        if (stop) return;
        setConfig(boot.config);
        setCatalog(boot.catalog);
        if (!boot.config.firstLaunchComplete) setPanel("welcome");
      })
      .catch(fail);
    listen<Snapshot>("snapshot", (e) => setSnap(e.payload)).then((f) => un.push(f));
    listen<AppEntry[]>("catalog", (e) => setCatalog(e.payload)).then((f) => un.push(f));
    listen<Config>("config", (e) => setConfig(e.payload)).then((f) => un.push(f));
    listen("open-settings", () => setPanel("settings")).then((f) => un.push(f));
    listen<{ paths?: string[] }>("tauri://drag-drop", (event) => {
      for (const path of event.payload.paths ?? []) {
        invoke<Config>("pin_drop", { path }).then(setConfig).catch(fail);
      }
    }).then((f) => un.push(f));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setPanel(null);
      }
    };
    const onBlur = () => setMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);

    return () => {
      stop = true;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
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
      const kids = Array.from(el.children).reduce(
        (sum, child) => sum + Math.max(child.getBoundingClientRect().height, child.scrollHeight),
        0
      );
      const width = Math.ceil(Math.max(el.scrollWidth, r.width) + 12);
      const height = Math.ceil(Math.max(el.scrollHeight, r.height, kids + 40));
      if (Math.abs(width - lastW) >= 4 || Math.abs(height - lastH) >= 4) {
        lastW = width;
        lastH = height;
        invoke("fit_window", { width, height }).catch(() => undefined);
      }
      if (config.nativeBlur && pillRef.current) {
        const rects: { x: number; y: number; w: number; h: number; r: number }[] = [];
        for (const node of Array.from(el.children)) {
          const rect = node.getBoundingClientRect();
          if (rect.width > 4 && rect.height > 4) {
            rects.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height, r: 24 });
          }
        }
        invoke("set_regions", { rects }).catch(() => undefined);
      }
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(send);
    });
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, [config?.style, config?.layout, config?.edge, config?.widgets.length, config?.pins.length, config?.nativeBlur, panel, menu]);

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
      const m = next === "focus" ? config.pomoFocusMin : config.pomoBreakMin;
      const nextRound = config.pomoPhase === "break" ? (config.pomoRound % config.pomoTotalRounds) + 1 : config.pomoRound;
      call("patch_config", {
        patch: { pomoPhase: next, pomoRound: nextRound, pomoDeadlineMs: snap.nowMs + m * 60000, pomoRunning: false },
      });
    }
  }, [snap.nowMs, config?.timerDeadlineMs, config?.pomoDeadlineMs, config?.pomoRunning]);

  useEffect(() => {
    netRef.current = [...netRef.current.slice(1), snap.netDown];
  }, [snap.netDown]);

  const apps = useMemo(() => new Map(catalog.map((a) => [a.id, a])), [catalog]);

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
  const openCard = typeof panel === "string" && !["welcome", "picker", "settings", "launchpad"].includes(panel) ? panel : null;
  const isLight = config.style === "white" || config.style === "ios";
  const vars = {
    "--accent": config.accent,
    "--scale": String(config.scale),
    "--h": `calc(46px * ${config.scale})`,
    "--gap": `${config.spacing}px`,
    "--pad": `${config.padding}px`,
    "--screen": `${Math.max(640, snap.screenCssWidth)}px`,
    "--text": isLight ? "#16161a" : "#f5f6fa",
    "--muted": isLight ? "rgba(20, 22, 28, 0.56)" : "rgba(240, 244, 252, 0.6)",
    "--pill": pillColor(config.style),
    "--chip": isLight ? "rgba(255, 255, 255, 0.62)" : "rgba(255, 255, 255, 0.06)",
    "--chip-hover": isLight ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.11)",
    "--card": isLight ? "rgba(248, 250, 253, 0.94)" : "rgba(22, 24, 30, 0.92)",
    "--line": isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.13)",
    "--sheen": isLight ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.2)",
    "--up": "#30d158",
  } as React.CSSProperties;

  const onMenu = (event: React.MouseEvent, items: MenuItem[]) => {
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
      onContextMenu={(event) =>
        onMenu(event, [
          { label: "Widget Gallery…", run: () => setPanel("picker") },
          { label: "Launchpad…", run: () => setPanel("launchpad") },
          { label: "System Settings…", run: () => setPanel("settings") },
          {
            label: config.edge === "bottom" ? "Move Dock to Top" : "Move Dock to Bottom",
            run: () => call("patch_config", { patch: { edge: config.edge === "bottom" ? "top" : "bottom" } }),
          },
          { label: "Quit Windocker", run: () => invoke("quit"), danger: true },
        ])
      }
    >
      {panel === "welcome" && (
        <Welcome
          config={config}
          onDone={(patch) => {
            call("patch_config", { patch: { ...patch, firstLaunchComplete: true } });
            setPanel(null);
          }}
        />
      )}
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
      {panel === "settings" && (
        <Settings config={config} snap={snap} onPatch={(patch) => call("patch_config", { patch })} onClose={() => setPanel(null)} />
      )}
      {panel === "launchpad" && (
        <LaunchpadModal config={config} apps={apps} onCall={call} onClose={() => setPanel(null)} />
      )}
      {openCard && (
        <WidgetCard
          id={openCard}
          config={config}
          snap={snap}
          apps={apps}
          onPatch={(patch) => call("patch_config", { patch })}
          onCall={call}
          onClose={() => {
            setPanel(null);
            invoke("clear_preview").catch(() => undefined);
          }}
        />
      )}
      <div className="pill" ref={pillRef}>
        {config.widgets.map((widget) => (
          <Tile
            key={widget.id}
            widget={widget}
            config={config}
            snap={snap}
            apps={apps}
            netHistory={netRef.current}
            onOpen={() => setPanel((cur) => (cur === widget.id ? null : widget.id))}
            onMenu={(event) =>
              onMenu(event, [
                { label: "Configure / Open", run: () => setPanel(widget.id) },
                { label: "Move Left", run: () => moveWidget(widget.id, -1) },
                { label: "Move Right", run: () => moveWidget(widget.id, 1) },
                { label: "Widget Gallery…", run: () => setPanel("picker") },
                { label: "Remove Tile", run: () => call("remove_widget", { id: widget.id }), danger: true },
              ])
            }
            onCall={call}
            setPanel={setPanel}
            dragPin={dragPin}
            movePin={movePin}
            openMenu={onMenu}
          />
        ))}
      </div>
      {menu && (
        <div
          className="menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.max(8, Math.min(menu.y, window.innerHeight - menu.items.length * 34 - 16)),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menu.items.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              className={item.danger ? "danger" : ""}
              onClick={() => {
                item.run();
                setMenu(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
