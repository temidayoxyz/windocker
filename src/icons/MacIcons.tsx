import type { AppEntry, IconPack } from "../types";

export const MAC_ICON_KEYS = [
  { key: "auto", label: "Auto match" },
  { key: "finder", label: "Finder" },
  { key: "safari", label: "Safari" },
  { key: "terminal", label: "Terminal" },
  { key: "notes", label: "Notes" },
  { key: "settings", label: "Settings" },
  { key: "activity", label: "Activity Monitor" },
  { key: "vscode", label: "Code" },
  { key: "music", label: "Music" },
  { key: "photos", label: "Photos" },
  { key: "mail", label: "Mail" },
  { key: "calculator", label: "Calculator" },
  { key: "messages", label: "Messages" },
  { key: "telegram", label: "Telegram" },
  { key: "discord", label: "Discord" },
  { key: "chrome", label: "Chrome" },
  { key: "firefox", label: "Firefox" },
  { key: "docker", label: "Docker" },
  { key: "github", label: "GitHub" },
] as const;

export function resolveMacIconKey(app?: Pick<AppEntry, "id" | "name" | "exe">, customIcons?: Record<string, string>): string | null {
  if (!app) return null;
  const custom = customIcons?.[app.id];
  if (custom && custom !== "auto") return custom;
  const exeFile = (app.exe.split(/[/\\]/).pop() || "").toLowerCase();
  const nameLower = app.name.toLowerCase();
  const hay = `${app.name} ${app.exe} ${app.id}`.toLowerCase();
  if (exeFile === "explorer.exe" || nameLower === "file explorer" || app.id === "explorer") return "finder";
  if (exeFile === "msedge.exe" || hay.includes("microsoft edge") || nameLower === "safari") return "safari";
  if (hay.includes("chrome")) return "chrome";
  if (hay.includes("firefox")) return "firefox";
  if (hay.includes("windows terminal") || exeFile === "wt.exe" || exeFile === "powershell.exe" || exeFile === "pwsh.exe" || exeFile === "cmd.exe" || hay.includes("git bash") || hay.includes("wezterm") || hay.includes("alacritty")) return "terminal";
  if (hay.includes("notepad") || hay.includes("obsidian") || hay.includes("notion") || hay.includes("onenote")) return "notes";
  if (exeFile === "systemsettings.exe" || hay.includes("ms-settings") || nameLower === "settings" || hay.includes("control panel")) return "settings";
  if (exeFile === "taskmgr.exe" || hay.includes("task manager") || hay.includes("activity monitor")) return "activity";
  if (exeFile === "code.exe" || exeFile === "code - insiders.exe" || nameLower.includes("visual studio code") || exeFile === "cursor.exe" || exeFile === "idea64.exe") return "vscode";
  if (hay.includes("spotify") || hay.includes("apple music") || hay.includes("vlc") || hay.includes("itunes") || hay.includes("media player")) return "music";
  if (hay.includes("photos")) return "photos";
  if (hay.includes("outlook") || hay.includes("thunderbird") || nameLower === "mail") return "mail";
  if (exeFile === "calc.exe" || exeFile === "calculatorapp.exe" || nameLower === "calculator") return "calculator";
  if (hay.includes("telegram")) return "telegram";
  if (hay.includes("whatsapp") || hay.includes("slack") || hay.includes("teams") || nameLower === "messages") return "messages";
  if (hay.includes("discord")) return "discord";
  if (hay.includes("docker")) return "docker";
  if (hay.includes("github")) return "github";
  return null;
}

export function MacSquircleShell({
  pack,
  bg,
  children,
}: {
  pack: IconPack | string;
  bg: string;
  children: React.ReactNode;
}) {
  const isDark = pack === "dark";
  const isGlass = pack === "glass";
  const shellStyle: React.CSSProperties = isDark
    ? {
        background: "linear-gradient(160deg, #27272c 0%, #151519 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.4)",
      }
    : isGlass
      ? {
          background: "linear-gradient(155deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 100%)",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -1px 1px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
        }
      : {
          background: bg,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.36), inset 0 -1px 0 rgba(0,0,0,0.24), 0 4px 10px rgba(0,0,0,0.3)",
        };
  return (
    <span className="mac-squircle" style={shellStyle}>
      {children}
    </span>
  );
}

