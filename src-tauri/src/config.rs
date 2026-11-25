use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::model::{Config, Patch};

pub struct Store {
    pub path: PathBuf,
    pub config: Mutex<Config>,
}

impl Store {
    pub fn open(dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("config.json");
        let config = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<Config>(&text).ok())
            .unwrap_or_else(|| {
                if path.exists() {
                    let _ = fs::copy(&path, dir.join("config.json.bak"));
                }
                Config::default()
            });
        Self {
            path,
            config: Mutex::new(config),
        }
    }

    pub fn save(&self) {
        let cfg = self.config.lock().unwrap_or_else(|e| e.into_inner()).clone();
        if let Ok(text) = serde_json::to_string_pretty(&cfg) {
            let _ = fs::write(&self.path, text);
        }
    }

    pub fn with_mut<R>(&self, f: impl FnOnce(&mut Config) -> R) -> R {
        let result = {
            let mut cfg = self.config.lock().unwrap_or_else(|e| e.into_inner());
            f(&mut cfg)
        };
        self.save();
        result
    }

    pub fn snapshot_config(&self) -> Config {
        self.config.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    pub fn apply_patch(&self, patch: Patch) -> Config {
        self.with_mut(|cfg| {
            if let Some(v) = patch.style { cfg.style = clean_style(&v); }
            if let Some(v) = patch.accent { if is_hex(&v) { cfg.accent = v; } }
            if let Some(v) = patch.edge { if v == "top" || v == "bottom" { cfg.edge = v; } }
            if let Some(v) = patch.layout { if v == "pill" || v == "full" { cfg.layout = v; } }
            if let Some(v) = patch.scale { cfg.scale = v.clamp(0.75, 1.45); }
            if let Some(v) = patch.spacing { cfg.spacing = v.min(24); }
            if let Some(v) = patch.padding { cfg.padding = v.min(24); }
            if let Some(v) = patch.edge_distance { cfg.edge_distance = v.min(80); }
            if let Some(v) = patch.auto_hide { cfg.auto_hide = v; }
            if let Some(v) = patch.magnification { cfg.magnification = v; }
            if let Some(v) = patch.show_labels { cfg.show_labels = v; }
            if let Some(v) = patch.previews { cfg.previews = v; }
            if let Some(v) = patch.lock_dock { cfg.lock_dock = v; }
            if let Some(v) = patch.taskbar_mode {
                if matches!(v.as_str(), "untouched" | "autohide" | "hidden") {
                    cfg.taskbar_mode = v;
                }
            }
            if let Some(v) = patch.display_mode {
                if v == "primary" || v == "follow" { cfg.display_mode = v; }
            }
            if let Some(v) = patch.clock_24h { cfg.clock_24h = v; }
            if let Some(v) = patch.launch_at_startup { cfg.launch_at_startup = v; }
            if let Some(v) = patch.icon_pack { cfg.icon_pack = clean_icon_pack(&v); }
            if let Some(v) = patch.squircle_wrap { cfg.squircle_wrap = v; }
            if let Some(v) = patch.show_running_apps { cfg.show_running_apps = v; }
            if let Some(v) = patch.dock_divider { cfg.dock_divider = v; }
            if let Some(v) = patch.native_blur { cfg.native_blur = v; }
            if let Some(v) = patch.auto_pause_meeting { cfg.auto_pause_meeting = v; }
            if let Some(v) = patch.custom_icons { cfg.custom_icons = v; }
            if let Some(v) = patch.weather_query { cfg.weather_query = v.chars().take(80).collect(); }
            if let Some(v) = patch.github_token { cfg.github_token = v.trim().to_string(); }
            if let Some(v) = patch.ical_url { cfg.ical_url = sanitize_url(&v); }
            if let Some(v) = patch.deepseek_key { cfg.deepseek_key = v.trim().to_string(); }
            if let Some(v) = patch.currency_from { cfg.currency_from = v.chars().take(6).collect(); }
            if let Some(v) = patch.currency_to { cfg.currency_to = v.chars().take(6).collect(); }
            if let Some(v) = patch.currency_amount { cfg.currency_amount = v.clamp(0.0, 1_000_000_000.0); }
            if let Some(v) = patch.world_cities { cfg.world_cities = v.into_iter().take(4).collect(); }
            if let Some(v) = patch.first_launch_complete { cfg.first_launch_complete = v; }
            if let Some(v) = patch.timer_deadline_ms { cfg.timer_deadline_ms = v; }
            if let Some(v) = patch.timer_paused_ms { cfg.timer_paused_ms = v; }
            if let Some(v) = patch.stopwatch_accum_ms { cfg.stopwatch_accum_ms = v.max(0); }
            if let Some(v) = patch.stopwatch_started_ms { cfg.stopwatch_started_ms = v; }
            if let Some(v) = patch.pomo_deadline_ms { cfg.pomo_deadline_ms = v; }
            if let Some(v) = patch.pomo_phase { if v == "focus" || v == "break" { cfg.pomo_phase = v; } }
            if let Some(v) = patch.pomo_running { cfg.pomo_running = v; }
            if let Some(v) = patch.pomo_focus_min { cfg.pomo_focus_min = v.clamp(1, 180); }
            if let Some(v) = patch.pomo_break_min { cfg.pomo_break_min = v.clamp(1, 60); }
            if let Some(v) = patch.pomo_round { cfg.pomo_round = v.clamp(1, 12); }
            if let Some(v) = patch.pomo_total_rounds { cfg.pomo_total_rounds = v.clamp(1, 12); }
            cfg.clone()
        })
    }
}

fn clean_style(v: &str) -> String {
    match v {
        "liquid-glass" | "glass" | "ios" | "midnight" | "black" | "white" | "clear" => v.to_string(),
        _ => "liquid-glass".into(),
    }
}

fn clean_icon_pack(v: &str) -> String {
    match v {
        "sequoia" | "dark" | "glass" | "native" => v.to_string(),
        _ => "sequoia".into(),
    }
}

fn is_hex(v: &str) -> bool {
    let s = v.strip_prefix('#').unwrap_or(v);
    s.len() == 6 && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn sanitize_url(v: &str) -> String {
    let t = v.trim();
    if t.is_empty() {
        return String::new();
    }
    if t.starts_with("https://") || t.starts_with("http://") {
        t.chars().take(500).collect()
    } else {
        String::new()
    }
}

pub fn new_id(prefix: &str) -> String {
    format!("{prefix}-{}", chrono::Utc::now().timestamp_millis())
}
