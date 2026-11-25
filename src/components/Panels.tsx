import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { MAC_ICON_KEYS, MacPackGlyph, SfSymbol, WeatherGlyph } from "../icons/MacIcons";
import {
  ACCENT_PRESETS,
  CATALOG,
  CATEGORIES,
  ICON_PACKS,
  STYLE_OPTIONS,
  type AppEntry,
  type BluetoothDevice,
  type Config,
  type Snapshot,
  type WallpaperItem,
  type Widget,
  type WifiNetwork,
} from "../types";
import { AppIcon, bytes, fmt, mins, sky, winsFor } from "./Widgets";

export function Welcome({ config, onDone }: { config: Config; onDone: (patch: Partial<Config>) => void }) {
  const [mode, setMode] = useState(config.taskbarMode);
  const [pack, setPack] = useState(config.iconPack);
  return (
    <section className="card mac-sheet">
      <div className="sheet-titlebar">
        <div className="traffic-lights"><span className="tl red" /><span className="tl yellow" /><span className="tl green" /></div>
        <h2>Welcome to Windocker</h2>
        <span />
      </div>
      <p className="tiny">Transform your Windows desktop into a macOS-inspired dock with native macOS icon packs and live bento widgets. Quitting always restores your Windows taskbar.</p>
      <div className="set-group">
        <div className="set-kicker">Windows Taskbar</div>
        <div className="seg">
          {(["autohide", "hidden", "untouched"] as const).map((item) => (
            <button key={item} className={mode === item ? "on" : ""} onClick={() => setMode(item)}>
              {item === "autohide" ? "Auto-hide" : item === "hidden" ? "Replace & Hide" : "Keep Visible"}
            </button>
          ))}
        </div>
      </div>
      <div className="set-group">
        <div className="set-kicker">macOS Icon Pack</div>
        <div className="seg">
          {ICON_PACKS.map((p) => (
            <button key={p.id} className={pack === p.id ? "on" : ""} onClick={() => setPack(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="actions">
        <button className="primary" onClick={() => onDone({ taskbarMode: mode, iconPack: pack })}>Start Using Dock</button>
      </div>
    </section>
  );
}

export function Picker(props: {
  config: Config;
  filter: string;
  category: string;
  onFilter: (v: string) => void;
  onCategory: (v: string) => void;
  onAdd: (kind: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const items = CATALOG.filter(
    (item) =>
      (props.category === "All" || item.category === props.category) &&
      `${item.name} ${item.blurb} ${item.category}`.toLowerCase().includes(props.filter.toLowerCase())
  );
  return (
    <section className="card picker mac-sheet">
      <div className="panel-head">
        <div className="row">
          <div className="traffic-lights"><button className="tl red" onClick={props.onClose} title="Close" /><span className="tl yellow" /><span className="tl green" /></div>
          <h2>Widget Gallery</h2>
          <span className="pill-count">{CATALOG.length} widgets</span>
        </div>
        <button className="x" onClick={props.onClose}>×</button>
      </div>
      <input className="field" placeholder="Search widgets (e.g. AI, Focus, Flip Clock, Notes, Weather)…" value={props.filter} onChange={(e) => props.onFilter(e.target.value)} />
      <div className="cats">
        <button className={props.category === "All" ? "on" : ""} onClick={() => props.onCategory("All")}>All</button>
        {CATEGORIES.map((cat) => (
          <button key={cat} className={props.category === cat ? "on" : ""} onClick={() => props.onCategory(cat)}>
            {cat}
          </button>
        ))}
      </div>
      <div className="grid">
        {items.map((item) => {
          const count = props.config.widgets.filter((w) => w.kind === item.kind).length;
          const existing = props.config.widgets.find((w) => w.kind === item.kind);
          return (
            <article key={item.kind} className={existing ? "added" : ""}>
              <div className="picker-item-head">
                <strong>{item.name}</strong>
                <span className="tiny-tag">{item.category}</span>
              </div>
              <div className="tiny">{item.blurb}</div>
              <div className="actions between">
                <span className="tiny">{count > 0 ? `${count} on dock` : "Ready to add"}</span>
                <div className="row-tight">
                  {existing && (
                    <button className="ghost sm" onClick={() => props.onRemove(existing.id)}>Remove</button>
                  )}
                  <button className="primary sm" onClick={() => props.onAdd(item.kind)}>{existing ? "+ Another" : "Add"}</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Settings(props: {
  config: Config;
  snap: Snapshot;
  onPatch: (patch: Partial<Config>) => void;
  onClose: () => void;
}) {
  const { config, snap, onPatch } = props;
  const [tab, setTab] = useState<"appearance" | "dock" | "icons" | "automation">("appearance");

  return (
    <section className="card picker mac-sheet">
      <div className="panel-head">
        <div className="row">
          <div className="traffic-lights"><button className="tl red" onClick={props.onClose} title="Close" /><span className="tl yellow" /><span className="tl green" /></div>
          <h2>System Settings</h2>
        </div>
        <button className="x" onClick={props.onClose}>×</button>
      </div>

      <div className="cats">
        <button className={tab === "appearance" ? "on" : ""} onClick={() => setTab("appearance")}>Appearance</button>
        <button className={tab === "icons" ? "on" : ""} onClick={() => setTab("icons")}>macOS Icons</button>
        <button className={tab === "dock" ? "on" : ""} onClick={() => setTab("dock")}>Dock & Taskbar</button>
        <button className={tab === "automation" ? "on" : ""} onClick={() => setTab("automation")}>Smart & Keys</button>
      </div>

      {tab === "appearance" && (
        <div className="settings-body">
          <div className="set-group">
            <div className="set-kicker">Dock Theme</div>
            <div className="swatch-grid">
              {STYLE_OPTIONS.map((st) => (
                <button
                  key={st.id}
                  className={`swatch-btn ${config.style === st.id ? "on" : ""}`}
                  onClick={() => onPatch({ style: st.id })}
                >
                  <span className="swatch-dot" style={{ background: st.swatch }} />
                  <span>{st.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="set-row">
            <span>Accent Color</span>
            <div className="row-tight">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`accent-dot ${config.accent.toLowerCase() === c ? "on" : ""}`}
                  style={{ background: c }}
                  onClick={() => onPatch({ accent: c })}
                />
              ))}
              <input aria-label="Custom Accent" type="color" value={config.accent} onChange={(e) => onPatch({ accent: e.target.value })} />
            </div>
          </div>

          <div className="set-row"><span>Dock Size ({config.scale.toFixed(2)}×)</span><input type="range" min={0.75} max={1.45} step={0.01} value={config.scale} onChange={(e) => onPatch({ scale: Number(e.target.value) })} /></div>
          <div className="set-row"><span>Tile Spacing ({config.spacing}px)</span><input type="range" min={0} max={24} step={1} value={config.spacing} onChange={(e) => onPatch({ spacing: Number(e.target.value) })} /></div>
          <div className="set-row"><span>Dock Padding ({config.padding}px)</span><input type="range" min={2} max={20} step={1} value={config.padding} onChange={(e) => onPatch({ padding: Number(e.target.value) })} /></div>
          <div className="set-row"><span>Screen Margin ({config.edgeDistance}px)</span><input type="range" min={0} max={48} step={1} value={config.edgeDistance} onChange={(e) => onPatch({ edgeDistance: Number(e.target.value) })} /></div>
          <Toggle label="Windows Desktop Acrylic Blur" on={config.nativeBlur} set={(v) => onPatch({ nativeBlur: v })} />
        </div>
      )}

      {tab === "icons" && (
        <div className="settings-body">
          <div className="set-group">
            <div className="set-kicker">macOS Icon Pack</div>
            <div className="grid-2">
              {ICON_PACKS.map((p) => (
                <button
                  key={p.id}
                  className={`pack-card ${config.iconPack === p.id ? "on" : ""}`}
                  onClick={() => onPatch({ iconPack: p.id })}
                >
                  <div className="pack-preview">
                    <span className="mini-pack-icon"><MacPackGlyph iconKey="finder" pack={p.id} /></span>
                    <span className="mini-pack-icon"><MacPackGlyph iconKey="safari" pack={p.id} /></span>
                    <span className="mini-pack-icon"><MacPackGlyph iconKey="terminal" pack={p.id} /></span>
                    <span className="mini-pack-icon"><MacPackGlyph iconKey="notes" pack={p.id} /></span>
                  </div>
                  <strong>{p.name}</strong>
                  <span className="tiny">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Frame Windows icons in macOS squircles" on={config.squircleWrap} set={(v) => onPatch({ squircleWrap: v })} />
          <Toggle label="Show running unpinned apps in dock" on={config.showRunningApps} set={(v) => onPatch({ showRunningApps: v })} />
          <Toggle label="Show macOS divider lines" on={config.dockDivider} set={(v) => onPatch({ dockDivider: v })} />
          <Toggle label="Cursor magnification wave" on={config.magnification} set={(v) => onPatch({ magnification: v })} />
          <Toggle label="Hover icon labels" on={config.showLabels} set={(v) => onPatch({ showLabels: v })} />
          <Toggle label="Live window hover previews" on={config.previews} set={(v) => onPatch({ previews: v })} />
        </div>
      )}

      {tab === "dock" && (
        <div className="settings-body">
          <div className="set-row"><span>Screen Edge</span><div className="seg"><button className={config.edge === "bottom" ? "on" : ""} onClick={() => onPatch({ edge: "bottom" })}>Bottom</button><button className={config.edge === "top" ? "on" : ""} onClick={() => onPatch({ edge: "top" })}>Top</button></div></div>
          <div className="set-row"><span>Bar Shape</span><div className="seg"><button className={config.layout === "pill" ? "on" : ""} onClick={() => onPatch({ layout: "pill" })}>Floating Pill</button><button className={config.layout === "full" ? "on" : ""} onClick={() => onPatch({ layout: "full" })}>Full Width</button></div></div>
          <div className="set-row"><span>Windows Taskbar</span><div className="seg">{(["untouched", "autohide", "hidden"] as const).map((mode) => <button key={mode} className={config.taskbarMode === mode ? "on" : ""} onClick={() => onPatch({ taskbarMode: mode })}>{mode === "untouched" ? "Leave" : mode === "autohide" ? "Auto-hide" : "Replace"}</button>)}</div></div>
          <div className="set-row"><span>Monitor</span><div className="seg"><button className={config.displayMode === "primary" ? "on" : ""} onClick={() => onPatch({ displayMode: "primary" })}>Primary</button><button className={config.displayMode === "follow" ? "on" : ""} onClick={() => onPatch({ displayMode: "follow" })}>Follow Pointer</button><button className={config.displayMode === "all" ? "on" : ""} onClick={() => onPatch({ displayMode: "all" })}>All Monitors</button></div></div>
          <Toggle label="Auto-hide Dock" on={config.autoHide} set={(v) => onPatch({ autoHide: v })} />
          <Toggle label="24-hour clock" on={config.clock24h} set={(v) => onPatch({ clock24h: v })} />
          <Toggle label="Launch at Windows startup" on={config.launchAtStartup} set={(v) => onPatch({ launchAtStartup: v })} />
        </div>
      )}

      {tab === "automation" && (
        <div className="settings-body">
          <Toggle label="Auto-pause media when calendar meeting begins" on={config.autoPauseMeeting} set={(v) => onPatch({ autoPauseMeeting: v })} />
          <div className="set-group">
            <div className="set-kicker">Weather City</div>
            <input className="field" placeholder="e.g. London, Tokyo, New York" defaultValue={config.weatherQuery} onBlur={(e) => onPatch({ weatherQuery: e.target.value })} />
          </div>
          <div className="set-group">
            <div className="set-kicker">GitHub Personal Access Token (local only)</div>
            <input className="field" type="password" placeholder="ghp_..." defaultValue={config.githubToken} onBlur={(e) => onPatch({ githubToken: e.target.value })} />
          </div>
          <div className="set-group">
            <div className="set-kicker">DeepSeek API Key (optional, local only)</div>
            <input className="field" type="password" placeholder="sk-..." defaultValue={config.deepseekKey} onBlur={(e) => onPatch({ deepseekKey: e.target.value })} />
          </div>
        </div>
      )}

      <div className="panel-foot">
        <span className="tiny">Windocker · {snap.selfCpu.toFixed(1)}% CPU · {bytes(snap.selfMem)}</span>
        <button className="ghost danger" onClick={() => invoke("quit")}>Quit Windocker</button>
      </div>
    </section>
  );
}

export function LaunchpadModal({
  config,
  apps,
  onCall,
  onClose,
}: {
  config: Config;
  apps: Map<string, AppEntry>;
  onCall: (cmd: string, args?: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const pinned = new Set(config.pins.flatMap((p) => (p.type === "app" ? [p.id] : [])));
  const list = [...apps.values()]
    .filter((a) => a.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 72);

  return (
    <section className="card picker mac-sheet">
      <div className="panel-head">
        <div className="row">
          <div className="traffic-lights"><button className="tl red" onClick={onClose} /><span className="tl yellow" /><span className="tl green" /></div>
          <h2>Launchpad</h2>
        </div>
        <button className="x" onClick={onClose}>×</button>
      </div>
      <input className="field" autoFocus placeholder="Search installed Windows apps…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="launchpad-modal-grid">
        {list.map((app) => {
          const isPinned = pinned.has(app.id);
          return (
            <div key={app.id} className="lp-item">
              <button
                className="lp-launch"
                onClick={() => {
                  onCall("launch_app", { id: app.id });
                  onClose();
                }}
              >
                <AppIcon app={app} pack={config.iconPack} squircleWrap={config.squircleWrap} customIcons={config.customIcons} />
                <span className="tiny truncate">{app.name}</span>
              </button>
              <button
                className={`lp-pin ${isPinned ? "on" : ""}`}
                title={isPinned ? "Remove from Dock" : "Pin to Dock"}
                onClick={() => onCall(isPinned ? "unpin_app" : "pin_app", { id: app.id })}
              >
                {isPinned ? "Pinned" : "+ Dock"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function WidgetCard(props: {
  id: string;
  config: Config;
  snap: Snapshot;
  apps: Map<string, AppEntry>;
  onPatch: (patch: Partial<Config>) => void;
  onCall: (cmd: string, args?: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { id, config, snap, apps, onPatch, onCall, onClose } = props;

  if (id === "wifi") {
    return <WifiPanel snap={snap} onCall={onCall} onClose={onClose} />;
  }

  if (id === "bluetooth") {
    return <BluetoothPanel snap={snap} onCall={onCall} onClose={onClose} />;
  }

  if (id.startsWith("icon:")) {
    const appId = id.slice(5);
    const app = apps.get(appId);
    const current = config.customIcons?.[appId] || "auto";
    return (
      <section className="card mac-sheet">
        <div className="panel-head">
          <h2>macOS Icon for {app?.name || "App"}</h2>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="icon-pick-grid">
          {MAC_ICON_KEYS.map((item) => (
            <button
              key={item.key}
              className={`icon-pick-btn ${current === item.key ? "on" : ""}`}
              onClick={() => {
                const next = { ...(config.customIcons || {}) };
                if (item.key === "auto") delete next[appId];
                else next[appId] = item.key;
                onPatch({ customIcons: next });
                onClose();
              }}
            >
              {item.key === "auto" ? (
                <span className="auto-glyph">Auto</span>
              ) : (
                <span className="mini-pack-icon"><MacPackGlyph iconKey={item.key} pack={config.iconPack === "native" ? "sequoia" : config.iconPack} /></span>
              )}
              <span className="tiny truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (id.startsWith("group:")) {
    const group = config.groups.find((g) => g.id === id.slice(6));
    return (
      <section className="card mac-sheet">
        <div className="panel-head"><h2>{group?.name || "Folder"}</h2><button className="x" onClick={onClose}>×</button></div>
        <input className="field" defaultValue={group?.name || ""} onBlur={(e) => onCall("rename_group", { id: group?.id, name: e.target.value })} />
        <div className="list" style={{ marginTop: 8 }}>
          {group?.appIds.map((appId) => {
            const app = apps.get(appId);
            return (
              <button key={appId} onClick={() => { onCall("launch_app", { id: appId }); onClose(); }}>
                <span className="row">
                  <span className="mini-pack-icon"><AppIcon app={app} pack={config.iconPack} squircleWrap={config.squircleWrap} customIcons={config.customIcons} /></span>
                  <span>{app?.name || appId}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (id.startsWith("windows:") || id.startsWith("exe:")) {
    const isExe = id.startsWith("exe:");
    const key = isExe ? id.slice(4) : id.slice(8);
    const app = isExe ? undefined : apps.get(key);
    const windows = isExe
      ? snap.running.filter((w) => w.exe.split(/[/\\]/).pop()?.toLowerCase() === key)
      : app ? winsFor(app, snap.running) : [];
    return (
      <section className="card mac-sheet">
        <div className="panel-head"><h2>{app?.name || windows[0]?.name || "Windows"}</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="list">
          {windows.map((w) => (
            <button key={w.hwnd} onClick={() => { onCall("activate_window", { hwnd: w.hwnd }); onClose(); }}>
              <span className="truncate">{w.title}</span>
              <span className="tiny danger" onClick={(e) => { e.stopPropagation(); onCall("close_window", { hwnd: w.hwnd }); }}>Close</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const widget = config.widgets.find((w) => w.id === id);
  if (!widget) return null;
  return (
    <section className="card mac-sheet">
      <div className="panel-head">
        <h2>{CATALOG.find((c) => c.kind === widget.kind)?.name || widget.kind}</h2>
        <button className="x" onClick={onClose}>×</button>
      </div>
      <CardBody widget={widget} config={config} snap={snap} apps={apps} onPatch={onPatch} onCall={onCall} onClose={onClose} />
    </section>
  );
}

function WifiPanel({ snap, onCall, onClose }: { snap: Snapshot; onCall: (cmd: string, args?: Record<string, unknown>) => void; onClose: () => void }) {
  const [nets, setNets] = useState<WifiNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = () => {
    setLoading(true);
    invoke<WifiNetwork[]>("list_wifi_networks")
      .then(setNets)
      .catch(() => setNets([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
  }, [snap.wifiOn]);

  return (
    <section className="card mac-sheet">
      <div className="panel-head">
        <div className="row">
          <SfSymbol name="wifi" size={16} />
          <h2>Wi-Fi</h2>
        </div>
        <div className="row-tight">
          <button
            className={`mac-switch ${snap.wifiOn ? "on" : ""}`}
            onClick={() => onCall("toggle_radio", { kind: "wifi" })}
            title={snap.wifiOn ? "Turn Wi-Fi Off" : "Turn Wi-Fi On"}
          >
            <span />
          </button>
          <button className="x" onClick={onClose}>×</button>
        </div>
      </div>
      {snap.wifiOn === false ? (
        <p className="tiny muted">Wi-Fi is turned off.</p>
      ) : loading ? (
        <p className="tiny muted">Scanning networks…</p>
      ) : nets.length === 0 ? (
        <p className="tiny muted">No Wi-Fi networks found.</p>
      ) : (
        <div className="list">
          {nets.map((net) => (
            <button
              key={net.ssid}
              onClick={() => {
                if (!net.connected) {
                  onCall("connect_wifi", { ssid: net.ssid });
                }
              }}
            >
              <span className="row truncate">
                <SfSymbol name="wifi" size={13} />
                <span className="truncate">{net.ssid}</span>
              </span>
              <span className="row-tight">
                {net.connected ? (
                  <span className="tiny" style={{ color: "var(--up)", fontWeight: 600 }}>Connected</span>
                ) : (
                  <span className="tiny muted">{net.signal}%</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        <button className="pill-btn" onClick={refresh}>Refresh</button>
        <button className="pill-btn" onClick={() => { onCall("open_quick_settings", { kind: "wifi" }); onClose(); }}>
          Windows Wi-Fi Settings…
        </button>
      </div>
    </section>
  );
}

function BluetoothPanel({ snap, onCall, onClose }: { snap: Snapshot; onCall: (cmd: string, args?: Record<string, unknown>) => void; onClose: () => void }) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = () => {
    setLoading(true);
    invoke<BluetoothDevice[]>("list_bluetooth_devices")
      .then(setDevices)
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
  }, [snap.bluetoothOn]);

  return (
    <section className="card mac-sheet">
      <div className="panel-head">
        <div className="row">
          <SfSymbol name="bluetooth" size={16} />
          <h2>Bluetooth</h2>
        </div>
        <div className="row-tight">
          <button
            className={`mac-switch ${snap.bluetoothOn ? "on" : ""}`}
            onClick={() => onCall("toggle_radio", { kind: "bluetooth" })}
            title={snap.bluetoothOn ? "Turn Bluetooth Off" : "Turn Bluetooth On"}
          >
            <span />
          </button>
          <button className="x" onClick={onClose}>×</button>
        </div>
      </div>
      {snap.bluetoothOn === false ? (
        <p className="tiny muted">Bluetooth is turned off.</p>
      ) : loading ? (
        <p className="tiny muted">Loading devices…</p>
      ) : devices.length === 0 ? (
        <p className="tiny muted">No paired Bluetooth devices found.</p>
      ) : (
        <div className="list">
          {devices.map((dev) => (
            <button
              key={dev.address}
              onClick={() => {
                onCall("open_quick_settings", { kind: "bluetooth" });
                onClose();
              }}
            >
              <span className="row truncate">
                <SfSymbol name="bluetooth" size={13} />
                <span className="truncate">{dev.name}</span>
              </span>
              <span className="tiny" style={dev.connected ? { color: "var(--accent)", fontWeight: 600 } : undefined}>
                {dev.connected ? "Connected" : dev.paired ? "Paired" : "Nearby"}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        <button className="pill-btn" onClick={refresh}>Refresh</button>
        <button className="pill-btn" onClick={() => { onCall("open_quick_settings", { kind: "bluetooth" }); onClose(); }}>
          Bluetooth Settings…
        </button>
      </div>
    </section>
  );
}

function CardBody(props: {
  widget: Widget;
  config: Config;
  snap: Snapshot;
  apps: Map<string, AppEntry>;
  onPatch: (patch: Partial<Config>) => void;
  onCall: (cmd: string, args?: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { widget, config, snap, apps, onPatch, onCall, onClose } = props;
  const [text, setText] = useState("");
  const [wallpapers, setWallpapers] = useState<WallpaperItem[] | null>(null);

  useEffect(() => {
    if (widget.kind === "wallpaper" && wallpapers === null) {
      invoke<WallpaperItem[]>("list_wallpapers").then(setWallpapers).catch(() => setWallpapers([]));
    }
  }, [widget.kind, wallpapers]);

  if (widget.kind === "wallpaper") {
    return (
      <div>
        {wallpapers === null ? (
          <p className="tiny">Scanning Windows & Pictures wallpapers…</p>
        ) : wallpapers.length === 0 ? (
          <p className="tiny">No wallpaper images found in C:\Windows\Web\Wallpaper or Pictures.</p>
        ) : (
          <div className="wp-grid">
            {wallpapers.map((wp) => (
              <button key={wp.path} className="wp-card" onClick={() => onCall("set_wallpaper", { path: wp.path })}>
                <img src={wp.thumb} alt={wp.name} />
                <span className="tiny truncate">{wp.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (widget.kind === "now-playing") {
    const media = snap.media;
    const pct = media && media.durationSec > 0 ? Math.min(100, (media.positionSec / media.durationSec) * 100) : 0;
    return (
      <div>
        <div className="value">{media?.title || "Nothing is playing"}</div>
        <div className="tiny" style={{ marginTop: 4 }}>{media?.artist || "Play music in Spotify, Apple Music, or your browser."}</div>
        <div className="track" style={{ width: "100%", marginTop: 12 }}><span style={{ width: `${pct}%`, background: "var(--accent)" }} /></div>
        <div className="actions">
          <button className="ghost" onClick={() => onCall("media", { command: "previous" })}><SfSymbol name="prev" size={14} /></button>
          <button className="primary" onClick={() => onCall("media", { command: "toggle" })}>{media?.status === "playing" ? "Pause" : "Play"}</button>
          <button className="ghost" onClick={() => onCall("media", { command: "next" })}><SfSymbol name="next" size={14} /></button>
        </div>
      </div>
    );
  }

  if (widget.kind === "weather" || widget.kind === "weather-details" || widget.kind === "today") {
    const w = snap.weather;
    return (
      <div>
        <input className="field" placeholder="City name…" defaultValue={config.weatherQuery} onBlur={(e) => onPatch({ weatherQuery: e.target.value })} />
        {w?.error && <p className="tiny">{w.error}</p>}
        {w && !w.error && (
          <div className="weather-hero">
            <WeatherGlyph code={w.code} size={32} />
            <div>
              <div className="value">{w.city} · {Math.round(w.tempC)}°C</div>
              <div className="tiny">{sky(w.code)} · Wind {Math.round(w.wind)} km/h · Humidity {Math.round(w.humidity)}% · H {Math.round(w.hi)}° / L {Math.round(w.lo)}°</div>
              {w.sunrise && <div className="tiny">Sunrise {w.sunrise} · Sunset {w.sunset}</div>}
            </div>
          </div>
        )}
        <div className="list">
          {w?.hourly.map((h) => (
            <div key={h.label} className="set-row">
              <span className="row-tight"><WeatherGlyph code={h.code} size={14} /> {h.label}</span>
              <span>{Math.round(h.tempC)}°</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (widget.kind === "ai-limits") {
    return (
      <div>
        <div className="list">
          {snap.aiUsage.map((a) => (
            <div key={a.id} className="ai-detail-card">
              <div className="set-row">
                <strong>{a.name}</strong>
                <span className="tiny">{a.model}</span>
              </div>
              <div className="ai-row"><span className="ai-lbl">{a.primaryLabel}</span><span className="ai-track"><span style={{ width: `${Math.max(4, a.primaryPct)}%` }} /></span><span className="ai-val">{a.primaryMeta}</span></div>
              <div className="ai-row"><span className="ai-lbl">{a.secondaryLabel}</span><span className="ai-track"><span style={{ width: `${Math.max(4, a.secondaryPct)}%` }} /></span><span className="ai-val">{a.secondaryMeta}</span></div>
              <div className="tiny">{a.detail}</div>
            </div>
          ))}
        </div>
        <input className="field" style={{ marginTop: 8 }} type="password" placeholder="Optional DeepSeek API key (local only)" defaultValue={config.deepseekKey} onBlur={(e) => onPatch({ deepseekKey: e.target.value })} />
      </div>
    );
  }

  if (widget.kind === "todos") {
    return (
      <div>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onCall("add_todo", { text }); setText(""); } }}>
          <input className="field" value={text} placeholder="Add a reminder…" onChange={(e) => setText(e.target.value)} />
        </form>
        <div className="list" style={{ marginTop: 8 }}>
          {config.todos.map((todo) => (
            <button key={todo.id} onClick={() => onCall("toggle_todo", { id: todo.id })}>
              <span style={{ textDecoration: todo.done ? "line-through" : "none", opacity: todo.done ? 0.55 : 1 }}>{todo.text}</span>
              <span className="danger" onClick={(e) => { e.stopPropagation(); onCall("delete_todo", { id: todo.id }); }}>Delete</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (widget.kind === "notes") {
    const note = config.notes[0];
    return <textarea defaultValue={note?.text || ""} placeholder="First line becomes the dock title…" onBlur={(e) => onCall("save_note", { id: note?.id || "", text: e.target.value })} />;
  }

  if (widget.kind === "calendar") {
    const events = [...config.events, ...snap.remoteEvents].sort((a, b) => a.startMs - b.startMs);
    return (
      <div>
        <form
          className="list"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const title = String(data.get("title") || "");
            const when = String(data.get("when") || "");
            if (!title || !when) return;
            const start = new Date(when).getTime();
            onCall("add_event", { title, startMs: start, endMs: start + 3600000 });
            e.currentTarget.reset();
          }}
        >
          <input className="field" name="title" placeholder="New event title" />
          <input className="field" name="when" type="datetime-local" />
          <button className="primary" type="submit">Add Event</button>
        </form>
        <input className="field" style={{ marginTop: 8 }} placeholder="iCal / ICS URL (Google, Outlook, iCloud)" defaultValue={config.icalUrl} onBlur={(e) => onPatch({ icalUrl: e.target.value })} />
        <div className="list" style={{ marginTop: 8 }}>
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
        {[1, 5, 10, 15, 25].map((m) => (
          <button key={m} className="ghost" onClick={() => onPatch({ timerPausedMs: null, timerDeadlineMs: Date.now() + m * 60000 })}>{m}m</button>
        ))}
        <button className="primary" onClick={() => onPatch({ timerDeadlineMs: null, timerPausedMs: null })}>Reset</button>
      </div>
    );
  }

  if (widget.kind === "stopwatch") {
    const running = config.stopwatchStartedMs != null;
    return (
      <div className="actions">
        <button className="primary" onClick={() => onPatch(running ? { stopwatchAccumMs: config.stopwatchAccumMs + (Date.now() - (config.stopwatchStartedMs || Date.now())), stopwatchStartedMs: null } : { stopwatchStartedMs: Date.now() })}>
          {running ? "Pause" : "Start"}
        </button>
        <button className="ghost" onClick={() => onPatch({ stopwatchAccumMs: 0, stopwatchStartedMs: null })}>Reset</button>
      </div>
    );
  }

  if (widget.kind === "pomodoro") {
    return (
      <div>
        <div className="actions">
          <button className="primary" onClick={() => onPatch({ pomoRunning: true, pomoPhase: "focus", pomoDeadlineMs: Date.now() + config.pomoFocusMin * 60000 })}>Start Focus</button>
          <button className="ghost" onClick={() => onPatch({ pomoRunning: false, pomoDeadlineMs: null })}>Reset</button>
        </div>
        <div className="set-row"><span>Focus length ({config.pomoFocusMin}m)</span><input type="range" min={5} max={90} value={config.pomoFocusMin} onChange={(e) => onPatch({ pomoFocusMin: Number(e.target.value) })} /></div>
        <div className="set-row"><span>Break length ({config.pomoBreakMin}m)</span><input type="range" min={1} max={30} value={config.pomoBreakMin} onChange={(e) => onPatch({ pomoBreakMin: Number(e.target.value) })} /></div>
      </div>
    );
  }

  if (widget.kind === "github") {
    return (
      <div>
        <input className="field" type="password" placeholder="GitHub token (stored locally)" defaultValue={config.githubToken} onBlur={(e) => onPatch({ githubToken: e.target.value })} />
        {snap.github?.error && <p className="tiny">{snap.github.error}</p>}
        {snap.github && !snap.github.error && <p>{snap.github.login} · {snap.github.total} this year · {snap.github.streak}d streak</p>}
        <div className="contrib" aria-hidden>
          {snap.github?.cells.slice(-98).map((n, i) => (
            <span key={i} style={{ background: n === 0 ? undefined : `rgba(48,209,88,${0.25 + Math.min(n, 12) / 16})` }} />
          ))}
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
        <div className="list" style={{ marginTop: 8 }}>
          {snap.screenApps.map((a) => <div key={a.name} className="set-row"><span>{a.name}</span><span>{mins(a.seconds)}</span></div>)}
        </div>
      </div>
    );
  }

  if (widget.kind === "storage") {
    return <div className="list">{snap.disks.map((d) => <div key={d.mount} className="set-row"><span>{d.mount || d.name}</span><span>{bytes(d.free)} free of {bytes(d.total)}</span></div>)}</div>;
  }

  if (widget.kind === "recycle") {
    return <div><p>{snap.recycleCount} items · {bytes(snap.recycleBytes)}</p><button className="ghost danger" onClick={() => onCall("empty_recycle")}>Empty macOS Trash</button></div>;
  }

  if (widget.kind === "battery") {
    const isWave = (widget.settings?.style as string) !== "pill";
    return (
      <div className="set-row">
        <span>Battery Style</span>
        <div className="seg">
          <button className={isWave ? "on" : ""} onClick={() => onCall("set_widget_settings", { id: widget.id, settings: { style: "wave" } })}>Liquid Wave</button>
          <button className={!isWave ? "on" : ""} onClick={() => onCall("set_widget_settings", { id: widget.id, settings: { style: "pill" } })}>Solid Squircle</button>
        </div>
      </div>
    );
  }

  if (widget.kind === "top" || widget.kind === "system-rings") {
    return (
      <div>
        {snap.topCpu.map((p) => <div key={p.name} className="set-row"><span>{p.name}</span><span>{p.value.toFixed(1)}% CPU</span></div>)}
        {snap.topRam.map((p) => <div key={p.name + "r"} className="set-row"><span>{p.name}</span><span>{p.value.toFixed(0)} MB</span></div>)}
        <div className="actions"><button className="primary" onClick={() => invoke("open_task_manager")}>Open Task Manager</button></div>
      </div>
    );
  }

  if (widget.kind === "search") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); onCall("search", { query: text }); onClose(); }}>
        <input className="field" autoFocus placeholder="Search web or open C:\path…" value={text} onChange={(e) => setText(e.target.value)} />
      </form>
    );
  }

  if (widget.kind === "commands") {
    const matches = [...apps.values()].filter((a) => a.name.toLowerCase().includes(text.toLowerCase())).slice(0, 6);
    const trimmed = text.trim();
    let calcResult: string | null = null;
    if (/^[0-9+\-*/().\s]+$/.test(trimmed) && /[+\-*/]/.test(trimmed)) {
      try {
        const val = Function(`"use strict"; return (${trimmed})`)();
        if (typeof val === "number" && Number.isFinite(val)) calcResult = String(val);
      } catch {
        calcResult = null;
      }
    }
    const sysCmds = [
      { key: "theme", label: "Toggle Dark / Light Mode", run: () => onCall("toggle_theme") },
      { key: "screenshot", label: "Take Screenshot", run: () => onCall("screenshot", { mode: "screen" }) },
      { key: "desktop", label: "Show Desktop", run: () => invoke("show_desktop") },
      { key: "lock", label: "Lock Screen", run: () => invoke("lock_screen") },
      { key: "trash", label: "Empty Trash", run: () => onCall("empty_recycle") },
      { key: "taskmgr", label: "Open Activity / Task Manager", run: () => invoke("open_task_manager") },
    ].filter((c) => !trimmed || c.key.includes(trimmed.toLowerCase()) || c.label.toLowerCase().includes(trimmed.toLowerCase()));

    return (
      <div>
        <input
          className="field"
          autoFocus
          placeholder="Spotlight: app, math (24*60), lock, theme, screenshot…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (matches[0]) { onCall("launch_app", { id: matches[0].id }); onClose(); }
            else if (sysCmds[0]) { sysCmds[0].run(); onClose(); }
            else if (trimmed) { onCall("search", { query: trimmed }); onClose(); }
          }}
        />
        {calcResult != null && <div className="spotlight-calc">= {calcResult}</div>}
        <div className="list" style={{ marginTop: 8 }}>
          {matches.map((a) => (
            <button key={a.id} onClick={() => { onCall("launch_app", { id: a.id }); onClose(); }}>
              <span className="row">
                <span className="mini-pack-icon"><AppIcon app={a} pack={config.iconPack} squircleWrap={config.squircleWrap} customIcons={config.customIcons} /></span>
                <span>{a.name}</span>
              </span>
              <span className="tiny">App</span>
            </button>
          ))}
          {sysCmds.slice(0, 4).map((c) => (
            <button key={c.key} onClick={() => { c.run(); onClose(); }}>
              <span>{c.label}</span>
              <span className="tiny">Action</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (widget.kind === "world-clock") {
    return (
      <div>
        <div className="list">
          {snap.clocks.map((city) => (
            <div key={city.label} className="set-row">
              <span>{city.label}</span>
              <span>{city.time} <span className="tiny">UTC{city.offset}</span></span>
            </div>
          ))}
        </div>
        <input className="field" style={{ marginTop: 8 }} defaultValue={config.worldCities.join(", ")} onBlur={(e) => onPatch({ worldCities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </div>
    );
  }

  return <p className="tiny">Live tile active on dock. Right-click to move or configure.</p>;
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="set-row">
      <span>{label}</span>
      <button className={`mac-switch ${on ? "on" : ""}`} onClick={() => set(!on)} aria-pressed={on}>
        <span />
      </button>
    </div>
  );
}

export { fmt };
