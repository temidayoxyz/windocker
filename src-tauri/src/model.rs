use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Widget {
    pub id: String,
    pub kind: String,
    pub settings: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Pin {
    App { id: String },
    Group { id: String },
    Folder { id: String, name: String, path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub name: String,
    pub app_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub text: String,
    pub updated_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalEvent {
    pub id: String,
    pub title: String,
    pub start_ms: i64,
    pub end_ms: i64,
    pub source: String,
}

fn default_icon_pack() -> String { "windocker".into() }
fn default_true() -> bool { true }
fn default_pomo_round() -> u32 { 1 }
fn default_pomo_total_rounds() -> u32 { 4 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub version: u32,
    pub first_launch_complete: bool,
    pub style: String,
    pub accent: String,
    pub edge: String,
    pub layout: String,
    pub scale: f64,
    pub spacing: u32,
    pub padding: u32,
    pub edge_distance: u32,
    pub auto_hide: bool,
    pub magnification: bool,
    pub show_labels: bool,
    pub previews: bool,
    pub lock_dock: bool,
    pub taskbar_mode: String,
    pub display_mode: String,
    pub clock_24h: bool,
    pub launch_at_startup: bool,
    #[serde(default = "default_icon_pack")]
    pub icon_pack: String,
    #[serde(default = "default_true")]
    pub squircle_wrap: bool,
    #[serde(default = "default_true")]
    pub show_running_apps: bool,
    #[serde(default = "default_true")]
    pub dock_divider: bool,
    #[serde(default)]
    pub native_blur: bool,
    #[serde(default)]
    pub auto_pause_meeting: bool,
    #[serde(default)]
    pub custom_icons: HashMap<String, String>,
    pub widgets: Vec<Widget>,
    pub pins: Vec<Pin>,
    pub groups: Vec<Group>,
    pub todos: Vec<Todo>,
    pub notes: Vec<Note>,
    pub events: Vec<CalEvent>,
    pub weather_query: String,
    pub github_token: String,
    pub ical_url: String,
    #[serde(default)]
    pub deepseek_key: String,
    pub currency_from: String,
    pub currency_to: String,
    pub currency_amount: f64,
    pub world_cities: Vec<String>,
    pub timer_deadline_ms: Option<i64>,
    pub timer_paused_ms: Option<i64>,
    pub stopwatch_accum_ms: i64,
    pub stopwatch_started_ms: Option<i64>,
    pub pomo_deadline_ms: Option<i64>,
    pub pomo_phase: String,
    pub pomo_running: bool,
    pub pomo_focus_min: u32,
    pub pomo_break_min: u32,
    #[serde(default = "default_pomo_round")]
    pub pomo_round: u32,
    #[serde(default = "default_pomo_total_rounds")]
    pub pomo_total_rounds: u32,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: 4,
            first_launch_complete: false,
            style: "liquid-glass".into(),
            accent: "#0a84ff".into(),
            edge: "bottom".into(),
            layout: "pill".into(),
            scale: 1.0,
            spacing: 8,
            padding: 7,
            edge_distance: 4,
            auto_hide: false,
            magnification: true,
            show_labels: true,
            previews: true,
            lock_dock: false,
            taskbar_mode: "hidden".into(),
            display_mode: "all".into(),
            clock_24h: false,
            launch_at_startup: false,
            icon_pack: default_icon_pack(),
            squircle_wrap: false,
            show_running_apps: true,
            dock_divider: true,
            native_blur: false,
            auto_pause_meeting: false,
            custom_icons: HashMap::new(),
            widgets: vec![
                Widget { id: "w-quick".into(), kind: "quick".into(), settings: serde_json::json!({}) },
                Widget { id: "w-volume".into(), kind: "volume".into(), settings: serde_json::json!({}) },
                Widget { id: "w-apps".into(), kind: "apps".into(), settings: serde_json::json!({}) },
                Widget { id: "w-rings".into(), kind: "system-rings".into(), settings: serde_json::json!({}) },
                Widget { id: "w-battery".into(), kind: "battery".into(), settings: serde_json::json!({ "style": "wave" }) },
                Widget { id: "w-today".into(), kind: "today".into(), settings: serde_json::json!({}) },
                Widget { id: "w-trash".into(), kind: "recycle".into(), settings: serde_json::json!({}) },
            ],
            pins: Vec::new(),
            groups: Vec::new(),
            todos: Vec::new(),
            notes: vec![Note {
                id: "n1".into(),
                text: String::new(),
                updated_ms: 0,
            }],
            events: Vec::new(),
            weather_query: String::new(),
            github_token: String::new(),
            ical_url: String::new(),
            deepseek_key: String::new(),
            currency_from: "USD".into(),
            currency_to: "EUR".into(),
            currency_amount: 100.0,
            world_cities: vec!["America/New_York".into(), "Europe/London".into(), "Asia/Tokyo".into()],
            timer_deadline_ms: None,
            timer_paused_ms: None,
            stopwatch_accum_ms: 0,
            stopwatch_started_ms: None,
            pomo_deadline_ms: None,
            pomo_phase: "focus".into(),
            pomo_running: false,
            pomo_focus_min: 25,
            pomo_break_min: 5,
            pomo_round: 1,
            pomo_total_rounds: 4,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal: u32,
    pub security: String,
    pub connected: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: i64,
    pub ext: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickPreview {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub size: u64,
    pub content: Option<String>,
    pub child_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BluetoothDevice {
    pub name: String,
    pub address: String,
    pub connected: bool,
    pub paired: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub launch: String,
    pub exe: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningWindow {
    pub hwnd: i64,
    pub exe: String,
    pub title: String,
    pub name: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcStat {
    pub name: String,
    pub value: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskStat {
    pub name: String,
    pub mount: String,
    pub total: u64,
    pub free: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaNow {
    pub title: String,
    pub artist: String,
    pub status: String,
    pub position_sec: f64,
    pub duration_sec: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HourPoint {
    pub label: String,
    pub temp_c: f32,
    pub code: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayPoint {
    pub label: String,
    pub hi: f32,
    pub lo: f32,
    pub code: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherNow {
    pub city: String,
    pub temp_c: f32,
    pub code: i32,
    pub wind: f32,
    pub humidity: f32,
    pub precip: f32,
    pub hi: f32,
    pub lo: f32,
    pub sunrise: String,
    pub sunset: String,
    pub hourly: Vec<HourPoint>,
    pub daily: Vec<DayPoint>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubNow {
    pub login: String,
    pub total: i64,
    pub streak: i64,
    pub cells: Vec<i32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyNow {
    pub from: String,
    pub to: String,
    pub rate: f64,
    pub amount: f64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStat {
    pub id: String,
    pub name: String,
    pub primary_label: String,
    pub primary_pct: f32,
    pub primary_meta: String,
    pub secondary_label: String,
    pub secondary_pct: f32,
    pub secondary_meta: String,
    pub model: String,
    pub detail: String,
    pub connected: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppTime {
    pub name: String,
    pub seconds: u64,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CityClock {
    pub label: String,
    pub time: String,
    pub offset: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperItem {
    pub path: String,
    pub name: String,
    pub thumb: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub now_ms: i64,
    pub cpu: f32,
    pub ram_used: u64,
    pub ram_total: u64,
    pub net_down: u64,
    pub net_up: u64,
    pub battery_pct: Option<u8>,
    pub battery_charging: bool,
    pub on_ac: bool,
    pub volume: f32,
    pub muted: bool,
    pub mic_muted: bool,
    pub audio_device: String,
    pub wifi_on: Option<bool>,
    pub bluetooth_on: Option<bool>,
    pub brightness: Option<u32>,
    pub toasts_enabled: Option<bool>,
    pub light_theme: bool,
    pub wallpaper_thumb: Option<String>,
    pub running: Vec<RunningWindow>,
    pub media: Option<MediaNow>,
    pub disks: Vec<DiskStat>,
    pub top_cpu: Vec<ProcStat>,
    pub top_ram: Vec<ProcStat>,
    pub recycle_count: u64,
    pub recycle_bytes: u64,
    pub screen_today_sec: u64,
    pub screen_hours: Vec<u64>,
    pub screen_apps: Vec<AppTime>,
    pub clocks: Vec<CityClock>,
    pub weather: Option<WeatherNow>,
    pub github: Option<GithubNow>,
    pub currency: Option<CurrencyNow>,
    pub ai_usage: Vec<AiProviderStat>,
    pub remote_events: Vec<CalEvent>,
    pub self_cpu: f32,
    pub self_mem: u64,
    pub foreground_hwnd: i64,
    pub fullscreen: bool,
    pub screen_css_width: f64,
    pub screen_css_height: f64,
    pub monitor_scale: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Patch {
    pub style: Option<String>,
    pub accent: Option<String>,
    pub edge: Option<String>,
    pub layout: Option<String>,
    pub scale: Option<f64>,
    pub spacing: Option<u32>,
    pub padding: Option<u32>,
    pub edge_distance: Option<u32>,
    pub auto_hide: Option<bool>,
    pub magnification: Option<bool>,
    pub show_labels: Option<bool>,
    pub previews: Option<bool>,
    pub lock_dock: Option<bool>,
    pub taskbar_mode: Option<String>,
    pub display_mode: Option<String>,
    pub clock_24h: Option<bool>,
    pub launch_at_startup: Option<bool>,
    pub icon_pack: Option<String>,
    pub squircle_wrap: Option<bool>,
    pub show_running_apps: Option<bool>,
    pub dock_divider: Option<bool>,
    pub native_blur: Option<bool>,
    pub auto_pause_meeting: Option<bool>,
    pub custom_icons: Option<HashMap<String, String>>,
    pub weather_query: Option<String>,
    pub github_token: Option<String>,
    pub ical_url: Option<String>,
    pub deepseek_key: Option<String>,
    pub currency_from: Option<String>,
    pub currency_to: Option<String>,
    pub currency_amount: Option<f64>,
    pub world_cities: Option<Vec<String>>,
    pub first_launch_complete: Option<bool>,
    pub timer_deadline_ms: Option<Option<i64>>,
    pub timer_paused_ms: Option<Option<i64>>,
    pub stopwatch_accum_ms: Option<i64>,
    pub stopwatch_started_ms: Option<Option<i64>>,
    pub pomo_deadline_ms: Option<Option<i64>>,
    pub pomo_phase: Option<String>,
    pub pomo_running: Option<bool>,
    pub pomo_focus_min: Option<u32>,
    pub pomo_break_min: Option<u32>,
    pub pomo_round: Option<u32>,
    pub pomo_total_rounds: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub r: f64,
}