export function MacPackGlyph({ iconKey, pack }: { iconKey: string; pack: IconPack | string }) {
  const darkTint = pack === "dark";
  switch (iconKey) {
    case "finder":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #62c5ff 0%, #1e87f0 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            {!darkTint && (
              <>
                <defs>
                  <linearGradient id="fndL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6ed0ff" />
                    <stop offset="100%" stopColor="#1b7df5" />
                  </linearGradient>
                  <linearGradient id="fndR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5fbff" />
                    <stop offset="100%" stopColor="#cce8ff" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="33" height="64" fill="url(#fndL)" />
                <path d="M32 0 H64 V64 H32 C26 48 26 32 34 22 C37 18 35 8 32 0 Z" fill="url(#fndR)" />
              </>
            )}
            <rect x="19" y="21" width="4.2" height="9" rx="2.1" fill={darkTint ? "#5ac8fa" : "#11243e"} />
            <rect x="41" y="21" width="4.2" height="9" rx="2.1" fill={darkTint ? "#5ac8fa" : "#11243e"} />
            <path d="M32 14 C34 24 34 30 28 35 H35" fill="none" stroke={darkTint ? "#5ac8fa" : "#153257"} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 42 C24 50 40 50 47 42" fill="none" stroke={darkTint ? "#5ac8fa" : "#11243e"} strokeWidth="3.4" strokeLinecap="round" />
          </svg>
        </MacSquircleShell>
      );

    case "safari":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #f9fbff 0%, #e5ecf7 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <circle cx="32" cy="32" r="24" fill={darkTint ? "#14304d" : "#1c8ef9"} stroke={darkTint ? "#38bdf8" : "#ffffff"} strokeWidth="2" />
            <circle cx="32" cy="32" r="20" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeDasharray="2 3" />
            <polygon points="32,14 37,32 32,32" fill="#ff3b30" />
            <polygon points="32,14 27,32 32,32" fill="#ff6961" />
            <polygon points="32,50 37,32 32,32" fill="#e5e5ea" />
            <polygon points="32,50 27,32 32,32" fill="#ffffff" />
            <circle cx="32" cy="32" r="2.5" fill="#d1d1d6" />
          </svg>
        </MacSquircleShell>
      );

    case "terminal":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #d7dbe2 0%, #9fa6b2 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <rect x="6" y="6" width="52" height="52" rx="12" fill="#18191c" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
            <path d="M16 23 L26 30 L16 37" fill="none" stroke={darkTint ? "#30d158" : "#f5f5f7"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="30" y1="39" x2="44" y2="39" stroke={darkTint ? "#30d158" : "#f5f5f7"} strokeWidth="4" strokeLinecap="round" />
          </svg>
        </MacSquircleShell>
      );

    case "notes":
      return (
        <MacSquircleShell pack={pack} bg={darkTint ? "#1c1c20" : "linear-gradient(180deg, #fffdf7 0%, #f5efe0 100%)"}>
          <svg viewBox="0 0 64 64" className="mac-svg">
            <rect x="0" y="0" width="64" height="17" fill="url(#noteTop)" />
            <defs>
              <linearGradient id="noteTop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffd60a" />
                <stop offset="100%" stopColor="#f5b800" />
              </linearGradient>
            </defs>
            <line x1="0" y1="17.5" x2="64" y2="17.5" stroke={darkTint ? "rgba(255,214,10,0.45)" : "#d6c8a5"} strokeWidth="1.4" strokeDasharray="3 2" />
            <line x1="10" y1="29" x2="54" y2="29" stroke={darkTint ? "rgba(255,255,255,0.16)" : "#d8d1c2"} strokeWidth="1.8" strokeLinecap="round" />
            <line x1="10" y1="39" x2="54" y2="39" stroke={darkTint ? "rgba(255,255,255,0.16)" : "#d8d1c2"} strokeWidth="1.8" strokeLinecap="round" />
            <line x1="10" y1="49" x2="42" y2="49" stroke={darkTint ? "rgba(255,255,255,0.16)" : "#d8d1c2"} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </MacSquircleShell>
      );

    case "settings":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #b8bec8 0%, #6f7580 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <circle cx="32" cy="32" r="19" fill={darkTint ? "#2c2c34" : "#444850"} stroke={darkTint ? "#8e95a3" : "#e5e7eb"} strokeWidth="3.5" strokeDasharray="6 3.9" />
            <circle cx="32" cy="32" r="11" fill={darkTint ? "#1c1c20" : "#8d94a0"} stroke="#d1d5db" strokeWidth="2.5" />
            <circle cx="32" cy="32" r="4.5" fill={darkTint ? "#e5e7eb" : "#2b2f36"} />
          </svg>
        </MacSquircleShell>
      );

    case "activity":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #27323f 0%, #141a21 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path d="M8 34 H18 L24 18 L31 47 L38 24 L43 34 H56" fill="none" stroke="#30d158" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </MacSquircleShell>
      );

    case "vscode":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #1b2845 0%, #0d1526 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path d="M44 13 L51 17 V47 L44 51 L22 33 L15 38 L12 35 L19 29 L12 23 L15 20 L22 25 Z" fill="#29a9ff" />
            <path d="M44 13 V51 L27 32 Z" fill="#007acc" opacity="0.9" />
          </svg>
        </MacSquircleShell>
      );

    case "music":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #ff5f6d 0%, #fa243c 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path d="M25 44 V20 L46 15 V39" fill="none" stroke={darkTint ? "#ff375f" : "#ffffff"} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="20.5" cy="44" r="5.5" fill={darkTint ? "#ff375f" : "#ffffff"} />
            <circle cx="41.5" cy="39" r="5.5" fill={darkTint ? "#ff375f" : "#ffffff"} />
          </svg>
        </MacSquircleShell>
      );

    case "photos":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #ffffff 0%, #f0f2f7 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            {[
              { rot: 0, fill: "#ff9500" },
              { rot: 45, fill: "#ffcc00" },
              { rot: 90, fill: "#34c759" },
              { rot: 135, fill: "#00c7be" },
              { rot: 180, fill: "#007aff" },
              { rot: 225, fill: "#5856d6" },
              { rot: 270, fill: "#af52de" },
              { rot: 315, fill: "#ff2d55" },
            ].map((p) => (
              <ellipse
                key={p.rot}
                cx="32"
                cy="19"
                rx="6"
                ry="11"
                fill={p.fill}
                opacity="0.88"
                transform={`rotate(${p.rot} 32 32)`}
              />
            ))}
          </svg>
        </MacSquircleShell>
      );

    case "mail":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #4db8ff 0%, #1273eb 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <rect x="12" y="19" width="40" height="26" rx="5" fill={darkTint ? "#38bdf8" : "#ffffff"} />
            <path d="M13 21 L32 35 L51 21" fill="none" stroke={darkTint ? "#141418" : "#1273eb"} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </MacSquircleShell>
      );

    case "calculator":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #4a4b50 0%, #242529 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <rect x="14" y="12" width="36" height="10" rx="3" fill="#8e8e93" opacity="0.45" />
            <circle cx="20" cy="32" r="4" fill="#d1d1d6" />
            <circle cx="32" cy="32" r="4" fill="#d1d1d6" />
            <circle cx="44" cy="32" r="4" fill="#ff9f0a" />
            <circle cx="20" cy="44" r="4" fill="#d1d1d6" />
            <circle cx="32" cy="44" r="4" fill="#d1d1d6" />
            <rect x="40" y="40" width="8" height="8" rx="4" fill="#ff9f0a" />
          </svg>
        </MacSquircleShell>
      );

    case "messages":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #5ef076 0%, #1ac938 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path
              d="M32 15 C19 15 11 23 11 32 C11 38 15 43 21 46 L17 52 L26 48 C28 49 30 49 32 49 C45 49 53 41 53 32 C53 23 45 15 32 15 Z"
              fill={darkTint ? "#30d158" : "#ffffff"}
            />
          </svg>
        </MacSquircleShell>
      );

    case "telegram":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #37aee2 0%, #1e96c8 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path
              d="M49 17 L13 31 C11 31.8 11 34 13.2 34.7 L22.5 37.6 L43 24.5 C44 23.9 44.8 24.4 44.1 25.1 L27.6 40.1 L26.9 48.2 C27.9 48.2 28.4 47.7 29 47.1 L33.6 42.6 L43 49.5 C44.7 50.5 46 50 46.4 47.9 L51.4 19.6 C51.9 17.3 50.6 16.3 49 17 Z"
              fill={darkTint ? "#38bdf8" : "#ffffff"}
            />
          </svg>
        </MacSquircleShell>
      );

    case "discord":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #6d78ff 0%, #4e56d6 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path d="M21 21 C26 18 38 18 43 21 C47 26 49 35 47 43 C42 46 39 47 36 47 L34 44 C37 43 39 42 39 42 M28 44 L26 47 C23 47 20 46 17 43 C15 35 17 26 21 21 Z" fill="none" stroke={darkTint ? "#818cf8" : "#ffffff"} strokeWidth="3" strokeLinecap="round" />
            <circle cx="25.5" cy="33" r="3" fill={darkTint ? "#818cf8" : "#ffffff"} />
            <circle cx="38.5" cy="33" r="3" fill={darkTint ? "#818cf8" : "#ffffff"} />
          </svg>
        </MacSquircleShell>
      );

    case "chrome":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #ffffff 0%, #eef2f7 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <circle cx="32" cy="32" r="20" fill="#34a853" />
            <path d="M13 24 A20 20 0 0 1 51 24 L32 24 Z" fill="#ea4335" />
            <path d="M51 24 A20 20 0 0 1 32 52 L41 36 Z" fill="#fbbc05" />
            <circle cx="32" cy="32" r="9.5" fill="#ffffff" />
            <circle cx="32" cy="32" r="7" fill="#4285f4" />
          </svg>
        </MacSquircleShell>
      );

    case "firefox":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #2d1b69 0%, #140e36 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <circle cx="32" cy="34" r="17" fill="#5b6cff" />
            <path d="M46 24 C49 34 43 49 28 49 C16 49 11 36 18 22 C21 27 25 27 28 24 C23 19 28 13 36 15 C42 16 45 20 46 24 Z" fill="#ff7a2f" />
          </svg>
        </MacSquircleShell>
      );

    case "docker":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #2da4ff 0%, #0969da 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path d="M14 35 H49 C49 44 42 49 30 49 C18 49 14 42 14 35 Z" fill={darkTint ? "#38bdf8" : "#ffffff"} />
            <rect x="20" y="27" width="6" height="6" rx="1" fill={darkTint ? "#38bdf8" : "#ffffff"} />
            <rect x="28" y="27" width="6" height="6" rx="1" fill={darkTint ? "#38bdf8" : "#ffffff"} />
            <rect x="36" y="27" width="6" height="6" rx="1" fill={darkTint ? "#38bdf8" : "#ffffff"} />
            <rect x="28" y="19" width="6" height="6" rx="1" fill={darkTint ? "#38bdf8" : "#ffffff"} />
          </svg>
        </MacSquircleShell>
      );

    case "github":
      return (
        <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #32363e 0%, #17191d 100%)">
          <svg viewBox="0 0 64 64" className="mac-svg">
            <path
              d="M32 14 C21.5 14 13 22.5 13 33 C13 41.4 18.4 48.5 26 51 C27 51.2 27.3 50.6 27.3 50.1 V46.7 C22 47.8 20.9 44.4 20.9 44.4 C20 42.2 18.8 41.6 18.8 41.6 C17 40.4 18.9 40.4 18.9 40.4 C20.8 40.5 21.8 42.4 21.8 42.4 C23.5 45.3 26.3 44.5 27.4 44 C27.6 42.8 28.1 41.9 28.6 41.4 C24.4 40.9 20 39.3 20 32.1 C20 30 20.7 28.3 21.9 27 C21.7 26.5 21 24.5 22.1 21.9 C22.1 21.9 23.7 21.4 27.3 23.8 C28.8 23.4 30.4 23.2 32 23.2 C33.6 23.2 35.2 23.4 36.7 23.8 C40.3 21.4 41.9 21.9 41.9 21.9 C43 24.5 42.3 26.5 42.1 27 C43.3 28.3 44 30 44 32.1 C44 39.3 39.6 40.9 35.3 41.4 C36 42 36.6 43.2 36.6 45 V50.1 C36.6 50.6 37 51.2 38 51 C45.6 48.5 51 41.4 51 33 C51 22.5 42.5 14 32 14 Z"
              fill="#f5f5f7"
            />
          </svg>
        </MacSquircleShell>
      );

    default:
      return null;
  }
}

