mod apps;
mod config;
mod model;
mod services;
mod shell;
mod system;

use chrono::Timelike;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_autostart::ManagerExt;

use crate::config::Store;
use crate::model::{
    AiProviderStat, AppEntry, CalEvent, Config, CurrencyNow, GithubNow, Patch, RoundRect,
    Snapshot, WallpaperItem, WeatherNow, Widget,
};
use crate::shell::TaskbarMode;

struct ScreenDay {
    day: String,
    total: u64,
    hours: Vec<u64>,
    apps: HashMap<String, u64>,
    path: std::path::PathBuf,
}

struct Remote {
    weather: Option<WeatherNow>,
    weather_at: Option<Instant>,
    weather_query: String,
    github: Option<GithubNow>,
    github_at: Option<Instant>,
    github_token: String,
    currency: Option<CurrencyNow>,
    currency_at: Option<Instant>,
    currency_key: String,
    ai_usage: Vec<AiProviderStat>,
    ai_at: Option<Instant>,
    events: Vec<CalEvent>,
    events_at: Option<Instant>,
    ical_url: String,
    wallpaper_path: String,
    wallpaper_thumb: Option<String>,
    paused_events: HashSet<String>,
}

struct Placement {
    css_w: f64,
    css_h: f64,
    collapsed: bool,
    fullscreen: bool,
    scale: f64,
    screen_w: f64,
    screen_h: f64,
}

struct Core {
    store: Store,
    catalog: Mutex<Vec<AppEntry>>,
    preview: Mutex<Option<isize>>,
    screen: Mutex<ScreenDay>,
    remote: Mutex<Remote>,
    placement: Mutex<Placement>,
    running: AtomicBool,
}

fn log_line(dir: &std::path::Path, message: &str) {
    let line = format!(
        "{} {message}\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
    );
    let path = dir.join("windocker.log");
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        use std::io::Write;
        let _ = file.write_all(line.as_bytes());
    }
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

impl ScreenDay {
    fn load(dir: &std::path::Path) -> Self {
        let path = dir.join("screen-time.json");
        let day = today();
        let mut hours = vec![0u64; 24];
        let mut apps = HashMap::new();
        let mut total = 0u64;
        if let Ok(text) = std::fs::read_to_string(&path) {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                if value["day"].as_str() == Some(&day) {
                    total = value["total"].as_u64().unwrap_or(0);
                    if let Some(list) = value["hours"].as_array() {
                        for (index, item) in list.iter().take(24).enumerate() {
                            hours[index] = item.as_u64().unwrap_or(0);
                        }
                    }
                    if let Some(map) = value["apps"].as_object() {
                        for (key, item) in map {
                            apps.insert(key.clone(), item.as_u64().unwrap_or(0));
                        }
                    }
                }
            }
        }
        Self {
            day,
            total,
            hours,
            apps,
            path,
        }
    }

    fn roll(&mut self) {
        let day = today();
        if day != self.day {
            self.day = day;
            self.total = 0;
            self.hours = vec![0; 24];
            self.apps.clear();
        }
    }

    fn add(&mut self, name: &str, seconds: u64) {
        self.roll();
        self.total += seconds;
        let hour = chrono::Local::now().hour() as usize;
        if hour < 24 {
            self.hours[hour] += seconds;
        }
        *self.apps.entry(name.to_string()).or_insert(0) += seconds;
    }

    fn save(&self) {
        let value = serde_json::json!({
            "day": self.day,
            "total": self.total,
            "hours": self.hours,
            "apps": self.apps,
        });
        let _ = std::fs::write(&self.path, value.to_string());
    }
}

fn idle_too_long() -> bool {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if !GetLastInputInfo(&mut info).as_bool() {
            return false;
        }
        GetTickCount().wrapping_sub(info.dwTime) > 5 * 60 * 1000
    }
}

fn hwnd_of(window: &WebviewWindow) -> Option<windows::Win32::Foundation::HWND> {
    let raw = window.hwnd().ok()?;
    Some(windows::Win32::Foundation::HWND(raw.0))
}

fn monitor_box(
    window: &WebviewWindow,
    follow: bool,
) -> Option<(i32, i32, i32, i32, i32, i32, f64)> {
    let (cx, cy) = shell::cursor_pos();
    let monitors = window.available_monitors().ok()?;
    let primary = window.primary_monitor().ok().flatten();
    let chosen = if follow {
        monitors.iter().find(|m| {
            let p = m.position();
            let s = m.size();
            cx >= p.x && cy >= p.y && cx < p.x + s.width as i32 && cy < p.y + s.height as i32
        })
    } else {
        None
    };
    let monitor = chosen.or(primary.as_ref()).or(monitors.first())?;
    let pos = monitor.position();
    let size = monitor.size();
    let work = monitor.work_area();
    Some((
        pos.x,
        pos.y,
        size.width as i32,
        size.height as i32,
        work.position.x,
        work.size.height as i32,
        monitor.scale_factor(),
    ))
}

