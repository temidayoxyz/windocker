# Changelog

## 1.4.0

Dock Stacks & Finder-lite update:

- **Folder Dock Stacks**: Drag and drop any folder onto the dock (or right-click Launchpad to pin **Downloads**, **Documents**, or **Desktop**) to create expandable Dock Stacks with Grid/List views, subfolder navigation, and Explorer integration.
- **Quick Preview (Finder-lite)**: Preview images, text/code/config files, and folder summaries directly inside any Dock Stack before opening or revealing in Windows Explorer.

## 1.3.1

Hotfix for v1.3.0 multi-monitor, icon catalog, Launchpad search, and hover clipping:

- **Instant App Catalog & Icons (`catalog.json` cache)**: Cached scanned Start Menu apps locally and skipped slow/unreachable UNC network shortcuts so Launchpad search and pinned app icons load immediately with zero `?` placeholders.
- **Hover Magnification & Tooltip Clipping Fix**: Removed `overflow-x: auto` from `.tile.apps` (which forced `overflow-y` clipping in CSS), restoring full unclipped magnification and hover labels.
- **Per-Monitor Auto-Hide Bounds**: Fixed `autoHide` edge detection in Extend mode to check cursor bounds per-monitor rather than globally.

## 1.3.0

Multi-monitor rendering fix, native-first icon philosophy, and refined dock UI:

- **Multi-Monitor Rendering & Hotplug Fix**:
  - Defaulted `displayMode` to `"all"` (with automatic v3→v4 migration when hiding the Windows taskbar) so extended monitors never show a blank taskbar space.
  - Fixed secondary monitor WebView2 rendering by calling `window.show()` (`ICoreWebView2Controller::put_IsVisible(TRUE)`) before atomic Win32 `SetWindowPos` placement.
  - Added per-monitor screen/DPI metric events (`monitor`), per-monitor borderless-fullscreen detection, and automatic monitor hotplug/resolution/arrangement change detection in the background loop.
  - Guarded Welcome and Settings modals to open only on the primary dock instance.
- **Native-First Icon System**:
  - Prioritized authentic extracted Windows application icons (including 96×96 `.lnk` `GetIconLocation` extraction) instead of overwriting recognizable app branding with generic macOS icons.
  - Replaced legacy macOS icon packs with four cohesive Windocker styles: **Windocker** (default), **Squircle Frame**, **Dark Frame**, and **Original**.
  - Reserved custom Windocker vector icons for shell utilities lacking native `.exe` icons (Launcher, Trash, Folders, Settings).
- **Refined Dock UI & Window Controls**:
  - Added active/focused window indicator (`foregroundHwnd`) with an accent glow pill under the currently active app, distinct from background running dots.
  - Added purpose-built Minimize and Close icon controls in the live DWM window preview card and multi-window switcher.
  - Added clean horizontal overflow scrolling in the app dock for large numbers of pinned/running apps.

## 1.2.0

Multi-Monitor & Window Engine update, plus non-blocking async architecture:

- **Non-Blocking Async Architecture**: Moved blocking Windows API, Wi-Fi/Bluetooth, brightness, wallpaper, and app-launch commands off the main UI thread (`spawn_blocking`), dispatched background placement onto the main thread (`run_on_main_thread`), and fixed quit/teardown so Windocker never triggers Windows "Not Responding" Ghost Windows.
- **Per-Monitor Dock Instances (`All Monitors`)**: Added **All Monitors** mode in System Settings → Dock & Taskbar to spawn an independent synchronized dock on every connected display.
- **DWM Live Window Thumbnail Previews**: Hovering any running app icon displays a live hardware-accelerated DWM thumbnail preview card with window title, multi-window switcher tabs, click-to-focus, and quick close.
- **Middle-Click Close & Shift+Click New Instance**: Middle-click any running app icon on the dock to close its window; Shift+click any pinned or running app to launch a new instance.

## 1.1.1

Quality-of-life, multi-monitor, icon accuracy, and stability hotfix for 1.1.0:

- **Taskbar Hidden by Default**: Sets `taskbarMode` to `"hidden"` (with automatic migration from 1.1.0) and polls to re-hide `Shell_TrayWnd` and `Shell_SecondaryTrayWnd` so Windows 11 Extend-mode taskbars stay hidden.
- **Hover Tooltips & Bottom Spacing**: Expanded transparent stage headroom so magnified hover app labels are never clipped, and reduced bottom edge padding so the dock sits closer to the screen edge.
- **Icon Deduplication & Accuracy**: Fixed duplicate File Explorer pins, stopped `opencode.exe` from matching VS Code, added a dedicated **Telegram** squircle icon, and updated the Launchpad icon to a macOS-squircle Windows 11 emblem.
- **Wi-Fi & Bluetooth Device Pickers**: Split Control Center Wi-Fi and Bluetooth pills so clicking the chevron opens a device/network list with radio toggle, Wi-Fi network connect, Bluetooth paired/connected status, and Windows Settings shortcut.
- **Smooth Launchpad & Clean Quit**: Fixed Launchpad search height to prevent flicker, replaced separate size/position calls with atomic Win32 `SetWindowPos` (eliminating mid-screen jumps on launch), and hid the window + stopped background polling on exit to prevent "Not Responding" white frames.

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