export function LaunchpadIcon({ pack }: { pack: IconPack | string }) {
  const isDark = pack === "dark";
  return (
    <MacSquircleShell
      pack={pack}
      bg={isDark ? "#18191f" : "linear-gradient(180deg, #f4f7fc 0%, #dce4f2 100%)"}
    >
      <svg viewBox="0 0 64 64" className="mac-svg">
        <defs>
          <linearGradient id="win11Blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4cc2ff" />
            <stop offset="100%" stopColor="#0078d4" />
          </linearGradient>
        </defs>
        <rect x="13" y="13" width="17.5" height="17.5" rx="3" fill="url(#win11Blue)" />
        <rect x="33.5" y="13" width="17.5" height="17.5" rx="3" fill="url(#win11Blue)" opacity="0.92" />
        <rect x="13" y="33.5" width="17.5" height="17.5" rx="3" fill="url(#win11Blue)" opacity="0.92" />
        <rect x="33.5" y="33.5" width="17.5" height="17.5" rx="3" fill="url(#win11Blue)" opacity="0.84" />
      </svg>
    </MacSquircleShell>
  );
}

export function MacFolderIcon({ pack }: { pack: IconPack | string }) {
  return (
    <MacSquircleShell pack={pack} bg="transparent">
      <svg viewBox="0 0 64 64" className="mac-svg">
        <path d="M8 18 C8 14.5 10.5 12 14 12 H25 L30 17 H50 C53.5 17 56 19.5 56 23 V47 C56 50.5 53.5 53 50 53 H14 C10.5 53 8 50.5 8 47 Z" fill={pack === "dark" ? "#263b52" : "#56b7f7"} />
        <rect x="8" y="21" width="48" height="31" rx="6" fill={pack === "dark" ? "#1d2c3e" : "#77cbff"} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      </svg>
    </MacSquircleShell>
  );
}

