# Changelog

## 1.1.0

Major macOS-style dock, icon pack, and LumaBar-inspired bento widget upgrade for Windows 10 and Windows 11.

### macOS Icon Packs & App Dock

- Four selectable icon packs: **macOS Sequoia**, **macOS Dark**, **Tahoe Glass**, and **Windows Native**.
- Built-in macOS squircle icon replacements for common Windows apps (File Explorer → Finder, Edge → Safari, Windows Terminal/PowerShell → Terminal, Notepad/Notes → Notes, Task Manager → Activity Monitor, VS Code, Settings, Calculator, Mail, Music, Photos, Chrome, Firefox, Discord, Docker, GitHub), macOS folder icons for groups, and dynamic empty/full macOS Trash.
- Optional squircle framing for any unmapped Windows `.exe`, plus right-click **Change macOS Icon…** per pinned app.
- Cursor-proximity parabolic magnification wave, launch bounce animation, hover tooltip labels, and automatic display of unpinned running Windows apps after a dock divider.
- Dedicated **Launchpad** modal with instant search and one-click Pin/Launch.
- Higher-resolution 96×96 Windows icon extraction (`PrivateExtractIconsW`) and transparent icon alpha preservation.

### Dock Styles & macOS UI

- Seven themes: **Liquid Glass**, **macOS Dark**, **iOS Frosted**, **Midnight**, **Pure Black**, **Pure White**, and **Clear**, with optional Windows Desktop Acrylic Blur toggle.
- Redesigned **System Settings**, **Widget Gallery**, **Welcome**, and popover sheets with macOS traffic-light titlebars, pill switches, accent presets, and `Esc` / blur dismissal.

### LumaBar-Inspired Bento Widgets

- **Control Center (`quick`)**: Wi-Fi and Bluetooth capsules, Dark/Light mode switch, and notification toast mute toggle.
- **Audio & Brightness (`volume`, `brightness`)**: Active Windows playback device name readout and inline macOS pill sliders.
- **Productivity (`pomodoro`, `timer`, `stopwatch`, `todos`, `notes`, `calendar`, `screen-time`)**: Red-bordered Focus `1/4` card and blue-bordered Timer card with inline Play/Pause/Skip controls, checkable inline To-dos, macOS Notes preview card, and optional meeting auto-pause.
- **Clocks & Weather (`today`, `clock`, `flip-clock`, `analog-clock`, `date`, `world-clock`, `day-progress`, `weather`, `weather-details`)**: Split-flap Flip Clock, minimal Analog Clock, Today + Weather bento tile, 3×10 dot-matrix Day Progress, and Weather Details (wind, precipitation, humidity, sunrise/sunset, H/L).
- **System, AI & Utilities (`system-rings`, `battery`, `ai-limits`, `screenshot`, `wallpaper`, `recycle`, `commands`)**: Dual CPU/RAM circular rings, Liquid Wave and Solid Squircle battery styles, local Claude/Gemini/Codex activity + optional DeepSeek balance, 3-button Capture bar, desktop Wallpaper thumbnail & switcher, and Spotlight command/math/app launcher.

## 1.0.0

First public release of Windocker, a macOS-inspired dock for Windows 10 and Windows 11.

### Dock

- Pill and full-width layouts on the top or bottom edge.
- Size, spacing, padding, and distance from the screen edge.
- Pinned apps, running indicators, launch, switch, minimize, reorder, group, and drop-to-pin.
- Glass, iOS, midnight, black, white, and clear styles. Glass styles use Windows acrylic.
- Auto-hide, and a taskbar that can auto-hide, hide, or stay untouched. Quitting restores it.

### Widgets

Live tiles for apps, search, commands, Recycle Bin, storage, CPU, memory, network, top apps, battery, brightness, quick toggles, volume, microphone, now playing, clock, date, world clocks, day progress, timer, stopwatch, focus, to-dos, notes, calendar, screen time, weather, GitHub, and currency.

### Also in this release

- First-launch taskbar choice, settings, system tray, and optional startup.
- Settings stored locally in `%APPDATA%\com.windocker.app`. No account and no Windocker server.
- NSIS installer and a portable executable. WebView2 is required.

On the development PC, the release build used about 0.16% of total CPU and 58 MB of working set during a 15 second sample with the welcome card open.
