use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use windows::core::{BOOL, Interface, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, IPersistFile, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    STGM_READ,
};
use windows::Win32::System::Threading::{
    AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
    TerminateProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
};
use windows::Win32::UI::Shell::{
    IShellLinkW, SHGetFileInfoW, ShellLink, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON,
};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowRect,
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
    PrivateExtractIconsW, SetForegroundWindow, ShowWindow, HICON, SW_MINIMIZE, SW_RESTORE,
    SW_SHOW,
};

use crate::model::{AppEntry, RunningWindow};
use crate::shell::{self, open_path};

static EXE_ICON_CACHE: Mutex<Option<HashMap<String, Option<String>>>> = Mutex::new(None);

pub fn scan_apps() -> Vec<AppEntry> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
    }
    let mut roots = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        roots.push(PathBuf::from(appdata).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }
    roots.push(PathBuf::from(
        r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
    ));
    let mut found = Vec::new();
    for root in roots {
        walk(&root, &mut found);
    }
    found.push(explorer_entry());
    found.push(settings_entry());
    found.push(taskmgr_entry());
    found.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    found.dedup_by(|a, b| a.exe.eq_ignore_ascii_case(&b.exe) && !a.exe.is_empty());
    found
}

fn walk(dir: &Path, out: &mut Vec<AppEntry>) {
    if out.len() > 450 {
        return;
    }
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in read.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk(&path, out);
            continue;
        }
        if path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .eq_ignore_ascii_case("lnk")
        {
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let lower = name.to_lowercase();
            if lower.contains("uninstall") || lower.contains("readme") || lower == "help" {
                continue;
            }
            if let Some(app) = lnk_app(&path, &name) {
                out.push(app);
            }
        }
    }
}

fn lnk_app(path: &Path, name: &str) -> Option<AppEntry> {
    let launch = path.to_string_lossy().to_string();
    let (exe_opt, icon_loc) = resolve_lnk_details(path);
    let exe = exe_opt.unwrap_or_default();
    let icon = icon_loc
        .and_then(|(p, idx)| highres_icon_index(&p, idx))
        .or_else(|| highres_exe_icon(&exe))
        .or_else(|| file_icon(&launch))
        .or_else(|| file_icon(&exe));
    Some(AppEntry {
        id: launch.to_lowercase(),
        name: name.to_string(),
        launch,
        exe,
        icon,
    })
}

fn explorer_entry() -> AppEntry {
    let exe = r"C:\Windows\explorer.exe".to_string();
    AppEntry {
        id: "explorer".into(),
        name: "File Explorer".into(),
        launch: exe.clone(),
        exe: exe.clone(),
        icon: highres_exe_icon(&exe).or_else(|| file_icon(&exe)),
    }
}

fn settings_entry() -> AppEntry {
    AppEntry {
        id: "ms-settings".into(),
        name: "Settings".into(),
        launch: "ms-settings:".into(),
        exe: r"C:\Windows\ImmersiveControlPanel\SystemSettings.exe".into(),
        icon: None,
    }
}

fn taskmgr_entry() -> AppEntry {
    let exe = r"C:\Windows\System32\Taskmgr.exe".to_string();
    AppEntry {
        id: "taskmgr".into(),
        name: "Activity Monitor".into(),
        launch: exe.clone(),
        exe: exe.clone(),
        icon: highres_exe_icon(&exe).or_else(|| file_icon(&exe)),
    }
}

fn resolve_lnk_details(path: &Path) -> (Option<String>, Option<(String, i32)>) {
    unsafe {
        let Ok(link) = CoCreateInstance::<_, IShellLinkW>(&ShellLink, None, CLSCTX_INPROC_SERVER)
        else {
            return (None, None);
        };
        let Ok(persist) = link.cast::<IPersistFile>() else {
            return (None, None);
        };
        let wide: Vec<u16> = path
            .to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        if persist.Load(PCWSTR(wide.as_ptr()), STGM_READ).is_err() {
            return (None, None);
        }
        let mut buf = [0u16; 520];
        let exe = if link.GetPath(&mut buf, std::ptr::null_mut(), 0).is_ok() {
            let end = buf.iter().position(|c| *c == 0).unwrap_or(buf.len());
            let text = String::from_utf16_lossy(&buf[..end]);
            if text.is_empty() { None } else { Some(text) }
        } else {
            None
        };
        let mut ibuf = [0u16; 520];
        let mut idx = 0i32;
        let icon_loc = if link.GetIconLocation(&mut ibuf, &mut idx).is_ok() {
            let end = ibuf.iter().position(|c| *c == 0).unwrap_or(ibuf.len());
            let text = String::from_utf16_lossy(&ibuf[..end]);
            if text.is_empty() { None } else { Some((text, idx)) }
        } else {
            None
        };
        (exe, icon_loc)
    }
}