export function MacTrashIcon({ full, pack }: { full: boolean; pack: IconPack | string }) {
  return (
    <MacSquircleShell pack={pack} bg="linear-gradient(180deg, #d7dce4 0%, #97a0ad 100%)">
      <svg viewBox="0 0 64 64" className="mac-svg">
        {full && (
          <g>
            <polygon points="20,21 29,13 38,21" fill="#ffffff" />
            <polygon points="30,21 40,14 46,22" fill="#e5e7eb" />
          </g>
        )}
        <path d="M18 22 H46 L43 50 C42.8 52 41 53.5 39 53.5 H25 C23 53.5 21.2 52 21 50 Z" fill={pack === "dark" ? "#3a3d45" : "#eef1f6"} stroke="rgba(0,0,0,0.22)" strokeWidth="1.5" />
        <ellipse cx="32" cy="22" rx="14.5" ry="3.2" fill={pack === "dark" ? "#50545e" : "#cfd5df"} stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
        <line x1="27" y1="28" x2="28" y2="48" stroke="rgba(0,0,0,0.18)" strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="28" x2="32" y2="48" stroke="rgba(0,0,0,0.18)" strokeWidth="2" strokeLinecap="round" />
        <line x1="37" y1="28" x2="36" y2="48" stroke="rgba(0,0,0,0.18)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </MacSquircleShell>
  );
}

