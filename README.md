# Windocker

Windocker is a macOS-inspired dock for Windows 10 and Windows 11. It sits on the top or bottom edge of the screen, launches and switches apps, and shows live tiles for the things you actually use. It runs locally. There is no Windocker account and no Windocker server.

## Install

Download the installer or the portable program from the [1.1.0 release](https://github.com/temidayoxyz/windocker/releases/tag/v1.1.0). The portable program uses the same settings as an installed copy and needs WebView2, which Windows 11 already has.

The installer is a normal Windows setup program. You do not need Rust, Node.js, or any other developer tool.

1. Run `Windocker_1.1.0_x64-setup.exe`.
2. Launch Windocker. A short welcome card asks what to do with the Windows taskbar.
3. Choose **Auto-hide taskbar**, **Hide taskbar**, or **Leave taskbar**, then press **Start**.

Windows 11 already includes the WebView2 runtime. On Windows 10, the installer can download it if it is missing.

A portable copy is the release `Windocker.exe` next to the installer output. It still needs WebView2, and it uses the same settings folder as the installed app.

## Use the dock

Right-click the bar for Widgets, Settings, moving the dock, and Quit.

- Click a pinned app to launch it. Click it again to switch to it, or to minimize it if it is already in front.
- If an app has several windows, the click opens the list.
- Right-click a pin to unpin it, group it with the next pin, close a window, or end the task. Windocker will not end Explorer or itself.
- Drag a pin sideways to reorder it.
- Drop an `.exe` or a Start menu shortcut onto the dock to pin it.
- Scroll the volume tile to change the output volume. Click it to mute.
- Click the microphone tile to mute the mic.
- Open a tile for the larger card: weather city, timer, tasks, notes, calendar, GitHub, and the rest.

## Settings

Settings covers appearance, size, spacing, padding, distance from the screen edge, top or bottom, pill or full width, taskbar behavior, which display the dock uses, auto-hide, magnification, the 24-hour clock, and launch at startup.

Styles:

- **glass**, **ios**, and **midnight** use Windows acrylic blur behind the bar.
- **black** and **white** are solid.
- **clear** removes the bar so the tiles sit on the desktop.

The dock follows the primary display, or the display under the pointer when Displays is set to follow. It is one dock, not a separate dock on every monitor at the same time.

Auto-hide collapses the window to a thin strip until the pointer reaches that edge.

While a borderless fullscreen app or game covers the display, Windocker hides and stops the regular updates. Maximized windows with a title bar are left alone.

## Widgets

Every included tile reads something real. If a source is missing, the tile says so.

| Area | Tiles |
| --- | --- |
| Apps | Apps, Search, Commands, Recycle Bin, Storage |
| System | CPU, Memory, Network, Top apps, Battery, Brightness, Quick toggles |
| Media | Volume, Microphone, Now playing |
| Clocks | Clock, Date, World clocks, Day progress |
| Productivity | Timer, Stopwatch, Focus, To-dos, Notes, Calendar, Screen Time |
| Weather | Current conditions, the next hours, and the day ahead, from Open-Meteo |
| Developer | GitHub contributions, with a personal access token stored only on this PC |
| Finance | Currency conversion from the Frankfurter ECB feed |

Quick toggles cover Wi-Fi, Bluetooth, the Windows light and dark theme, notification toasts, show desktop, the touch keyboard, and a screenshot saved under `Pictures\Windocker`.

Calendar can take an `https` iCal link. Screen Time counts the foreground app on this PC and ignores idle time after five minutes.

## Where settings live

Settings, notes, tasks, and tokens are in `%APPDATA%\com.windocker.app\config.json`. A startup and error log is `windocker.log` in that same folder. If the config file cannot be read, Windocker keeps a `config.json.bak` and starts from the defaults.

Quit from the tray icon, the dock menu, or Settings. Quitting puts the taskbar back.

## If the taskbar stays hidden

That can happen if Windocker is killed while the taskbar is hidden, before it can restore it. Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restore-taskbar.ps1
```

That restarts Explorer. Your windows stay open. You can also launch Windocker and set the taskbar to **Leave taskbar**.

## Updates

There is no update server. Install a newer setup program over this one. Settings stay in your AppData folder.

## Build

You need the MSVC Rust toolchain, Node.js, and the WebView2 runtime.

```powershell
npm install
npm run tauri dev
npm run tauri build
```

The installer is written to `src-tauri\target\release\bundle\nsis\Windocker_1.1.0_x64-setup.exe`. The portable executable is `src-tauri\target\release\Windocker.exe`. Attach both files to the GitHub release instead of committing them.

Release builds use thin LTO, `opt-level = s`, and stripped symbols.

## What this version does not do

These are left out on purpose, rather than shown as if they worked.

- Live desktop refraction. Glass styles use the Windows acrylic blur.
- A dock pinned to every monitor at the same time.
- Full Windows jump lists.
- A per-app volume mixer.
- Hosting icons from the system tray inside the dock. Windows does not provide a supported API for that.
- Accounts and statistics for Stripe, Shopify, and social networks.
- A signed auto-update feed.
- Changing Windows system files. Taskbar changes are the normal auto-hide setting, or hiding the taskbar window until Windocker quits.

Brightness only changes when the display exposes a Windows brightness control. External monitors often do not. Wi-Fi and Bluetooth use the Windows radio API and open Settings if that radio cannot be switched from an app.

## Performance

On this PC (12 logical processors, 125% display scaling), the release build used about **0.16% of total CPU** and **58 MB** of working set over a 15 second sample while the welcome card was open and the default tiles were updating about once a second. Private memory was about **19 MB**. A debug build on the same machine was about 0.2% and 62 MB. That is one sample, not a promise for every PC. Widgets that are not on the dock are not polled, and a borderless fullscreen app pauses the regular updates.
