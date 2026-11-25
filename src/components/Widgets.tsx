import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import {
  LaunchpadIcon,
  MAC_ICON_KEYS,
  MacFolderIcon,
  MacPackGlyph,
  MacSquircleShell,
  MacTrashIcon,
  SfSymbol,
  WeatherGlyph,
  resolveMacIconKey,
} from "../icons/MacIcons";
import type { AppEntry, Config, Pin, RunningWindow, Snapshot, Widget } from "../types";

export function bytes(n: number) {
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

export function speed(n: number) {
  return `${bytes(n)}/s`;
}

export function mins(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function fileOf(path: string) {
  return path.split(/[/\\]/).pop()?.toLowerCase() ?? path.toLowerCase();
}

export function winsFor(app: AppEntry, running: RunningWindow[]) {
  const file = fileOf(app.exe);
  if (!file) return [];
  return running.filter((w) => fileOf(w.exe) === file);
}

export function sky(code: number) {
  if (code < 0) return "Set city";
  if (code === 0) return "Clear";
  if (code < 3) return "Fair";
  if (code < 50) return "Cloudy";
  if (code < 60) return "Fog";
  if (code < 70) return "Rain";
  if (code < 80) return "Snow";
  if (code < 90) return "Showers";
  return "Storm";
}

export function remain(deadline: number | null, paused: number | null, now: number) {
  if (paused != null) return paused;
  if (deadline == null) return 0;
  return Math.max(0, deadline - now);
}

export function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function AppIcon({
  app,
  running,
  pack,
  squircleWrap,
  customIcons,
  fallbackIcon,
  fallbackName,
}: {
  app?: Pick<AppEntry, "id" | "name" | "exe" | "icon">;
  running?: boolean;
  pack: string;
  squircleWrap: boolean;
  customIcons?: Record<string, string>;
  fallbackIcon?: string | null;
  fallbackName?: string;
}) {
  const iconKey = pack !== "native" ? resolveMacIconKey(app, customIcons) : null;
  const imgSrc = app?.icon || fallbackIcon;
  const label = app?.name || fallbackName || "?";
  const hue = [...label].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;

  let inner: React.ReactNode;
  if (iconKey) {
    inner = <MacPackGlyph iconKey={iconKey} pack={pack} />;
  } else if (imgSrc && squircleWrap && pack !== "native") {
    inner = (
      <MacSquircleShell
        pack={pack}
        bg={
          pack === "dark"
            ? "linear-gradient(160deg, #27272c 0%, #151519 100%)"
            : "linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 100%)"
        }
      >
        <img src={imgSrc} alt="" className="wrapped-img" />
      </MacSquircleShell>
    );
  } else if (imgSrc) {
    inner = <img src={imgSrc} alt="" className="native-img" />;
  } else {
    inner = (
      <MacSquircleShell pack={pack} bg={`linear-gradient(160deg, hsl(${hue} 65% 52%), hsl(${hue} 65% 36%))`}>
        <span className="letter">{label.slice(0, 1).toUpperCase()}</span>
      </MacSquircleShell>
    );
  }

  return (
    <span className={running ? "app run" : "app"}>
      {inner}
    </span>
  );
}

function Ring({ value, color = "var(--accent)", size = 28 }: { value: number; color?: string; size?: number }) {
  const r = 10.5;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(127,127,127,.22)" strokeWidth="3" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

export interface MenuItem {
  label: string;
  run: () => void;
  danger?: boolean;
}

export function Tile(props: {
  widget: Widget;
  config: Config;
  snap: Snapshot;
  apps: Map<string, AppEntry>;
  netHistory: number[];
  onOpen: () => void;
  onMenu: (event: React.MouseEvent) => void;
  onCall: (cmd: string, args?: Record<string, unknown>) => void;
  setPanel: (panel: string) => void;
  dragPin: React.MutableRefObject<string | null>;
  movePin: (from: string, to: string) => void;
  openMenu: (event: React.MouseEvent, items: MenuItem[]) => void;
}) {
  const { widget, config, snap, apps, netHistory, onOpen, onMenu, onCall, setPanel } = props;
  const common = { className: `tile ${widget.kind}`, onContextMenu: onMenu, onClick: onOpen };
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [bouncing, setBouncing] = useState<string | null>(null);

  const triggerBounce = (id: string) => {
    setBouncing(id);
    window.setTimeout(() => setBouncing((cur) => (cur === id ? null : cur)), 650);
  };

  if (widget.kind === "spacer") {
    return <div className="dock-divider" onContextMenu={onMenu} title="Divider" />;
  }

  if (widget.kind === "launchpad") {
    return (
      <button
        className="app-hit standalone-icon"
        data-label="Launchpad"
        onContextMenu={onMenu}
        onClick={() => setPanel("launchpad")}
      >
        <span className="app">
          <LaunchpadIcon pack={config.iconPack} />
        </span>
      </button>
    );
  }

  if (widget.kind === "apps") {
    const pinnedExeSet = new Set(
      config.pins.flatMap((p) => {
        if (p.type !== "app") return [];
        const app = apps.get(p.id);
        return app?.exe ? [fileOf(app.exe)] : [];
      })
    );
    const extraRunning: RunningWindow[] = [];
    if (config.showRunningApps) {
      const seen = new Set<string>();
      for (const w of snap.running) {
        const key = fileOf(w.exe);
        if (!key || pinnedExeSet.has(key) || seen.has(key)) continue;
        seen.add(key);
        extraRunning.push(w);
      }
    }

    const seenPinIds = new Set<string>();
    const seenPinExes = new Set<string>();
    const uniquePins = config.pins.filter((p) => {
      if (seenPinIds.has(p.id)) return false;
      seenPinIds.add(p.id);
      if (p.type === "app") {
        const exe = fileOf(apps.get(p.id)?.exe || "");
        if (exe && seenPinExes.has(exe)) return false;
        if (exe) seenPinExes.add(exe);
      }
      return true;
    });

    const totalItems = 1 + uniquePins.length + extraRunning.length;
    const magFor = (idx: number): React.CSSProperties => {
      if (!config.magnification || hoverIdx == null) return {};
      const d = Math.abs(idx - hoverIdx);
      if (d > 2) return {};
      const scale = d === 0 ? 1.24 : d === 1 ? 1.12 : 1.04;
      const lift = d === 0 ? -7 : d === 1 ? -3 : -1;
      return { transform: `translateY(${lift}px) scale(${scale})`, zIndex: 3 - d };
    };

    return (
      <div
        className="tile apps"
        onContextMenu={onMenu}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <button
          className="app-hit"
          data-label={config.showLabels ? "Launchpad" : undefined}
          style={magFor(0)}
          onMouseEnter={() => setHoverIdx(0)}
          onClick={() => setPanel("launchpad")}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.openMenu(e, [
              { label: "Open Launchpad", run: () => setPanel("launchpad") },
              { label: "Open Windows Start", run: () => invoke("open_start") },
            ]);
          }}
        >
          <span className="app">
            <LaunchpadIcon pack={config.iconPack} />
          </span>
        </button>

        {uniquePins.map((pin, index) => {
          const itemIdx = index + 1;
          return (
            <PinButton
              key={pin.type + pin.id}
              pin={pin}
              config={config}
              snap={snap}
              apps={apps}
              onCall={onCall}
              setPanel={setPanel}
              onDragPin={(id) => { props.dragPin.current = id; }}
              onDropPin={(id) => { if (props.dragPin.current) props.movePin(props.dragPin.current, id); }}
              onPinMenu={props.openMenu}
              nextAppId={uniquePins.slice(index + 1).find((item) => item.type === "app")?.id}
              magStyle={magFor(itemIdx)}
              bouncing={bouncing === pin.id}
              onHover={() => setHoverIdx(itemIdx)}
              onBounce={() => triggerBounce(pin.id)}
            />
          );
        })}

        {extraRunning.length > 0 && (
          <>
            {config.dockDivider && <span className="apps-sep" aria-hidden />}
            {extraRunning.map((win, rIdx) => {
              const itemIdx = 1 + uniquePins.length + rIdx;
              const matches = snap.running.filter((r) => fileOf(r.exe) === fileOf(win.exe));
              const catalogMatch = [...apps.values()].find((a) => fileOf(a.exe) === fileOf(win.exe));
              return (
                <button
                  key={win.exe}
                  className={`app-hit ${bouncing === win.exe ? "bounce" : ""}`}
                  data-label={config.showLabels ? (catalogMatch?.name || win.name) : undefined}
                  style={magFor(itemIdx)}
                  onMouseEnter={() => setHoverIdx(itemIdx)}
                  onClick={() => {
                    triggerBounce(win.exe);
                    if (matches.length <= 1) onCall("activate_window", { hwnd: win.hwnd });
                    else setPanel(`exe:${fileOf(win.exe)}`);
                  }}
                  onContextMenu={(e) => {
                    props.openMenu(e, [
                      { label: "Keep in Dock", run: () => onCall("pin_exe", { path: win.exe }) },
                      ...matches.map((m) => ({
                        label: `Close ${m.title || m.name}`,
                        run: () => onCall("close_window", { hwnd: m.hwnd }),
                      })),
                      { label: "Force Quit", danger: true, run: () => onCall("end_task", { hwnd: win.hwnd }) },
                    ]);
                  }}
                >
                  <AppIcon
                    app={catalogMatch || { id: win.exe.toLowerCase(), name: win.name, exe: win.exe, icon: win.icon }}
                    running
                    pack={config.iconPack}
                    squircleWrap={config.squircleWrap}
                    customIcons={config.customIcons}
                    fallbackIcon={win.icon}
                    fallbackName={win.name}
                  />
                </button>
              );
            })}
          </>
        )}
        {totalItems > 0 && config.dockDivider && <span className="apps-sep end-sep" aria-hidden />}
      </div>
    );
  }

  if (widget.kind === "quick") {
    return (
      <div className="tile quick-bar" onContextMenu={onMenu}>
        <div className={`ctrl-pill ctrl-split ${snap.wifiOn ? "on" : ""}`}>
          <button
            className="ctrl-main"
            title={snap.wifiOn ? "Turn Wi-Fi Off" : "Turn Wi-Fi On"}
            onClick={() => onCall("toggle_radio", { kind: "wifi" })}
          >
            <SfSymbol name="wifi" size={14} />
          </button>
          <span className="ctrl-sep" />
          <button
            className="ctrl-sub"
            title="Select Wi-Fi Network"
            onClick={() => setPanel("wifi")}
          >
            <SfSymbol name="chevron" size={11} className="muted" />
          </button>
        </div>
        <div className={`ctrl-pill ctrl-split ${snap.bluetoothOn ? "on" : ""}`}>
          <button
            className="ctrl-main"
            title={snap.bluetoothOn ? "Turn Bluetooth Off" : "Turn Bluetooth On"}
            onClick={() => onCall("toggle_radio", { kind: "bluetooth" })}
          >
            <SfSymbol name="bluetooth" size={14} />
          </button>
          <span className="ctrl-sep" />
          <button
            className="ctrl-sub"
            title="Bluetooth Devices"
            onClick={() => setPanel("bluetooth")}
          >
            <SfSymbol name="chevron" size={11} className="muted" />
          </button>
        </div>
        <button
          className={`ctrl-round ${!snap.lightTheme ? "on-subtle" : ""}`}
          title={snap.lightTheme ? "Switch to Dark Mode" : "Switch to Light Mode"}
          onClick={() => onCall("toggle_theme")}
        >
          <SfSymbol name={snap.lightTheme ? "sun" : "moon"} size={14} />
        </button>
        <button
          className={`ctrl-round ${snap.toastsEnabled === false ? "warn" : ""}`}
          title={snap.toastsEnabled === false ? "Notifications muted" : "Mute notifications"}
          onClick={() => onCall("toggle_toasts")}
        >
          <SfSymbol name={snap.toastsEnabled === false ? "bell-off" : "bell"} size={14} />
        </button>
      </div>
    );
  }

  if (widget.kind === "volume") {
    const pct = Math.round(snap.volume * 100);
    return (
      <div
        className="tile volume-card"
        onContextMenu={onMenu}
        onWheel={(e) => {
          e.preventDefault();
          onCall("set_volume", { value: Math.min(1, Math.max(0, snap.volume + (e.deltaY < 0 ? 0.04 : -0.04))) });
        }}
      >
        <div className="vol-top">
          <button className={`vol-btn ${snap.muted ? "muted-badge" : ""}`} onClick={() => onCall("toggle_mute")} title="Mute / Unmute">
            <SfSymbol name={snap.muted || pct === 0 ? "volume-mute" : "volume"} size={13} />
          </button>
          <span className="vol-name truncate">{snap.audioDevice || "Speakers"}</span>
          <span className="vol-pct">{snap.muted ? "Muted" : `${pct}%`}</span>
        </div>
        <input
          aria-label="Volume"
          className="mac-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={snap.muted ? 0 : snap.volume}
          style={{ "--pct": `${snap.muted ? 0 : pct}%` } as React.CSSProperties}
          onChange={(e) => onCall("set_volume", { value: Number(e.target.value) })}
        />
      </div>
    );
  }

  if (widget.kind === "brightness") {
    const val = snap.brightness ?? 65;
    return (
      <div className="tile volume-card" onContextMenu={onMenu} onClick={snap.brightness == null ? onOpen : undefined}>
        <div className="vol-top">
          <span className="vol-btn">
            <SfSymbol name="sun" size={13} />
          </span>
          <span className="vol-name">Brightness</span>
          <span className="vol-pct">{snap.brightness == null ? "n/a" : `${val}%`}</span>
        </div>
        <input
          aria-label="Brightness"
          className="mac-slider"
          type="range"
          min={0}
          max={100}
          disabled={snap.brightness == null}
          value={val}
          style={{ "--pct": `${val}%` } as React.CSSProperties}
          onChange={(e) => onCall("set_brightness", { value: Number(e.target.value) })}
        />
      </div>
    );
  }

  if (widget.kind === "mic") {
    return (
      <button className={`tile mic-pill ${snap.micMuted ? "off" : "on"}`} onContextMenu={onMenu} onClick={() => onCall("toggle_mic")}>
        <SfSymbol name={snap.micMuted ? "mic-off" : "mic"} size={14} />
        <span className="value-sm">{snap.micMuted ? "Muted" : "Mic On"}</span>
      </button>
    );
  }

  if (widget.kind === "now-playing") {
    const media = snap.media;
    return (
      <div className="tile media-card" onContextMenu={onMenu}>
        <button className="media-info" onClick={onOpen}>
          <span className={media?.status === "playing" ? "bars playing" : "bars"}>
            <i style={{ height: 12 }} />
            <i style={{ height: 18 }} />
            <i style={{ height: 9 }} />
          </span>
          <span className="stack">
            <span className="value-sm truncate">{media?.title || "Nothing Playing"}</span>
            <span className="tiny truncate">{media?.artist || "Windows Media"}</span>
          </span>
        </button>
        <div className="media-btns">
          <button className="mini-icon-btn" onClick={() => onCall("media", { command: "toggle" })} title={media?.status === "playing" ? "Pause" : "Play"}>
            <SfSymbol name={media?.status === "playing" ? "pause" : "play"} size={12} />
          </button>
          <button className="mini-icon-btn" onClick={() => onCall("media", { command: "next" })} title="Next">
            <SfSymbol name="next" size={12} />
          </button>
        </div>
      </div>
    );
  }

  if (widget.kind === "pomodoro") {
    const left = config.pomoDeadlineMs
      ? remain(config.pomoDeadlineMs, config.pomoRunning ? null : remain(config.pomoDeadlineMs, null, snap.nowMs), snap.nowMs)
      : (config.pomoPhase === "focus" ? config.pomoFocusMin : config.pomoBreakMin) * 60000;
    const isBreak = config.pomoPhase === "break";
    return (
      <div className={`tile focus-card ${isBreak ? "break" : ""}`} onContextMenu={onMenu}>
        <button className="stack" onClick={onOpen}>
          <span className="focus-kicker">
            {isBreak ? "Break" : "Focus"} <span className="muted">{config.pomoRound}/{config.pomoTotalRounds}</span>
          </span>
          <span className="value-lg">{fmt(left)}</span>
        </button>
        <div className="focus-actions">
          <button
            className="mini-icon-btn"
            title="Skip phase"
            onClick={() => {
              const next = isBreak ? "focus" : "break";
              const m = next === "focus" ? config.pomoFocusMin : config.pomoBreakMin;
              const nextRound = isBreak ? ((config.pomoRound % config.pomoTotalRounds) + 1) : config.pomoRound;
              onCall("patch_config", { patch: { pomoPhase: next, pomoRound: nextRound, pomoRunning: false, pomoDeadlineMs: snap.nowMs + m * 60000 } });
            }}
          >
            <SfSymbol name="skip" size={12} />
          </button>
          <button
            className="focus-play"
            title={config.pomoRunning ? "Pause" : "Start"}
            onClick={() => {
              if (config.pomoRunning) {
                onCall("patch_config", { patch: { pomoRunning: false } });
              } else {
                const dur = left > 1000 ? left : (isBreak ? config.pomoBreakMin : config.pomoFocusMin) * 60000;
                onCall("patch_config", { patch: { pomoRunning: true, pomoDeadlineMs: snap.nowMs + dur } });
              }
            }}
          >
            <SfSymbol name={config.pomoRunning ? "pause" : "play"} size={12} />
          </button>
        </div>
      </div>
    );
  }

  if (widget.kind === "timer") {
    const left = remain(config.timerDeadlineMs, config.timerPausedMs, snap.nowMs);
    const active = config.timerDeadlineMs != null && config.timerPausedMs == null;
    const displayMs = left > 0 ? left : 60000;
    return (
      <div className="tile timer-card" onContextMenu={onMenu}>
        <button className="stack" onClick={onOpen}>
          <span className="timer-kicker">Timer</span>
          <span className="value-lg">{fmt(displayMs)}</span>
        </button>
        <button
          className="timer-play"
          title={active ? "Pause" : "Start"}
          onClick={() => {
            if (active) {
              onCall("patch_config", { patch: { timerPausedMs: left, timerDeadlineMs: null } });
            } else {
              onCall("patch_config", { patch: { timerPausedMs: null, timerDeadlineMs: snap.nowMs + displayMs } });
            }
          }}
        >
          <SfSymbol name={active ? "pause" : "play"} size={12} />
        </button>
      </div>
    );
  }

  if (widget.kind === "stopwatch") {
    const running = config.stopwatchStartedMs != null;
    const extra = running ? Math.max(0, snap.nowMs - (config.stopwatchStartedMs || snap.nowMs)) : 0;
    return (
      <div className="tile timer-card" onContextMenu={onMenu}>
        <button className="stack" onClick={onOpen}>
          <span className="kicker">Stopwatch</span>
          <span className="value-lg">{fmt(config.stopwatchAccumMs + extra)}</span>
        </button>
        <button
          className="timer-play"
          onClick={() =>
            onCall("patch_config", {
              patch: running
                ? { stopwatchAccumMs: config.stopwatchAccumMs + extra, stopwatchStartedMs: null }
                : { stopwatchStartedMs: snap.nowMs },
            })
          }
        >
          <SfSymbol name={running ? "pause" : "play"} size={12} />
        </button>
      </div>
    );
  }

  if (widget.kind === "notes") {
    const note = config.notes[0];
    const lines = (note?.text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const title = lines[0] || "Meeting notes";
    const body = lines.slice(1).join(" ") || "Click to write a quick note…";
    return (
      <button {...common} className="tile notes-card">
        <span className="mini-app-icon">
          <MacPackGlyph iconKey="notes" pack={config.iconPack === "native" ? "sequoia" : config.iconPack} />
        </span>
        <span className="stack note-txt">
          <span className="value-sm truncate">{title}</span>
          <span className="tiny truncate">{body}</span>
        </span>
        <span className="note-edit"><SfSymbol name="edit" size={13} /></span>
      </button>
    );
  }

  if (widget.kind === "calendar") {
    const d = new Date(snap.nowMs);
    const events = [...config.events, ...snap.remoteEvents].sort((a, b) => a.startMs - b.startMs).filter((e) => e.endMs >= snap.nowMs);
    const next = events[0];
    return (
      <button {...common} className="tile cal-card">
        <span className="cal-mini-badge">
          <span>{d.toLocaleDateString([], { weekday: "short" }).toUpperCase()}</span>
          <b>{d.getDate()}</b>
        </span>
        <span className="stack cal-txt">
          <span className="value-sm truncate">{next?.title || "No upcoming events"}</span>
          <span className="tiny truncate">
            {next ? new Date(next.startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Click to plan your day"}
          </span>
        </span>
      </button>
    );
  }

  if (widget.kind === "todos") {
    const open = config.todos.filter((t) => !t.done);
    const preview = open.slice(0, 2);
    return (
      <div className="tile todos-card" onContextMenu={onMenu}>
        <button className="todos-badge" onClick={onOpen}>{open.length}</button>
        <div className="todos-list">
          {preview.length === 0 ? (
            <button className="tiny" onClick={onOpen}>All tasks done · Add</button>
          ) : (
            preview.map((t) => (
              <div key={t.id} className="todo-mini-row">
                <button className="todo-dot" onClick={() => onCall("toggle_todo", { id: t.id })} title="Complete task" />
                <button className="tiny truncate" onClick={onOpen}>{t.text}</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (widget.kind === "today") {
    const d = new Date(snap.nowMs);
    const weekday = d.toLocaleDateString([], { weekday: "long" }).toUpperCase();
    const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
    const timeStr = config.clock24h
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const w = snap.weather;
    return (
      <button {...common} className="tile today-card">
        <span className="stack">
          <span className="today-wk">{weekday}</span>
          <span className="value-sm">{dateStr}</span>
        </span>
        <span className="today-sep" />
        <span className="stack align-end">
          <span className="value-sm">{timeStr}</span>
          <span className="tiny row-tight">
            {w && !w.error ? (
              <>
                <WeatherGlyph code={w.code} size={13} />
                <span>{Math.round(w.tempC)}°</span>
              </>
            ) : (
              <span>{d.getFullYear()}</span>
            )}
          </span>
        </span>
      </button>
    );
  }

  if (widget.kind === "clock") {
    const d = new Date(snap.nowMs);
    const h = config.clock24h ? String(d.getHours()).padStart(2, "0") : String(d.getHours() % 12 || 12);
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const sub = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    return (
      <button {...common} className="tile clock-card">
        <span className="clock-main">
          <b>{h}:{m}</b>
          <span className="clock-sec">:{s}</span>
        </span>
        <span className="tiny">{sub}</span>
      </button>
    );
  }

  if (widget.kind === "flip-clock") {
    const d = new Date(snap.nowMs);
    const rawH = config.clock24h ? d.getHours() : d.getHours() % 12 || 12;
    const h = String(rawH).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = config.clock24h ? "" : d.getHours() >= 12 ? "PM" : "AM";
    return (
      <button {...common} className="tile flip-card">
        <span className="flip-box">{h[0]}</span>
        <span className="flip-box">{h[1]}</span>
        <span className="flip-colon">:</span>
        <span className="flip-box">{m[0]}</span>
        <span className="flip-box">{m[1]}</span>
        {ap && <span className="flip-ap">{ap}</span>}
      </button>
    );
  }

  if (widget.kind === "analog-clock") {
    const d = new Date(snap.nowMs);
    const sec = d.getSeconds() * 6;
    const min = d.getMinutes() * 6 + d.getSeconds() * 0.1;
    const hr = (d.getHours() % 12) * 30 + d.getMinutes() * 0.5;
    return (
      <button {...common} className="tile analog-card">
        <svg viewBox="0 0 40 40" className="analog-svg">
          <circle cx="20" cy="20" r="18" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          {[0, 90, 180, 270].map((a) => (
            <line key={a} x1="20" y1="4.5" x2="20" y2="7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" transform={`rotate(${a} 20 20)`} />
          ))}
          <line x1="20" y1="20" x2="20" y2="11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" transform={`rotate(${hr} 20 20)`} />
          <line x1="20" y1="20" x2="20" y2="7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${min} 20 20)`} />
          <line x1="20" y1="22" x2="20" y2="6.5" stroke="#ff9f0a" strokeWidth="1" strokeLinecap="round" transform={`rotate(${sec} 20 20)`} />
          <circle cx="20" cy="20" r="1.6" fill="#ff9f0a" />
        </svg>
      </button>
    );
  }

  if (widget.kind === "date") {
    const d = new Date(snap.nowMs);
    return (
      <button {...common} className="tile date-badge">
        <span>{d.toLocaleDateString([], { weekday: "short" }).toUpperCase()}</span>
        <b>{d.getDate()}</b>
      </button>
    );
  }

  if (widget.kind === "system-rings") {
    const ramPct = snap.ramTotal ? (snap.ramUsed / snap.ramTotal) * 100 : 0;
    const cpuColor = snap.cpu > 80 ? "#ff453a" : snap.cpu > 55 ? "#ff9f0a" : "#30d158";
    const ramColor = ramPct > 85 ? "#ff453a" : "#0a84ff";
    return (
      <button {...common} className="tile rings-duo">
        <span className="ring-cell">
          <Ring value={snap.cpu} color={cpuColor} size={32} />
          <span className="ring-center">
            <b>{Math.round(snap.cpu)}</b>
            <small>CPU</small>
          </span>
        </span>
        <span className="ring-cell">
          <Ring value={ramPct} color={ramColor} size={32} />
          <span className="ring-center">
            <b>{Math.round(ramPct)}</b>
            <small>RAM</small>
          </span>
        </span>
      </button>
    );
  }

  if (widget.kind === "cpu") {
    return (
      <button {...common}>
        <Ring value={snap.cpu} color={snap.cpu > 80 ? "#ff453a" : "var(--accent)"} />
        <span className="stack">
          <span className="kicker">CPU</span>
          <span className="value-sm">{Math.round(snap.cpu)}%</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "ram") {
    const pct = snap.ramTotal ? (snap.ramUsed / snap.ramTotal) * 100 : 0;
    return (
      <button {...common}>
        <Ring value={pct} />
        <span className="stack">
          <span className="kicker">Memory</span>
          <span className="value-sm">{Math.round(pct)}%</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "battery") {
    const pct = snap.batteryPct ?? 100;
    const isWave = (widget.settings?.style as string) !== "pill";
    const fill = snap.batteryCharging ? "#30d158" : pct <= 20 ? "#ff453a" : "#0a84ff";
    if (isWave) {
      return (
        <button {...common} className="tile battery-wave" title={snap.batteryPct == null ? "On AC Power" : `${pct}%`}>
          <span className="wave-fill" style={{ height: `${Math.max(12, pct)}%`, background: fill }} />
          <span className="wave-label">
            {snap.batteryCharging && <SfSymbol name="bolt" size={10} />}
            {snap.batteryPct == null ? "AC" : pct}
          </span>
        </button>
      );
    }
    return (
      <button {...common} className="tile battery-squircle" style={{ background: fill }}>
        {snap.batteryCharging && <SfSymbol name="bolt" size={11} />}
        <span>{snap.batteryPct == null ? "AC" : pct}</span>
      </button>
    );
  }

  if (widget.kind === "weather") {
    const w = snap.weather;
    return (
      <button {...common} className="tile weather-card">
        <WeatherGlyph code={w?.code ?? 0} size={20} />
        <span className="stack">
          <span className="value-sm">{w && !w.error ? `${Math.round(w.tempC)}°` : "—"}</span>
          <span className="tiny truncate">{w && !w.error ? sky(w.code) : w?.city || "Weather"}</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "weather-details") {
    const w = snap.weather;
    return (
      <button {...common} className="tile weather-det-card">
        <span className="tiny row-tight"><SfSymbol name="wind" size={11} /> {w && !w.error ? `${Math.round(w.wind)} km/h` : "—"}</span>
        <span className="tiny row-tight">Rain {w && !w.error ? `${w.precip.toFixed(0)} mm` : "—"}</span>
        <span className="tiny row-tight">H/L {w && !w.error ? `${Math.round(w.hi)}°/${Math.round(w.lo)}°` : "—"}</span>
      </button>
    );
  }

  if (widget.kind === "day-progress") {
    const d = new Date(snap.nowMs);
    const pct = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400) * 100;
    const filled = Math.round((pct / 100) * 30);
    const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return (
      <button {...common} className="tile dot-matrix-card">
        <div className="dot-grid">
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} className={i < filled ? "dot on" : "dot"} />
          ))}
        </div>
        <div className="dot-meta">
          <span className="tiny">{label}</span>
          <span className="tiny-bold">{Math.round(pct)}%</span>
        </div>
      </button>
    );
  }

  if (widget.kind === "currency") {
    const c = snap.currency;
    const out = c && !c.error ? (c.amount * c.rate).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
    return (
      <button {...common} className="tile currency-card">
        <span className="stack">
          <span className="tiny">{config.currencyAmount}</span>
          <span className="value-sm">{out}</span>
        </span>
        <span className="currency-pair">
          <span>{config.currencyFrom}</span>
          <SfSymbol name="swap" size={10} className="muted" />
          <span>{config.currencyTo}</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "ai-limits") {
    const active = snap.aiUsage.filter((a) => a.connected);
    const top = active[0] || snap.aiUsage[0];
    return (
      <button {...common} className="tile ai-card">
        <span className="ai-logo">
          <SfSymbol name="sparkles" size={16} />
        </span>
        {top ? (
          <div className="ai-bars">
            <div className="ai-row">
              <span className="ai-lbl">{top.primaryLabel}</span>
              <span className="ai-track"><span style={{ width: `${Math.max(4, top.primaryPct)}%` }} /></span>
              <span className="ai-val">{top.primaryMeta}</span>
            </div>
            <div className="ai-row">
              <span className="ai-lbl">{top.secondaryLabel}</span>
              <span className="ai-track"><span style={{ width: `${Math.max(4, top.secondaryPct)}%` }} /></span>
              <span className="ai-val">{top.secondaryMeta}</span>
            </div>
          </div>
        ) : (
          <span className="stack">
            <span className="kicker">AI Usage</span>
            <span className="tiny">Configure</span>
          </span>
        )}
      </button>
    );
  }

  if (widget.kind === "screenshot") {
    return (
      <div className="tile capture-bar" onContextMenu={onMenu}>
        <button className="cap-btn blue" title="Capture Screen" onClick={() => onCall("screenshot", { mode: "screen" })}>
          <SfSymbol name="camera" size={14} />
        </button>
        <button className="cap-btn green" title="Capture Active Window" onClick={() => onCall("screenshot", { mode: "window" })}>
          <SfSymbol name="crop" size={14} />
        </button>
        <button className="cap-btn purple" title="Open Captures Folder" onClick={() => onCall("open_screenshots")}>
          <SfSymbol name="folder" size={14} />
        </button>
      </div>
    );
  }

  if (widget.kind === "wallpaper") {
    return (
      <button {...common} className="tile wallpaper-tile" title="Change Wallpaper">
        {snap.wallpaperThumb ? (
          <img src={snap.wallpaperThumb} alt="" className="wp-thumb" />
        ) : (
          <span className="wp-fallback"><SfSymbol name="sun" size={16} /></span>
        )}
      </button>
    );
  }

  if (widget.kind === "commands") {
    return (
      <button {...common} className="tile cmd-pill">
        <SfSymbol name="terminal" size={13} className="muted" />
        <span className="tiny">command</span>
      </button>
    );
  }

  if (widget.kind === "search") {
    return (
      <button {...common} className="tile cmd-pill">
        <SfSymbol name="search" size={13} className="muted" />
        <span className="tiny">Search…</span>
      </button>
    );
  }

  if (widget.kind === "recycle") {
    return (
      <button {...common} className="app-hit standalone-icon" title={`Trash (${snap.recycleCount} items)`}>
        <span className="app">
          <MacTrashIcon full={snap.recycleCount > 0} pack={config.iconPack === "native" ? "sequoia" : config.iconPack} />
          {snap.recycleCount > 0 && <span className="trash-count">{snap.recycleCount > 99 ? "99+" : snap.recycleCount}</span>}
        </span>
      </button>
    );
  }

  if (widget.kind === "network") {
    const max = Math.max(1024, ...netHistory);
    const pts = netHistory.map((v, i) => `${(i / (netHistory.length - 1)) * 52},${18 - (v / max) * 16}`).join(" ");
    return (
      <button {...common} className="tile net-card">
        <svg className="spark-sm" viewBox="0 0 52 18" aria-hidden>
          <polyline fill="none" stroke="var(--up)" strokeWidth="1.6" strokeLinecap="round" points={pts} />
        </svg>
        <span className="stack">
          <span className="tiny">↓ {speed(snap.netDown)}</span>
          <span className="tiny">↑ {speed(snap.netUp)}</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "screen-time") {
    return (
      <button {...common}>
        <Ring value={Math.min(100, (snap.screenTodaySec / (8 * 3600)) * 100)} color="#5e5ce6" />
        <span className="stack">
          <span className="kicker">Screen Time</span>
          <span className="value-sm">{mins(snap.screenTodaySec)}</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "github") {
    return (
      <button {...common}>
        <span className="mini-app-icon">
          <MacPackGlyph iconKey="github" pack={config.iconPack === "native" ? "sequoia" : config.iconPack} />
        </span>
        <span className="stack">
          <span className="kicker">{snap.github?.login || "GitHub"}</span>
          <span className="value-sm">{snap.github && !snap.github.error ? `${snap.github.total}` : "Connect"}</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "storage") {
    const disk = snap.disks[0];
    const pct = disk && disk.total ? Math.round((1 - disk.free / disk.total) * 100) : 0;
    return (
      <button {...common}>
        <span className="stack">
          <span className="kicker">{disk?.mount || "Storage"}</span>
          <span className="value-sm">{disk ? `${bytes(disk.free)} free` : "—"}</span>
          <span className="track"><span style={{ width: `${pct}%` }} /></span>
        </span>
      </button>
    );
  }

  if (widget.kind === "top") {
    return (
      <button {...common}>
        <span className="stack">
          <span className="kicker">Top CPU</span>
          <span className="tiny truncate">{snap.topCpu[0] ? `${snap.topCpu[0].name} ${Math.round(snap.topCpu[0].value)}%` : "Idle"}</span>
        </span>
      </button>
    );
  }

  if (widget.kind === "world-clock") {
    const first = snap.clocks[0];
    return (
      <button {...common}>
        <span className="stack">
          <span className="kicker">{first?.label || "World"}</span>
          <span className="value-sm">{first?.time || "—"}</span>
        </span>
      </button>
    );
  }

  return <button {...common}><span className="value-sm">{widget.kind}</span></button>;
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
  onPinMenu: (event: React.MouseEvent, items: MenuItem[]) => void;
  nextAppId?: string;
  magStyle: React.CSSProperties;
  bouncing: boolean;
  onHover: () => void;
  onBounce: () => void;
}) {
  const { pin, config, snap, apps, onCall, setPanel } = props;
  if (pin.type === "group") {
    const group = config.groups.find((g) => g.id === pin.id);
    return (
      <button
        className="app-hit"
        data-label={config.showLabels ? group?.name || "Folder" : undefined}
        style={props.magStyle}
        onMouseEnter={props.onHover}
        draggable
        onDragStart={() => props.onDragPin(pin.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); props.onDropPin(pin.id); }}
        onClick={() => setPanel(`group:${pin.id}`)}
      >
        <span className="app">
          <MacFolderIcon pack={config.iconPack} />
        </span>
      </button>
    );
  }
  const app = apps.get(pin.id);
  const windows = app ? winsFor(app, snap.running) : [];
  return (
    <button
      className={`app-hit ${props.bouncing ? "bounce" : ""}`}
      data-label={config.showLabels ? app?.name || pin.id : undefined}
      style={props.magStyle}
      onMouseEnter={props.onHover}
      draggable
      onDragStart={() => props.onDragPin(pin.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); props.onDropPin(pin.id); }}
      onClick={() => {
        if (!app) return;
        props.onBounce();
        if (windows.length === 0) onCall("launch_app", { id: app.id });
        else if (windows.length === 1) onCall("activate_window", { hwnd: windows[0].hwnd });
        else setPanel(`windows:${app.id}`);
      }}
      onContextMenu={(event) => {
        const next = props.nextAppId;
        props.onPinMenu(event, [
          { label: windows.length ? "Open New Instance" : "Open", run: () => onCall("launch_app", { id: pin.id }) },
          { label: "Change macOS Icon…", run: () => setPanel(`icon:${pin.id}`) },
          ...(next ? [{ label: "Folder with Next App", run: () => onCall("group_apps", { first: pin.id, second: next }) }] : []),
          ...windows.map((window) => ({ label: `Close ${window.title || "window"}`, run: () => onCall("close_window", { hwnd: window.hwnd }) })),
          ...windows.map((window) => ({ label: "Force Quit", danger: true, run: () => onCall("end_task", { hwnd: window.hwnd }) })),
          { label: "Remove from Dock", danger: true, run: () => onCall("unpin_app", { id: pin.id }) },
        ]);
      }}
    >
      <AppIcon
        app={app}
        running={windows.length > 0}
        pack={config.iconPack}
        squircleWrap={config.squircleWrap}
        customIcons={config.customIcons}
      />
    </button>
  );
}

export { MAC_ICON_KEYS };