fn highres_icon_index(path: &str, index: i32) -> Option<String> {
    if path.is_empty() {
        return None;
    }
    unsafe {
        let mut buf = [0u16; 260];
        let units: Vec<u16> = path.encode_utf16().take(259).collect();
        if units.is_empty() {
            return None;
        }
        buf[..units.len()].copy_from_slice(&units);
        let mut hicon = [HICON::default(); 1];
        let mut icon_id = [0u32; 1];
        let count = PrivateExtractIconsW(
            &buf,
            index,
            96,
            96,
            Some(&mut hicon),
            Some(icon_id.as_mut_ptr()),
            0,
        );
        if count > 0 && !hicon[0].is_invalid() {
            return shell::icon_png(hicon[0]);
        }
        None
    }
}

fn highres_exe_icon(path: &str) -> Option<String> {
    if path.is_empty() || !path.to_lowercase().ends_with(".exe") {
        return None;
    }
    highres_icon_index(path, 0)
}

pub fn file_icon(path: &str) -> Option<String> {
    if path.is_empty() {
        return None;
    }
    unsafe {
        let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut info = SHFILEINFOW::default();
        let got = SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            FILE_ATTRIBUTE_NORMAL,
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        if got == 0 || info.hIcon.is_invalid() {
            return None;
        }
        shell::icon_png(info.hIcon)
    }
}

pub fn cached_exe_icon(path: &str) -> Option<String> {
    let key = path.to_lowercase();
    {
        let mut guard = EXE_ICON_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        let map = guard.get_or_insert_with(HashMap::new);
        if let Some(found) = map.get(&key) {
            return found.clone();
        }
    }
    let icon = highres_exe_icon(path).or_else(|| file_icon(path));
    let mut guard = EXE_ICON_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let map = guard.get_or_insert_with(HashMap::new);
    if map.len() < 160 {
        map.insert(key, icon.clone());
    }
    icon
}

pub fn suggest_pins(apps: &[AppEntry]) -> Vec<String> {
    let wanted = [
        "windows terminal",
        "visual studio code",
        "google chrome",
        "microsoft edge",
        "notepad",
        "settings",
    ];
    let mut pins = vec!["explorer".to_string()];
    let mut seen_exes = std::collections::HashSet::from(["explorer.exe".to_string()]);
    for name in wanted {
        if let Some(app) = apps.iter().find(|a| a.name.eq_ignore_ascii_case(name)) {
            let exe = exe_key(&app.exe);
            if !pins.iter().any(|id| id == &app.id) && (exe.is_empty() || seen_exes.insert(exe)) {
                pins.push(app.id.clone());
            }
        }
    }
    pins.truncate(6);
    pins
}

struct EnumState {
    windows: Vec<RunningWindow>,
}

pub fn running_windows() -> Vec<RunningWindow> {
    let mut state = EnumState {
        windows: Vec::new(),
    };
    unsafe {
        let ptr = &mut state as *mut EnumState;
        let _ = EnumWindows(Some(enum_proc), LPARAM(ptr as isize));
    }
    state.windows
}

unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let state = &mut *(lparam.0 as *mut EnumState);
    if !IsWindowVisible(hwnd).as_bool()
        || IsIconic(hwnd).as_bool() && window_title(hwnd).is_empty()
    {
        return true.into();
    }
    let mut cloaked = 0u32;
    let _ = DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &mut cloaked as *mut _ as *mut _, 4);
    if cloaked != 0 {
        return true.into();
    }
    let mut class = [0u16; 64];
    let n = GetClassNameW(hwnd, &mut class);
    let class_name = String::from_utf16_lossy(&class[..n as usize]);
    if matches!(
        class_name.as_str(),
        "Shell_TrayWnd"
            | "Shell_SecondaryTrayWnd"
            | "Progman"
            | "WorkerW"
            | "Windows.UI.Core.CoreWindow"
            | "NotifyIconOverflowWindow"
    ) {
        return true.into();
    }
    let title = window_title(hwnd);
    if title.is_empty() {
        return true.into();
    }
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    let exe = process_path(pid).unwrap_or_default();
    if exe.is_empty() {
        return true.into();
    }
    let lower = exe.to_lowercase();
    if lower.ends_with("windocker.exe") || lower.ends_with("applicationframehost.exe") {
        return true.into();
    }
    let name = Path::new(&exe)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("App")
        .to_string();
    let icon = cached_exe_icon(&exe);
    state.windows.push(RunningWindow {
        hwnd: hwnd.0 as i64,
        exe,
        title,
        name,
        icon,
    });
    true.into()
}