fn apply_visuals(core: &Core, window: &WebviewWindow) {
    let Some(hwnd) = hwnd_of(window) else {
        return;
    };
    let cfg = core.store.snapshot_config();
    let glass = matches!(
        cfg.style.as_str(),
        "liquid-glass" | "glass" | "ios" | "midnight"
    );
    let dark = !matches!(cfg.style.as_str(), "ios" | "white");
    shell::set_acrylic(hwnd, cfg.native_blur && glass, dark);
    if !cfg.native_blur {
        shell::set_round_regions(hwnd, &[]);
    }
    shell::apply_taskbar(TaskbarMode::parse(&cfg.taskbar_mode));
}

fn place(core: &Core, window: &WebviewWindow) {
    let cfg = core.store.snapshot_config();
    let mut placement = core.placement.lock().unwrap_or_else(|e| e.into_inner());
    let Some((mx, my, mw, mh, _wx, work_h, scale)) =
        monitor_box(window, cfg.display_mode == "follow")
    else {
        return;
    };
    placement.scale = scale;
    placement.screen_w = mw as f64 / scale;
    placement.screen_h = mh as f64 / scale;
    if placement.fullscreen {
        let _ = window.hide();
        return;
    }
    let _ = window.show();
    let width = ((placement.css_w * scale).round() as i32).clamp(80, mw);
    let height = ((placement.css_h * scale).round() as i32).clamp(36, mh);
    let edge = cfg.edge_distance as f64 * scale;
    let x = mx + ((mw - width) / 2);
    let mut y = if cfg.edge == "top" {
        my + edge as i32
    } else if cfg.taskbar_mode == "untouched" {
        let work_bottom = my + work_h;
        work_bottom - height - edge as i32
    } else {
        my + mh - height - edge as i32
    };
    if cfg.auto_hide && placement.collapsed {
        y = if cfg.edge == "top" {
            my - height + 4
        } else {
            my + mh - 4
        };
    }
    let _ = window.set_size(tauri::PhysicalSize::new(width as u32, height as u32));
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("Windocker"));
            let store = Store::open(dir.clone());
            if store.snapshot_config().weather_query.is_empty() {
                let guess = services::default_city_for_timezone();
                if !guess.is_empty() {
                    store.with_mut(|cfg| cfg.weather_query = guess);
                }
            }
            let screen = ScreenDay::load(&dir);
            log_line(&dir, "Windocker started");
            let core = Arc::new(Core {
                store,
                catalog: Mutex::new(Vec::new()),
                preview: Mutex::new(None),
                screen: Mutex::new(screen),
                remote: Mutex::new(Remote {
                    weather: None,
                    weather_at: None,
                    weather_query: String::new(),
                    github: None,
                    github_at: None,
                    github_token: String::new(),
                    currency: None,
                    currency_at: None,
                    currency_key: String::new(),
                    ai_usage: Vec::new(),
                    ai_at: None,
                    events: Vec::new(),
                    events_at: None,
                    ical_url: String::new(),
                    wallpaper_path: String::new(),
                    wallpaper_thumb: None,
                    paused_events: HashSet::new(),
                }),
                placement: Mutex::new(Placement {
                    css_w: 960.0,
                    css_h: 112.0,
                    collapsed: false,
                    fullscreen: false,
                    scale: 1.0,
                    screen_w: 1280.0,
                    screen_h: 720.0,
                }),
                running: AtomicBool::new(true),
            });
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
                apply_visuals(&core, &window);
                place(&core, &window);
            }
            let fallback_icon = [10u8, 132, 255, 255].repeat(16 * 16);
            let tray_icon = app
                .default_window_icon()
                .cloned()
                .unwrap_or_else(|| tauri::image::Image::new(&fallback_icon, 16, 16));
            let show =
                tauri::menu::MenuItem::with_id(app, "show", "Show dock", true, None::<&str>)?;
            let settings = tauri::menu::MenuItem::with_id(
                app,
                "settings",
                "Settings",
                true,
                None::<&str>,
            )?;
            let quit = tauri::menu::MenuItem::with_id(
                app,
                "quit",
                "Quit Windocker",
                true,
                None::<&str>,
            )?;
            let menu = tauri::menu::Menu::with_items(app, &[&show, &settings, &quit])?;
            let _ = tauri::tray::TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("Windocker")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                        }
                    }
                    "settings" => {
                        let _ = app.emit("open-settings", ());
                    }
                    "quit" => {
                        shell::restore_taskbar();
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            if core.store.snapshot_config().launch_at_startup {
                let _ = app.autolaunch().enable();
            }
            let scan_handle = app.handle().clone();
            let scan_core = core.clone();
            std::thread::spawn(move || {
                let apps = apps::scan_apps();
                let empty = scan_core.store.snapshot_config().pins.is_empty();
                if empty {
                    let pins = apps::suggest_pins(&apps);
                    scan_core.store.with_mut(|cfg| {
                        cfg.pins = pins
                            .into_iter()
                            .map(|id| model::Pin::App { id })
                            .collect();
                    });
                    let _ = scan_handle.emit("config", scan_core.store.snapshot_config());
                }
                *scan_core.catalog.lock().unwrap_or_else(|e| e.into_inner()) = apps;
                let _ = scan_handle.emit("catalog", catalog_payload(&scan_core));
            });
            let poll_handle = app.handle().clone();
            let poll_core = core.clone();
            std::thread::spawn(move || poll(poll_handle, poll_core));
            app.manage(core);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            patch_config,
            fit_window,
            set_regions,
            add_widget,
            remove_widget,
            reorder_widgets,
            set_widget_settings,
            pin_app,
            pin_exe,
            pin_drop,
            unpin_app,
            reorder_pins,
            group_apps,
            rename_group,
            launch_app,
            activate_window,
            close_window,
            end_task,
            set_volume,
            toggle_mute,
            toggle_mic,
            media,
            set_brightness,
            toggle_radio,
            toggle_theme,
            toggle_toasts,
            empty_recycle,
            search,
            screenshot,
            open_screenshots,
            show_desktop,
            lock_screen,
            open_task_manager,
            open_keyboard,
            open_start,
            list_wallpapers,
            set_wallpaper,
            add_todo,
            toggle_todo,
            delete_todo,
            save_note,
            delete_note,
            add_event,
            delete_event,
            chime,
            quit,
            preview_window,
            clear_preview
        ])
        .build(tauri::generate_context!())
        .expect("Windocker failed to start")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                shell::restore_taskbar();
            }
        });
}