export function SfSymbol({ name, size = 15, className = "" }: { name: string; size?: number; className?: string }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (name) {
    case "wifi":
      return <svg {...props}><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" /></svg>;
    case "bluetooth":
      return <svg {...props}><polyline points="6.5 6.5 17.5 17.5 12 22 12 2 17.5 6.5 6.5 17.5" /></svg>;
    case "moon":
      return <svg {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
    case "sun":
      return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>;
    case "bell":
      return <svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case "bell-off":
      return <svg {...props}><path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M18.63 13A17.89 17.89 0 0 1 18 8" /><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" /><path d="M18 8a6 6 0 0 0-9.33-5" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
    case "volume":
      return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>;
    case "volume-mute":
      return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>;
    case "mic":
      return <svg {...props}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>;
    case "mic-off":
      return <svg {...props}><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /></svg>;
    case "play":
      return <svg {...props} fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4" /></svg>;
    case "pause":
      return <svg {...props} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
    case "next":
      return <svg {...props} fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4" /><rect x="17" y="4" width="2.5" height="16" rx="1" /></svg>;
    case "prev":
      return <svg {...props} fill="currentColor" stroke="none"><polygon points="19 4 9 12 19 20 19 4" /><rect x="4.5" y="4" width="2.5" height="16" rx="1" /></svg>;
    case "skip":
      return <svg {...props} fill="currentColor" stroke="none"><polygon points="4 5 14 12 4 19 4 5" /><rect x="16" y="5" width="3" height="14" rx="1" /></svg>;
    case "chevron":
      return <svg {...props}><polyline points="9 18 15 12 9 6" /></svg>;
    case "edit":
      return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
    case "camera":
      return <svg {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
    case "crop":
      return <svg {...props}><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" /><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" /></svg>;
    case "folder":
      return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
    case "search":
      return <svg {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case "terminal":
      return <svg {...props}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
    case "cloud":
      return <svg {...props}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>;
    case "wind":
      return <svg {...props}><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" /></svg>;
    case "bolt":
      return <svg {...props} fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case "swap":
      return <svg {...props}><polyline points="7 16 3 12 7 8" /><line x1="21" y1="12" x2="3" y2="12" /><polyline points="17 8 21 12 17 16" /></svg>;
    case "check":
      return <svg {...props}><polyline points="20 6 9 17 4 12" /></svg>;
    case "sparkles":
      return <svg {...props}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /></svg>;
    default:
      return null;
  }
}

export function WeatherGlyph({ code, size = 18 }: { code: number; size?: number }) {
  if (code === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="5" fill="#ffd60a" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="#ffd60a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (code < 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <circle cx="9" cy="9" r="4" fill="#ffd60a" />
        <path d="M8 19h9a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 6.6 12.2 3.5 3.5 0 0 0 8 19Z" fill="#e5eef8" />
      </svg>
    );
  }
  if (code >= 50 && code < 90) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M7 15h10a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 6.5 8.5 3.5 3.5 0 0 0 7 15Z" fill="#cbd5e1" />
        <line x1="9" y1="18" x2="8" y2="21" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="18" x2="13" y2="21" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M7 17h10a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 6.5 10.5 3.5 3.5 0 0 0 7 17Z" fill="#d1d5db" />
    </svg>
  );
}