fn window_title(hwnd: HWND) -> String {
    unsafe {
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return String::new();
        }
        let mut buf = vec![0u16; len as usize + 1];
        let n = GetWindowTextW(hwnd, &mut buf);
        String::from_utf16_lossy(&buf[..n as usize])
    }
}

fn process_path(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 520];
        let mut size = buf.len() as u32;
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut size,
        )
        .ok()?;
        let _ = windows::Win32::Foundation::CloseHandle(handle);
        Some(String::from_utf16_lossy(&buf[..size as usize]))
    }
}

pub fn entry_from_dropped(path: &str) -> Result<AppEntry, String> {
    let path = Path::new(path.trim().trim_matches('"'));
    if !path.exists() {
        return Err("That file is not on this PC.".into());
    }
    let ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
    if ext.eq_ignore_ascii_case("lnk") {
        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("App");
        return lnk_app(path, name).ok_or_else(|| "That shortcut could not be read.".into());
    }
    if ext.eq_ignore_ascii_case("exe") {
        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("App")
            .to_string();
        let exe = path.to_string_lossy().to_string();
        return Ok(AppEntry {
            id: exe.to_lowercase(),
            name,
            launch: exe.clone(),
            exe: exe.clone(),
            icon: highres_exe_icon(&exe).or_else(|| file_icon(&exe)),
        });
    }
    Err("Drop an application or a shortcut onto the dock.".into())
}

pub fn launch(app: &AppEntry) {
    open_path(&app.launch);
}

pub fn activate(hwnd_value: i64) -> Result<(), String> {
    let hwnd = HWND(hwnd_value as *mut _);
    unsafe {
        if hwnd.is_invalid() {
            return Err("That window is gone.".into());
        }
        let foreground = GetForegroundWindow();
        if foreground == hwnd && !IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_MINIMIZE);
            return Ok(());
        }
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        let fore_thread = GetWindowThreadProcessId(foreground, None);
        let target_thread = GetWindowThreadProcessId(hwnd, None);
        let current = GetCurrentThreadId();
        let _ = AttachThreadInput(current, fore_thread, true);
        let _ = AttachThreadInput(current, target_thread, true);
        let _ = SetForegroundWindow(hwnd);
        let _ = ShowWindow(hwnd, SW_SHOW);
        let _ = BringWindowToTop(hwnd);
        let _ = AttachThreadInput(current, target_thread, false);
        let _ = AttachThreadInput(current, fore_thread, false);
    }
    Ok(())
}

pub fn minimize_window(hwnd_value: i64) -> Result<(), String> {
    let hwnd = HWND(hwnd_value as *mut _);
    unsafe {
        if hwnd.is_invalid() {
            return Err("That window is gone.".into());
        }
        let _ = ShowWindow(hwnd, SW_MINIMIZE);
    }
    Ok(())
}

pub fn close_window(hwnd_value: i64) -> Result<(), String> {
    let hwnd = HWND(hwnd_value as *mut _);
    unsafe {
        windows::Win32::UI::WindowsAndMessaging::PostMessageW(
            Some(hwnd),
            windows::Win32::UI::WindowsAndMessaging::WM_CLOSE,
            windows::Win32::Foundation::WPARAM(0),
            LPARAM(0),
        )
        .map_err(|e| e.to_string())
    }
}

pub fn end_task(hwnd_value: i64) -> Result<(), String> {
    let hwnd = HWND(hwnd_value as *mut _);
    unsafe {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let path = process_path(pid).unwrap_or_default().to_lowercase();
        if path.ends_with("explorer.exe") || path.ends_with("windocker.exe") {
            return Err("Windocker will not end Explorer or itself.".into());
        }
        let handle = OpenProcess(PROCESS_TERMINATE, false, pid).map_err(|e| e.to_string())?;
        TerminateProcess(handle, 1).map_err(|e| e.to_string())?;
        let _ = windows::Win32::Foundation::CloseHandle(handle);
    }
    Ok(())
}

pub fn foreground_app() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let path = process_path(pid)?;
        let name = exe_key(&path);
        if name == "windocker.exe" || name == "explorer.exe" || name == "searchhost.exe" {
            return None;
        }
        Some(name.trim_end_matches(".exe").to_string())
    }
}

pub fn exe_key(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_lowercase()
}

#[allow(dead_code)]
pub fn window_rect(hwnd_value: i64) -> Option<RECT> {
    let hwnd = HWND(hwnd_value as *mut _);
    unsafe {
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        Some(rect)
    }
}