fn catalog_payload(core: &Core) -> Vec<AppEntry> {
    core.catalog.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

fn kinds(cfg: &Config) -> Vec<String> {
    cfg.widgets.iter().map(|w| w.kind.clone()).collect()
}

fn has(kinds: &[String], kind: &str) -> bool {
    kinds.iter().any(|item| item == kind)
}

fn poll(app: AppHandle, core: Arc<Core>) {
    unsafe {
        let _ = windows::Win32::System::WinRT::RoInitialize(
            windows::Win32::System::WinRT::RO_INIT_MULTITHREADED,
        );
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_MULTITHREADED,
        );
    }
    let mut metrics = system::Metrics::new();
    let mut audio = shell::Audio::open().ok();
    let mut tick: u32 = 0;
    let mut screen_accum = 0u64;
    while core.running.load(Ordering::Relaxed) {
        tick = tick.wrapping_add(1);
        let cfg = core.store.snapshot_config();
        let window = app.get_webview_window("main");
        let our = window.as_ref().and_then(hwnd_of);
        let fullscreen = our
            .map(|hwnd| shell::foreground_is_borderless_fullscreen(hwnd))
            .unwrap_or(false);
        {
            let mut placement = core.placement.lock().unwrap_or_else(|e| e.into_inner());
            let was = placement.fullscreen;
            placement.fullscreen = fullscreen;
            if cfg.auto_hide && !fullscreen {
                if let Some(hwnd) = our {
                    let (cx, cy) = shell::cursor_pos();
                    unsafe {
                        let mut rect = windows::Win32::Foundation::RECT::default();
                        let _ =
                            windows::Win32::UI::WindowsAndMessaging::GetWindowRect(hwnd, &mut rect);
                        let near_edge = if cfg.edge == "top" {
                            cy <= rect.bottom + 8
                        } else {
                            cy >= rect.top - 8
                        };
                        let over = cx >= rect.left - 8
                            && cx <= rect.right + 8
                            && cy >= rect.top - 12
                            && cy <= rect.bottom + 12;
                        placement.collapsed = !(near_edge || over);
                    }
                }
            } else if !cfg.auto_hide {
                placement.collapsed = false;
            }
            let changed = was != placement.fullscreen || cfg.auto_hide;
            drop(placement);
            if changed {
                if let Some(window) = &window {
                    place(&core, window);
                }
            }
        }
        if tick % 12 == 0 && !fullscreen {
            refresh_remote(&core, &cfg);
            if screen_accum >= 30 {
                core.screen.lock().unwrap_or_else(|e| e.into_inner()).save();
                screen_accum = 0;
            }
        }
        if tick % 5 == 0 && !fullscreen {
            if let Some(name) = apps::foreground_app() {
                if !idle_too_long() {
                    core.screen
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .add(&name, 1);
                    screen_accum += 1;
                }
            }
            if cfg.auto_pause_meeting {
                check_meeting_auto_pause(&core, &cfg);
            }
        }
        if tick % 5 == 0 && !fullscreen {
            if let Some(window) = &window {
                if audio.is_none() {
                    audio = shell::Audio::open().ok();
                }
                let snap = build_snapshot(&core, &mut metrics, &cfg, audio.as_ref());
                let _ = window.emit("snapshot", snap);
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

fn check_meeting_auto_pause(core: &Core, cfg: &Config) {
    let now = now_ms();
    let mut remote = core.remote.lock().unwrap_or_else(|e| e.into_inner());
    let trigger_id = cfg
        .events
        .iter()
        .chain(remote.events.iter())
        .find(|ev| {
            ev.start_ms <= now
                && ev.start_ms + 15_000 >= now
                && !remote.paused_events.contains(&ev.id)
        })
        .map(|ev| ev.id.clone());
    if let Some(id) = trigger_id {
        remote.paused_events.insert(id);
        let _ = system::media_command("pause");
    }
}

fn refresh_remote(core: &Core, cfg: &Config) {
    let mut remote = core.remote.lock().unwrap_or_else(|e| e.into_inner());
    let stale = |stamp: Option<Instant>, secs: u64| {
        stamp.map(|t| t.elapsed().as_secs() > secs).unwrap_or(true)
    };
    if (stale(remote.weather_at, 15 * 60) || remote.weather_query != cfg.weather_query)
        && !cfg.weather_query.is_empty()
    {
        remote.weather = Some(services::weather(&cfg.weather_query));
        remote.weather_at = Some(Instant::now());
        remote.weather_query = cfg.weather_query.clone();
    }
    if stale(remote.github_at, 15 * 60) || remote.github_token != cfg.github_token {
        remote.github = Some(services::github(&cfg.github_token));
        remote.github_at = Some(Instant::now());
        remote.github_token = cfg.github_token.clone();
    }
    let currency_key = format!(
        "{}:{}:{}",
        cfg.currency_from, cfg.currency_to, cfg.currency_amount
    );
    if stale(remote.currency_at, 30 * 60) || remote.currency_key != currency_key {
        remote.currency = Some(services::currency(
            &cfg.currency_from,
            &cfg.currency_to,
            cfg.currency_amount,
        ));
        remote.currency_at = Some(Instant::now());
        remote.currency_key = currency_key;
    }
    if stale(remote.events_at, 15 * 60) || remote.ical_url != cfg.ical_url {
        remote.events = services::ical(&cfg.ical_url);
        remote.events_at = Some(Instant::now());
        remote.ical_url = cfg.ical_url.clone();
    }
    let active = kinds(cfg);
    if has(&active, "ai-limits") && stale(remote.ai_at, 60) {
        remote.ai_usage = services::ai_usage_stats(&cfg.deepseek_key);
        remote.ai_at = Some(Instant::now());
    }
    if has(&active, "wallpaper") {
        if let Some(wp) = shell::current_wallpaper_path() {
            if wp != remote.wallpaper_path {
                remote.wallpaper_thumb = shell::thumbnail_data_url(&wp, 72);
                remote.wallpaper_path = wp;
            }
        }
    }
}

fn build_snapshot(
    core: &Core,
    metrics: &mut system::Metrics,
    cfg: &Config,
    audio: Option<&shell::Audio>,
) -> Snapshot {
    let active = kinds(cfg);
    let want_proc = has(&active, "top");
    let (cpu, ram_used, ram_total, down, up, self_cpu, self_mem, top_cpu, top_ram) =
        metrics.refresh(want_proc);
    let (battery_pct, battery_charging, on_ac) = shell::battery();
    let (volume, muted, mic_muted, audio_device) = if let Some(audio) = audio {
        (
            audio.volume(),
            audio.muted(),
            audio.mic_muted(),
            audio.device_name().to_string(),
        )
    } else {
        (0.0, false, false, "Speakers".to_string())
    };
    let (wifi_on, bluetooth_on) = if has(&active, "quick") {
        system::radios()
    } else {
        (None, None)
    };
    let brightness = if has(&active, "brightness") {
        system::brightness()
    } else {
        None
    };
    let media = if has(&active, "now-playing") {
        system::media()
    } else {
        None
    };
    let disks = if has(&active, "storage") {
        metrics.disk_stats()
    } else {
        Vec::new()
    };
    let (recycle_count, recycle_bytes) = if has(&active, "recycle") {
        shell::recycle()
    } else {
        (0, 0)
    };
    let running = if has(&active, "apps") || has(&active, "launchpad") {
        apps::running_windows()
    } else {
        Vec::new()
    };
    let screen = core.screen.lock().unwrap_or_else(|e| e.into_inner());
    let mut screen_apps: Vec<_> = screen
        .apps
        .iter()
        .map(|(name, seconds)| model::AppTime {
            name: name.clone(),
            seconds: *seconds,
        })
        .collect();
    screen_apps.sort_by(|a, b| b.seconds.cmp(&a.seconds));
    screen_apps.truncate(8);
    let remote = core.remote.lock().unwrap_or_else(|e| e.into_inner());
    let placement = core.placement.lock().unwrap_or_else(|e| e.into_inner());
    Snapshot {
        now_ms: now_ms(),
        cpu,
        ram_used,
        ram_total,
        net_down: down,
        net_up: up,
        battery_pct,
        battery_charging,
        on_ac,
        volume,
        muted,
        mic_muted,
        audio_device,
        wifi_on,
        bluetooth_on,
        brightness,
        toasts_enabled: shell::toasts_enabled(),
        light_theme: shell::light_theme(),
        wallpaper_thumb: remote.wallpaper_thumb.clone(),
        running,
        media,
        disks,
        top_cpu,
        top_ram,
        recycle_count,
        recycle_bytes,
        screen_today_sec: screen.total,
        screen_hours: screen.hours.clone(),
        screen_apps,
        clocks: if has(&active, "world-clock") {
            services::city_clocks(&cfg.world_cities)
                .into_iter()
                .map(|(label, time, offset)| model::CityClock {
                    label,
                    time,
                    offset,
                })
                .collect()
        } else {
            Vec::new()
        },
        weather: remote.weather.clone(),
        github: remote.github.clone(),
        currency: remote.currency.clone(),
        ai_usage: remote.ai_usage.clone(),
        remote_events: remote.events.clone(),
        self_cpu,
        self_mem,
        fullscreen: placement.fullscreen,
        screen_css_width: placement.screen_w,
        screen_css_height: placement.screen_h,
        monitor_scale: placement.scale,
    }
}

fn find_app(core: &Core, id: &str) -> Option<AppEntry> {
    core.catalog
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .find(|a| a.id == id)
        .cloned()
}

#[tauri::command]
fn bootstrap(core: State<Arc<Core>>) -> serde_json::Value {
    serde_json::json!({
        "config": core.store.snapshot_config(),
        "catalog": catalog_payload(&core),
    })
}

#[tauri::command]
fn patch_config(app: AppHandle, core: State<Arc<Core>>, patch: Patch) -> Config {
    let startup = patch.launch_at_startup;
    let cfg = core.store.apply_patch(patch);
    if let Some(enabled) = startup {
        let auto = app.autolaunch();
        if enabled {
            let _ = auto.enable();
        } else {
            let _ = auto.disable();
        }
    }
    if let Some(window) = app.get_webview_window("main") {
        apply_visuals(&core, &window);
        place(&core, &window);
    }
    cfg
}

#[tauri::command]
fn fit_window(app: AppHandle, core: State<Arc<Core>>, width: f64, height: f64) {
    {
        let mut placement = core.placement.lock().unwrap_or_else(|e| e.into_inner());
        let next_w = width.clamp(40.0, 4000.0);
        let next_h = height.clamp(24.0, 1200.0);
        if (next_w - placement.css_w).abs() < 4.0 && (next_h - placement.css_h).abs() < 4.0 {
            return;
        }
        placement.css_w = next_w;
        placement.css_h = next_h;
    }
    if let Some(window) = app.get_webview_window("main") {
        place(&core, &window);
    }
}

#[tauri::command]
fn set_regions(app: AppHandle, core: State<Arc<Core>>, rects: Vec<RoundRect>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Some(hwnd) = hwnd_of(&window) else { return };
    if !core.store.snapshot_config().native_blur {
        shell::set_round_regions(hwnd, &[]);
        return;
    }
    let scale = core.placement.lock().unwrap_or_else(|e| e.into_inner()).scale;
    let mapped: Vec<(i32, i32, i32, i32, i32)> = rects
        .into_iter()
        .map(|r| {
            (
                (r.x * scale) as i32,
                (r.y * scale) as i32,
                (r.w * scale) as i32,
                (r.h * scale) as i32,
                (r.r * scale) as i32,
            )
        })
        .collect();
    shell::set_round_regions(hwnd, &mapped);
}

#[tauri::command]
fn add_widget(core: State<Arc<Core>>, kind: String) -> Result<Config, String> {
    let known = [
        "apps",
        "launchpad",
        "cpu",
        "ram",
        "system-rings",
        "network",
        "battery",
        "volume",
        "mic",
        "now-playing",
        "brightness",
        "quick",
        "clock",
        "flip-clock",
        "analog-clock",
        "today",
        "world-clock",
        "date",
        "timer",
        "stopwatch",
        "pomodoro",
        "notes",
        "todos",
        "calendar",
        "screen-time",
        "weather",
        "weather-details",
        "recycle",
        "search",
        "commands",
        "storage",
        "github",
        "currency",
        "ai-limits",
        "screenshot",
        "wallpaper",
        "top",
        "day-progress",
        "spacer",
    ];
    if !known.contains(&kind.as_str()) {
        return Err("Unknown widget.".into());
    }
    Ok(core.store.with_mut(|cfg| {
        cfg.widgets.push(Widget {
            id: config::new_id("w"),
            kind,
            settings: serde_json::json!({}),
        });
        cfg.clone()
    }))
}

#[tauri::command]
fn remove_widget(core: State<Arc<Core>>, id: String) -> Config {
    core.store.with_mut(|cfg| {
        cfg.widgets.retain(|w| w.id != id);
        cfg.clone()
    })
}

#[tauri::command]
fn reorder_widgets(core: State<Arc<Core>>, ids: Vec<String>) -> Config {
    core.store.with_mut(|cfg| {
        let mut next = Vec::new();
        for id in ids {
            if let Some(index) = cfg.widgets.iter().position(|w| w.id == id) {
                next.push(cfg.widgets[index].clone());
            }
        }
        for widget in &cfg.widgets {
            if !next.iter().any(|w| w.id == widget.id) {
                next.push(widget.clone());
            }
        }
        cfg.widgets = next;
        cfg.clone()
    })
}

#[tauri::command]
fn set_widget_settings(
    core: State<Arc<Core>>,
    id: String,
    settings: serde_json::Value,
) -> Config {
    core.store.with_mut(|cfg| {
        if let Some(widget) = cfg.widgets.iter_mut().find(|w| w.id == id) {
            widget.settings = settings;
        }
        cfg.clone()
    })
}

#[tauri::command]
fn pin_drop(core: State<Arc<Core>>, path: String) -> Result<Config, String> {
    let entry = apps::entry_from_dropped(&path)?;
    {
        let mut catalog = core.catalog.lock().unwrap_or_else(|e| e.into_inner());
        if !catalog.iter().any(|app| app.id == entry.id) {
            catalog.push(entry.clone());
        }
    }
    Ok(core.store.with_mut(|cfg| {
        if !cfg
            .pins
            .iter()
            .any(|pin| matches!(pin, model::Pin::App { id } if id == &entry.id))
        {
            cfg.pins.push(model::Pin::App { id: entry.id });
        }
        cfg.clone()
    }))
}

#[tauri::command]
fn pin_exe(core: State<Arc<Core>>, path: String) -> Result<Config, String> {
    pin_drop(core, path)
}

#[tauri::command]
fn pin_app(core: State<Arc<Core>>, id: String) -> Config {
    core.store.with_mut(|cfg| {
        if !cfg
            .pins
            .iter()
            .any(|p| matches!(p, model::Pin::App { id: existing } if existing == &id))
        {
            cfg.pins.push(model::Pin::App { id });
        }
        cfg.clone()
    })
}

#[tauri::command]
fn unpin_app(core: State<Arc<Core>>, id: String) -> Config {
    core.store.with_mut(|cfg| {
        cfg.pins
            .retain(|p| !matches!(p, model::Pin::App { id: existing } if existing == &id));
        cfg.clone()
    })
}

#[tauri::command]
fn reorder_pins(core: State<Arc<Core>>, ids: Vec<String>) -> Config {
    core.store.with_mut(|cfg| {
        let mut next = Vec::new();
        for id in ids {
            if let Some(pin) = cfg
                .pins
                .iter()
                .find(|p| match p {
                    model::Pin::App { id: existing } => existing == &id,
                    model::Pin::Group { id: existing } => existing == &id,
                })
                .cloned()
            {
                next.push(pin);
            }
        }
        cfg.pins = next;
        cfg.clone()
    })
}

#[tauri::command]
fn group_apps(core: State<Arc<Core>>, first: String, second: String) -> Config {
    core.store.with_mut(|cfg| {
        let id = config::new_id("g");
        cfg.groups.push(model::Group {
            id: id.clone(),
            name: "Folder".into(),
            app_ids: vec![first.clone(), second.clone()],
        });
        cfg.pins
            .retain(|p| !matches!(p, model::Pin::App { id } if id == &first || id == &second));
        cfg.pins.push(model::Pin::Group { id });
        cfg.clone()
    })
}

#[tauri::command]
fn rename_group(core: State<Arc<Core>>, id: String, name: String) -> Config {
    core.store.with_mut(|cfg| {
        if let Some(group) = cfg.groups.iter_mut().find(|g| g.id == id) {
            group.name = name.chars().take(32).collect();
        }
        cfg.clone()
    })
}

#[tauri::command]
fn launch_app(core: State<Arc<Core>>, id: String) -> Result<(), String> {
    let Some(app) = find_app(&core, &id) else {
        return Err("That app is not on this PC.".into());
    };
    apps::launch(&app);
    Ok(())
}

#[tauri::command]
fn activate_window(hwnd: i64) -> Result<(), String> {
    apps::activate(hwnd)
}

#[tauri::command]
fn close_window(hwnd: i64) -> Result<(), String> {
    apps::close_window(hwnd)
}

#[tauri::command]
fn end_task(hwnd: i64) -> Result<(), String> {
    apps::end_task(hwnd)
}

#[tauri::command]
fn set_volume(value: f32) -> Result<(), String> {
    shell::with_audio(|audio| audio.set_volume(value))
}

#[tauri::command]
fn toggle_mute() -> Result<(), String> {
    shell::with_audio(|audio| {
        let muted = audio.muted();
        audio.set_muted(!muted)
    })
}

#[tauri::command]
fn toggle_mic() -> Result<(), String> {
    shell::with_audio(|audio| {
        let muted = audio.mic_muted();
        audio.set_mic_muted(!muted)
    })
}

#[tauri::command]
fn media(command: String) -> Result<(), String> {
    system::media_command(&command)
}

#[tauri::command]
fn set_brightness(value: u32) -> Result<(), String> {
    system::set_brightness(value)
}

#[tauri::command]
fn toggle_radio(kind: String) -> Result<(), String> {
    match system::toggle_radio(&kind) {
        Ok(()) => Ok(()),
        Err(err) => {
            shell::open_url(if kind == "bluetooth" {
                "ms-settings:bluetooth"
            } else {
                "ms-settings:network-wifi"
            });
            Err(err)
        }
    }
}

#[tauri::command]
fn toggle_theme() -> Result<(), String> {
    shell::set_light_theme(!shell::light_theme())
}

#[tauri::command]
fn toggle_toasts() -> Result<(), String> {
    let enabled = shell::toasts_enabled().unwrap_or(true);
    shell::set_toasts_enabled(!enabled)
}

#[tauri::command]
fn empty_recycle() -> Result<(), String> {
    shell::empty_recycle()
}

#[tauri::command]
fn search(query: String) -> Result<(), String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(());
    }
    let path = std::path::Path::new(query);
    if path.exists() {
        shell::open_path(query);
    } else {
        let encoded = query.replace(' ', "+");
        shell::open_url(&format!("https://www.google.com/search?q={encoded}"));
    }
    Ok(())
}

#[tauri::command]
fn screenshot(mode: String) -> Result<String, String> {
    let path = if mode == "window" {
        shell::capture_foreground()?
    } else {
        shell::capture_virtual_screen()?
    };
    Ok(path.display().to_string())
}

#[tauri::command]
fn open_screenshots() -> Result<(), String> {
    shell::open_screenshots_folder()
}

#[tauri::command]
fn show_desktop() {
    shell::show_desktop();
}

#[tauri::command]
fn lock_screen() {
    shell::lock_screen();
}

#[tauri::command]
fn open_task_manager() {
    shell::open_path("taskmgr.exe");
}

#[tauri::command]
fn open_keyboard() {
    shell::open_path("osk.exe");
}

#[tauri::command]
fn open_start() {
    shell::open_start_menu();
}

#[tauri::command]
fn list_wallpapers() -> Vec<WallpaperItem> {
    shell::list_wallpapers()
        .into_iter()
        .filter_map(|(path, name)| {
            shell::thumbnail_data_url(&path, 120).map(|thumb| WallpaperItem { path, name, thumb })
        })
        .collect()
}

#[tauri::command]
fn set_wallpaper(core: State<Arc<Core>>, path: String) -> Result<(), String> {
    shell::set_wallpaper(&path)?;
    let mut remote = core.remote.lock().unwrap_or_else(|e| e.into_inner());
    remote.wallpaper_thumb = shell::thumbnail_data_url(&path, 72);
    remote.wallpaper_path = path;
    Ok(())
}

#[tauri::command]
fn add_todo(core: State<Arc<Core>>, text: String) -> Config {
    core.store.with_mut(|cfg| {
        cfg.todos.insert(
            0,
            model::Todo {
                id: config::new_id("t"),
                text: text.chars().take(200).collect(),
                done: false,
            },
        );
        cfg.clone()
    })
}

#[tauri::command]
fn toggle_todo(core: State<Arc<Core>>, id: String) -> Config {
    core.store.with_mut(|cfg| {
        if let Some(todo) = cfg.todos.iter_mut().find(|t| t.id == id) {
            todo.done = !todo.done;
        }
        cfg.clone()
    })
}

#[tauri::command]
fn delete_todo(core: State<Arc<Core>>, id: String) -> Config {
    core.store.with_mut(|cfg| {
        cfg.todos.retain(|t| t.id != id);
        cfg.clone()
    })
}

#[tauri::command]
fn save_note(core: State<Arc<Core>>, id: String, text: String) -> Config {
    core.store.with_mut(|cfg| {
        if let Some(note) = cfg.notes.iter_mut().find(|n| n.id == id) {
            note.text = text.chars().take(4000).collect();
            note.updated_ms = now_ms();
        } else {
            cfg.notes.insert(
                0,
                model::Note {
                    id: config::new_id("n"),
                    text: text.chars().take(4000).collect(),
                    updated_ms: now_ms(),
                },
            );
        }
        cfg.clone()
    })
}

#[tauri::command]
fn delete_note(core: State<Arc<Core>>, id: String) -> Config {
    core.store.with_mut(|cfg| {
        cfg.notes.retain(|n| n.id != id);
        cfg.clone()
    })
}

#[tauri::command]
fn add_event(core: State<Arc<Core>>, title: String, start_ms: i64, end_ms: i64) -> Config {
    core.store.with_mut(|cfg| {
        cfg.events.push(CalEvent {
            id: config::new_id("e"),
            title: title.chars().take(120).collect(),
            start_ms,
            end_ms: end_ms.max(start_ms),
            source: "local".into(),
        });
        cfg.clone()
    })
}

#[tauri::command]
fn delete_event(core: State<Arc<Core>>, id: String) -> Config {
    core.store.with_mut(|cfg| {
        cfg.events.retain(|e| e.id != id);
        cfg.clone()
    })
}

#[tauri::command]
fn chime() {
    shell::beep();
}

#[tauri::command]
fn quit(app: AppHandle) {
    shell::restore_taskbar();
    app.exit(0);
}

#[tauri::command]
fn preview_window(
    app: AppHandle,
    core: State<Arc<Core>>,
    hwnd: i64,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let Some(dest) = hwnd_of(&window) else {
        return Ok(());
    };
    let scale = core.placement.lock().unwrap_or_else(|e| e.into_inner()).scale;
    clear_preview_inner(&core);
    let rect = windows::Win32::Foundation::RECT {
        left: (x * scale) as i32,
        top: (y * scale) as i32,
        right: ((x + w) * scale) as i32,
        bottom: ((y + h) * scale) as i32,
    };
    let thumb =
        shell::register_preview(dest, windows::Win32::Foundation::HWND(hwnd as *mut _), rect)?;
    *core.preview.lock().unwrap_or_else(|e| e.into_inner()) = Some(thumb);
    Ok(())
}

fn clear_preview_inner(core: &Core) {
    if let Some(value) = core
        .preview
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
    {
        shell::clear_preview(value);
    }
}

#[tauri::command]
fn clear_preview(core: State<Arc<Core>>) {
    clear_preview_inner(&core);
}
