use std::path::PathBuf;

use windows::core::{BOOL, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, POINT, RECT, WIN32_ERROR, WPARAM};
use windows::Win32::Graphics::Dwm::{
    DwmRegisterThumbnail, DwmUnregisterThumbnail, DwmUpdateThumbnailProperties,
    DWM_THUMBNAIL_PROPERTIES, DWM_TNP_OPACITY, DWM_TNP_RECTDESTINATION, DWM_TNP_VISIBLE,
};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreateRoundRectRgn, DeleteDC, DeleteObject,
    GetDC, GetDIBits, ReleaseDC, SelectObject, SetWindowRgn, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
    DIB_RGB_COLORS, HBITMAP, HDC, HRGN, RGN_OR, SRCCOPY,
};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eCapture, eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::System::Diagnostics::Debug::MessageBeep;
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW, HKEY,
    HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE, REG_DWORD,
    REG_OPTION_NON_VOLATILE, REG_SZ,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP, VK_LWIN};
use windows::Win32::UI::Shell::{
    SHEmptyRecycleBinW, SHQueryRecycleBinW, ShellExecuteW, APPBARDATA, SHERB_NOCONFIRMATION,
    SHERB_NOPROGRESSUI, SHQUERYRBINFO,
};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, FindWindowW, GetForegroundWindow, GetSystemMetrics, GetWindowLongPtrW,
    GetWindowRect, IsWindowVisible, SendMessageTimeoutW, SetWindowPos, ShowWindow,
    SystemParametersInfoW, GWL_STYLE, HWND_BROADCAST, HWND_TOPMOST, MB_OK, SMTO_ABORTIFHUNG,
    SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SPIF_SENDCHANGE,
    SPIF_UPDATEINIFILE, SPI_GETSCREENSAVEACTIVE, SPI_SETDESKWALLPAPER, SWP_NOACTIVATE,
    SWP_SHOWWINDOW, SW_HIDE, SW_SHOW, SW_SHOWNORMAL, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
    WM_SETTINGCHANGE, WS_CAPTION,
};

const ABM_SETSTATE: u32 = 0x0000000A;
const ABS_AUTOHIDE: isize = 0x1;
const ABS_ALWAYSONTOP: isize = 0x2;
const WCA_ACCENT_POLICY: u32 = 19;
const ACCENT_DISABLED: u32 = 0;
const ACCENT_ENABLE_ACRYLICBLURBEHIND: u32 = 4;

#[repr(C)]
struct AccentPolicy {
    accent_state: u32,
    accent_flags: u32,
    gradient_color: u32,
    animation_id: u32,
}

#[repr(C)]
struct WindowCompositionAttributeData {
    attribute: u32,
    data: *mut std::ffi::c_void,
    size_of_data: usize,
}

type SetWindowCompositionAttributeFn =
    unsafe extern "system" fn(HWND, *mut WindowCompositionAttributeData) -> BOOL;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TaskbarMode {
    Untouched,
    AutoHide,
    Hidden,
}

impl TaskbarMode {
    pub fn parse(value: &str) -> Self {
        match value {
            "hidden" => Self::Hidden,
            "untouched" => Self::Untouched,
            _ => Self::AutoHide,
        }
    }
}

struct TaskbarBackup {
    hidden: Vec<isize>,
}

static BACKUP: std::sync::Mutex<TaskbarBackup> =
    std::sync::Mutex::new(TaskbarBackup { hidden: Vec::new() });

fn tray_windows() -> Vec<HWND> {
    let mut out = Vec::new();
    unsafe {
        if let Ok(hwnd) = FindWindowW(windows::core::w!("Shell_TrayWnd"), None) {
            if !hwnd.is_invalid() {
                out.push(hwnd);
            }
        }
        let mut after = HWND::default();
        loop {
            match FindWindowExW(
                None,
                Some(after),
                windows::core::w!("Shell_SecondaryTrayWnd"),
                None,
            ) {
                Ok(hwnd) if !hwnd.is_invalid() => {
                    out.push(hwnd);
                    after = hwnd;
                }
                _ => break,
            }
        }
    }
    out
}

unsafe fn set_appbar_state(hwnd: HWND, param: isize) {
    let mut abd = APPBARDATA {
        cbSize: std::mem::size_of::<APPBARDATA>() as u32,
        hWnd: hwnd,
        uCallbackMessage: 0,
        uEdge: 0,
        rc: RECT::default(),
        lParam: LPARAM(param),
    };
    windows::Win32::UI::Shell::SHAppBarMessage(ABM_SETSTATE, &mut abd);
}

pub fn apply_taskbar(mode: TaskbarMode) {
    let trays = tray_windows();
    let mut backup = BACKUP.lock().unwrap_or_else(|e| e.into_inner());
    unsafe {
        match mode {
            TaskbarMode::Untouched => {
                for hwnd in &trays {
                    set_appbar_state(*hwnd, ABS_ALWAYSONTOP);
                    let _ = ShowWindow(*hwnd, SW_SHOW);
                }
                backup.hidden.clear();
            }
            TaskbarMode::AutoHide => {
                for hwnd in &trays {
                    let _ = ShowWindow(*hwnd, SW_SHOW);
                    set_appbar_state(*hwnd, ABS_AUTOHIDE);
                }
                backup.hidden.clear();
            }
            TaskbarMode::Hidden => {
                for hwnd in &trays {
                    set_appbar_state(*hwnd, ABS_AUTOHIDE);
                    let _ = ShowWindow(*hwnd, SW_HIDE);
                    backup.hidden.push(hwnd.0 as isize);
                }
            }
        }
    }
}

pub fn restore_taskbar() {
    apply_taskbar(TaskbarMode::Untouched);
}

pub fn ensure_taskbar_hidden() {
    let trays = tray_windows();
    unsafe {
        for hwnd in trays {
            if IsWindowVisible(hwnd).as_bool() {
                set_appbar_state(hwnd, ABS_AUTOHIDE);
                let _ = ShowWindow(hwnd, SW_HIDE);
            }
        }
    }
}

pub fn set_acrylic(hwnd: HWND, enabled: bool, dark: bool) {
    unsafe {
        let Ok(module) =
            windows::Win32::System::LibraryLoader::LoadLibraryW(windows::core::w!("user32.dll"))
        else {
            return;
        };
        let Some(symbol) = windows::Win32::System::LibraryLoader::GetProcAddress(
            module,
            windows::core::s!("SetWindowCompositionAttribute"),
        ) else {
            return;
        };
        let set: SetWindowCompositionAttributeFn = std::mem::transmute(symbol);
        let color = if dark { 0x99121418 } else { 0x88FFFFFF };
        let mut policy = AccentPolicy {
            accent_state: if enabled {
                ACCENT_ENABLE_ACRYLICBLURBEHIND
            } else {
                ACCENT_DISABLED
            },
            accent_flags: 2,
            gradient_color: color,
            animation_id: 0,
        };
        let mut data = WindowCompositionAttributeData {
            attribute: WCA_ACCENT_POLICY,
            data: &mut policy as *mut _ as *mut _,
            size_of_data: std::mem::size_of::<AccentPolicy>(),
        };
        let _ = set(hwnd, &mut data);
    }
}

pub fn set_round_regions(hwnd: HWND, rects: &[(i32, i32, i32, i32, i32)]) {
    unsafe {
        if rects.is_empty() {
            let _ = SetWindowRgn(hwnd, None, true);
            return;
        }
        let mut combined: Option<HRGN> = None;
        for (x, y, w, h, r) in rects {
            if *w < 2 || *h < 2 {
                continue;
            }
            let radius = (*r).max(0);
            let rgn = CreateRoundRectRgn(*x, *y, x + w + 1, y + h + 1, radius * 2, radius * 2);
            if rgn.is_invalid() {
                continue;
            }
            combined = Some(match combined {
                None => rgn,
                Some(prev) => {
                    let dest = CreateRoundRectRgn(0, 0, 1, 1, 0, 0);
                    let _ = windows::Win32::Graphics::Gdi::CombineRgn(
                        Some(dest),
                        Some(prev),
                        Some(rgn),
                        RGN_OR,
                    );
                    let _ = DeleteObject(prev.into());
                    let _ = DeleteObject(rgn.into());
                    dest
                }
            });
        }
        if let Some(rgn) = combined {
            let _ = SetWindowRgn(hwnd, Some(rgn), true);
        }
    }
}

pub fn place_window(hwnd: HWND, x: i32, y: i32, w: i32, h: i32) {
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            x,
            y,
            w.max(40),
            h.max(24),
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }
}

pub fn foreground_is_borderless_fullscreen(our: HWND) -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() || hwnd == our {
            return false;
        }
        let mut class = [0u16; 64];
        let n = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(hwnd, &mut class);
        let class_name = String::from_utf16_lossy(&class[..n as usize]);
        if matches!(
            class_name.as_str(),
            "Shell_TrayWnd"
                | "Shell_SecondaryTrayWnd"
                | "Progman"
                | "WorkerW"
                | "Windows.UI.Core.CoreWindow"
        ) {
            return false;
        }
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }
        let monitor = windows::Win32::Graphics::Gdi::MonitorFromWindow(
            hwnd,
            windows::Win32::Graphics::Gdi::MONITOR_DEFAULTTONEAREST,
        );
        let mut info = windows::Win32::Graphics::Gdi::MONITORINFO {
            cbSize: std::mem::size_of::<windows::Win32::Graphics::Gdi::MONITORINFO>() as u32,
            ..Default::default()
        };
        if !windows::Win32::Graphics::Gdi::GetMonitorInfoW(monitor, &mut info).as_bool() {
            return false;
        }
        let covers = (rect.right - rect.left) >= (info.rcMonitor.right - info.rcMonitor.left) - 4
            && (rect.bottom - rect.top) >= (info.rcMonitor.bottom - info.rcMonitor.top) - 4;
        if !covers {
            return false;
        }
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let caption = WS_CAPTION.0;
        style & caption == 0
    }
}

pub fn cursor_pos() -> (i32, i32) {
    unsafe {
        let mut pt = POINT::default();
        let _ = windows::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut pt);
        (pt.x, pt.y)
    }
}

pub fn beep() {
    unsafe {
        let _ = MessageBeep(MB_OK);
    }
}

pub fn open_start_menu() {
    unsafe {
        keybd_event(
            VK_LWIN.0 as u8,
            0,
            windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
            0,
        );
        keybd_event(VK_LWIN.0 as u8, 0, KEYEVENTF_KEYUP, 0);
    }
}

pub fn show_desktop() {
    unsafe {
        keybd_event(
            VK_LWIN.0 as u8,
            0,
            windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
            0,
        );
        keybd_event(
            b'D',
            0,
            windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0),
            0,
        );
        keybd_event(b'D', 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_LWIN.0 as u8, 0, KEYEVENTF_KEYUP, 0);
    }
}

pub fn lock_screen() {
    open_path("rundll32.exe");
    let wide_verb: Vec<u16> = "open\0".encode_utf16().collect();
    let wide_file: Vec<u16> = "rundll32.exe\0".encode_utf16().collect();
    let wide_args: Vec<u16> = "user32.dll,LockWorkStation\0".encode_utf16().collect();
    unsafe {
        ShellExecuteW(
            None,
            PCWSTR(wide_verb.as_ptr()),
            PCWSTR(wide_file.as_ptr()),
            PCWSTR(wide_args.as_ptr()),
            None,
            SW_SHOWNORMAL,
        );
    }
}

pub fn open_path(path: &str) {
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        ShellExecuteW(
            None,
            windows::core::w!("open"),
            PCWSTR(wide.as_ptr()),
            None,
            None,
            SW_SHOWNORMAL,
        );
    }
}

pub fn open_url(url: &str) {
    open_path(url);
}

pub fn recycle() -> (u64, u64) {
    unsafe {
        let mut info = SHQUERYRBINFO {
            cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
            ..Default::default()
        };
        if SHQueryRecycleBinW(None, &mut info).is_ok() {
            return (
                info.i64NumItems.max(0) as u64,
                info.i64Size.max(0) as u64,
            );
        }
    }
    (0, 0)
}

pub fn empty_recycle() -> Result<(), String> {
    unsafe {
        SHEmptyRecycleBinW(None, None, SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI)
            .map_err(|e| e.to_string())
    }
}

fn open_key(write: bool) -> Result<HKEY, String> {
    unsafe {
        let mut key = HKEY::default();
        reg_ok(RegCreateKeyExW(
            HKEY_CURRENT_USER,
            windows::core::w!(
                "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"
            ),
            None,
            None,
            REG_OPTION_NON_VOLATILE,
            if write {
                KEY_READ | KEY_SET_VALUE
            } else {
                KEY_READ
            },
            None,
            &mut key,
            None,
        ))?;
        Ok(key)
    }
}

pub fn light_theme() -> bool {
    unsafe {
        let Ok(key) = open_key(false) else {
            return false;
        };
        let mut data = [0u8; 4];
        let mut size = data.len() as u32;
        let mut kind = REG_DWORD;
        let ok = RegQueryValueExW(
            key,
            windows::core::w!("AppsUseLightTheme"),
            None,
            Some(&mut kind),
            Some(data.as_mut_ptr()),
            Some(&mut size),
        );
        let _ = RegCloseKey(key);
        ok.0 == 0 && u32::from_ne_bytes(data) == 1
    }
}

pub fn set_light_theme(light: bool) -> Result<(), String> {
    unsafe {
        let key = open_key(true)?;
        let value = u32::from(light).to_ne_bytes();
        let r1 = RegSetValueExW(
            key,
            windows::core::w!("AppsUseLightTheme"),
            None,
            REG_DWORD,
            Some(&value),
        );
        let r2 = RegSetValueExW(
            key,
            windows::core::w!("SystemUsesLightTheme"),
            None,
            REG_DWORD,
            Some(&value),
        );
        let _ = RegCloseKey(key);
        reg_ok(r1)?;
        reg_ok(r2)?;
        let wide: Vec<u16> = "ImmersiveColorSet"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let _ = SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            WPARAM(0),
            LPARAM(wide.as_ptr() as isize),
            SMTO_ABORTIFHUNG,
            200,
            None,
        );
        Ok(())
    }
}

pub fn toasts_enabled() -> Option<bool> {
    unsafe {
        let mut key = HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            windows::core::w!(
                "Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications"
            ),
            None,
            KEY_READ,
            &mut key,
        )
        .0 != 0
        {
            return None;
        }
        let mut data = [0u8; 4];
        let mut size = 4u32;
        let mut kind = REG_DWORD;
        let ok = RegQueryValueExW(
            key,
            windows::core::w!("ToastEnabled"),
            None,
            Some(&mut kind),
            Some(data.as_mut_ptr()),
            Some(&mut size),
        );
        let _ = RegCloseKey(key);
        if ok.0 == 0 {
            Some(u32::from_ne_bytes(data) != 0)
        } else {
            Some(true)
        }
    }
}

pub fn set_toasts_enabled(enabled: bool) -> Result<(), String> {
    unsafe {
        let mut key = HKEY::default();
        reg_ok(RegCreateKeyExW(
            HKEY_CURRENT_USER,
            windows::core::w!(
                "Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications"
            ),
            None,
            None,
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            None,
            &mut key,
            None,
        ))?;
        let value = u32::from(enabled).to_ne_bytes();
        let result = RegSetValueExW(
            key,
            windows::core::w!("ToastEnabled"),
            None,
            REG_DWORD,
            Some(&value),
        );
        let _ = RegCloseKey(key);
        reg_ok(result)
    }
}

fn read_reg_string(root: HKEY, subkey: &str, value_name: &str) -> Option<String> {
    unsafe {
        let wide_sub: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
        let wide_val: Vec<u16> = value_name
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let mut key = HKEY::default();
        if RegOpenKeyExW(root, PCWSTR(wide_sub.as_ptr()), None, KEY_READ, &mut key).0 != 0 {
            return None;
        }
        let mut kind = REG_SZ;
        let mut size = 0u32;
        let _ = RegQueryValueExW(
            key,
            PCWSTR(wide_val.as_ptr()),
            None,
            Some(&mut kind),
            None,
            Some(&mut size),
        );
        if size == 0 || size > 4096 {
            let _ = RegCloseKey(key);
            return None;
        }
        let mut buf = vec![0u16; (size as usize + 1) / 2];
        let ok = RegQueryValueExW(
            key,
            PCWSTR(wide_val.as_ptr()),
            None,
            Some(&mut kind),
            Some(buf.as_mut_ptr() as *mut u8),
            Some(&mut size),
        );
        let _ = RegCloseKey(key);
        if ok.0 != 0 {
            return None;
        }
        let end = buf.iter().position(|c| *c == 0).unwrap_or(buf.len());
        let s = String::from_utf16_lossy(&buf[..end]).trim().to_string();
        if s.is_empty() {
            None
        } else {
            Some(s)
        }
    }
}

pub fn current_wallpaper_path() -> Option<String> {
    read_reg_string(
        HKEY_CURRENT_USER,
        "Control Panel\\Desktop",
        "WallPaper",
    )
}

pub fn set_wallpaper(path: &str) -> Result<(), String> {
    if !std::path::Path::new(path).exists() {
        return Err("Wallpaper file was not found.".into());
    }
    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER,
            0,
            Some(wide.as_ptr() as *mut _),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        )
        .map_err(|e| e.to_string())
    }
}

pub fn thumbnail_data_url(path: &str, size: u32) -> Option<String> {
    let img = image::open(path).ok()?;
    let thumb = img.resize_to_fill(size, size, image::imageops::FilterType::Triangle);
    let mut bytes = Vec::new();
    thumb
        .write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png)
        .ok()?;
    use base64::Engine;
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

pub fn list_wallpapers() -> Vec<(String, String)> {
    let mut dirs = Vec::new();
    dirs.push(PathBuf::from(r"C:\Windows\Web\Wallpaper"));
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let pics = PathBuf::from(&profile).join("Pictures");
        dirs.push(pics.join("Wallpapers"));
        dirs.push(pics);
    }
    let mut out = Vec::new();
    fn collect(dir: &std::path::Path, out: &mut Vec<(String, String)>, depth: u8) {
        if depth > 2 || out.len() >= 18 {
            return;
        }
        let Ok(rd) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in rd.flatten() {
            let p = entry.path();
            if p.is_dir() {
                collect(&p, out, depth + 1);
                continue;
            }
            let ext = p
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
                let name = p
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Wallpaper")
                    .to_string();
                out.push((p.to_string_lossy().to_string(), name));
                if out.len() >= 18 {
                    break;
                }
            }
        }
    }
    for d in dirs {
        collect(&d, &mut out, 0);
    }
    out
}

pub struct Audio {
    render: IAudioEndpointVolume,
    capture: Option<IAudioEndpointVolume>,
    device_name: String,
}

pub fn with_audio<T>(f: impl FnOnce(&Audio) -> Result<T, String>) -> Result<T, String> {
    std::thread_local! {
        static SLOT: std::cell::RefCell<Option<Audio>> = const { std::cell::RefCell::new(None) };
    }
    SLOT.with(|slot| {
        let mut slot = slot.borrow_mut();
        if slot.is_none() {
            *slot = Some(Audio::open()?);
        }
        f(slot.as_ref().expect("audio endpoint"))
    })
}

impl Audio {
    pub fn open() -> Result<Self, String> {
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .map_err(|e| e.to_string())?;
            let render_dev = enumerator
                .GetDefaultAudioEndpoint(eRender, eMultimedia)
                .map_err(|e| e.to_string())?;
            let device_name = render_dev
                .GetId()
                .ok()
                .and_then(|pwstr| {
                    let s = pwstr.to_string().ok();
                    windows::Win32::System::Com::CoTaskMemFree(Some(pwstr.0 as *const _));
                    s
                })
                .and_then(|id| {
                    let guid = id.rsplit('.').next()?;
                    let key = format!(
                        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{guid}\\Properties"
                    );
                    read_reg_string(
                        HKEY_LOCAL_MACHINE,
                        &key,
                        "{b3f8fa53-0004-438e-9003-51a46e139bfc},6",
                    )
                    .or_else(|| {
                        read_reg_string(
                            HKEY_LOCAL_MACHINE,
                            &key,
                            "{a45c254e-df1c-4efd-8020-67d146a850e0},14",
                        )
                    })
                })
                .unwrap_or_else(|| "Speakers".to_string());
            let render = render_dev
                .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
                .map_err(|e| e.to_string())?;
            let capture = enumerator
                .GetDefaultAudioEndpoint(eCapture, eMultimedia)
                .ok()
                .and_then(|dev| dev.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None).ok());
            Ok(Self {
                render,
                capture,
                device_name,
            })
        }
    }

    pub fn device_name(&self) -> &str {
        &self.device_name
    }

    pub fn volume(&self) -> f32 {
        unsafe { self.render.GetMasterVolumeLevelScalar().unwrap_or(0.0) }
    }

    pub fn set_volume(&self, value: f32) -> Result<(), String> {
        unsafe {
            self.render
                .SetMasterVolumeLevelScalar(value.clamp(0.0, 1.0), std::ptr::null())
                .map_err(|e| e.to_string())
        }
    }

    pub fn muted(&self) -> bool {
        unsafe { self.render.GetMute().map(|b| b.as_bool()).unwrap_or(false) }
    }

    pub fn set_muted(&self, muted: bool) -> Result<(), String> {
        unsafe {
            self.render
                .SetMute(muted, std::ptr::null())
                .map_err(|e| e.to_string())
        }
    }

    pub fn mic_muted(&self) -> bool {
        unsafe {
            self.capture
                .as_ref()
                .and_then(|c| c.GetMute().ok())
                .map(|b| b.as_bool())
                .unwrap_or(false)
        }
    }

    pub fn set_mic_muted(&self, muted: bool) -> Result<(), String> {
        unsafe {
            let Some(capture) = &self.capture else {
                return Err("No microphone endpoint is available.".into());
            };
            capture
                .SetMute(muted, std::ptr::null())
                .map_err(|e| e.to_string())
        }
    }
}

pub fn battery() -> (Option<u8>, bool, bool) {
    unsafe {
        let mut status = SYSTEM_POWER_STATUS::default();
        if GetSystemPowerStatus(&mut status).is_err() {
            return (None, false, true);
        }
        let pct = if status.BatteryLifePercent == 255 {
            None
        } else {
            Some(status.BatteryLifePercent)
        };
        let charging = status.BatteryFlag & 8 != 0;
        let on_ac = status.ACLineStatus == 1;
        (pct, charging, on_ac)
    }
}

pub fn register_preview(dest: HWND, src: HWND, rect: RECT) -> Result<isize, String> {
    unsafe {
        let thumb = DwmRegisterThumbnail(dest, src).map_err(|e| e.to_string())?;
        let props = DWM_THUMBNAIL_PROPERTIES {
            dwFlags: DWM_TNP_RECTDESTINATION | DWM_TNP_VISIBLE | DWM_TNP_OPACITY,
            rcDestination: rect,
            rcSource: RECT::default(),
            opacity: 255,
            fVisible: true.into(),
            fSourceClientAreaOnly: false.into(),
        };
        DwmUpdateThumbnailProperties(thumb, &props).map_err(|e| e.to_string())?;
        Ok(thumb)
    }
}

pub fn clear_preview(thumb: isize) {
    unsafe {
        let _ = DwmUnregisterThumbnail(thumb);
    }
}

fn reg_ok(code: WIN32_ERROR) -> Result<(), String> {
    if code.0 == 0 {
        Ok(())
    } else {
        Err(format!("Windows registry returned error {}.", code.0))
    }
}

fn dib_from_dc(
    hdc: HDC,
    bitmap: HBITMAP,
    width: i32,
    height: i32,
    force_opaque: bool,
) -> Option<Vec<u8>> {
    unsafe {
        let header = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        };
        let mut info = BITMAPINFO {
            bmiHeader: header,
            bmiColors: [windows::Win32::Graphics::Gdi::RGBQUAD::default(); 1],
        };
        let mut pixels = vec![0u8; (width * height * 4) as usize];
        let lines = GetDIBits(
            hdc,
            bitmap,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut info,
            DIB_RGB_COLORS,
        );
        if lines == 0 {
            return None;
        }
        let all_zero_alpha = !force_opaque && pixels.chunks_exact(4).all(|px| px[3] == 0);
        for px in pixels.chunks_exact_mut(4) {
            px.swap(0, 2);
            if force_opaque || all_zero_alpha {
                px[3] = 255;
            }
        }
        let image = image::RgbaImage::from_raw(width as u32, height as u32, pixels)?;
        let mut png = Vec::new();
        image::DynamicImage::ImageRgba8(image)
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .ok()?;
        Some(png)
    }
}

pub fn capture_virtual_screen() -> Result<PathBuf, String> {
    unsafe {
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        if w <= 0 || h <= 0 {
            return Err("The screen size could not be read.".into());
        }
        let hdc = GetDC(None);
        let mem = CreateCompatibleDC(Some(hdc));
        let bmp = CreateCompatibleBitmap(hdc, w, h);
        let old = SelectObject(mem, bmp.into());
        let ok = BitBlt(mem, 0, 0, w, h, Some(hdc), x, y, SRCCOPY).is_ok();
        let png = if ok {
            dib_from_dc(mem, bmp, w, h, true)
        } else {
            None
        };
        SelectObject(mem, old);
        let _ = DeleteObject(bmp.into());
        let _ = DeleteDC(mem);
        ReleaseDC(None, hdc);
        let png = png.ok_or("The screen capture failed.")?;
        let dir = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()))
            .join("Pictures")
            .join("Windocker");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!(
            "screenshot-{}.png",
            chrono::Local::now().format("%Y%m%d-%H%M%S")
        ));
        std::fs::write(&path, png).map_err(|e| e.to_string())?;
        open_path(&format!("explorer.exe /select,\"{}\"", path.display()));
        Ok(path)
    }
}

pub fn capture_foreground() -> Result<PathBuf, String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return Err("No window is in front.".into());
        }
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).map_err(|e| e.to_string())?;
        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;
        if w <= 0 || h <= 0 {
            return Err("That window has no visible area.".into());
        }
        let hdc = GetDC(None);
        let mem = CreateCompatibleDC(Some(hdc));
        let bmp = CreateCompatibleBitmap(hdc, w, h);
        let old = SelectObject(mem, bmp.into());
        let ok = BitBlt(mem, 0, 0, w, h, Some(hdc), rect.left, rect.top, SRCCOPY).is_ok();
        let png = if ok {
            dib_from_dc(mem, bmp, w, h, true)
        } else {
            None
        };
        SelectObject(mem, old);
        let _ = DeleteObject(bmp.into());
        let _ = DeleteDC(mem);
        ReleaseDC(None, hdc);
        let png = png.ok_or("The window capture failed.")?;
        let dir = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()))
            .join("Pictures")
            .join("Windocker");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!(
            "window-{}.png",
            chrono::Local::now().format("%Y%m%d-%H%M%S")
        ));
        std::fs::write(&path, png).map_err(|e| e.to_string())?;
        open_path(&path.display().to_string());
        Ok(path)
    }
}

pub fn open_screenshots_folder() -> Result<(), String> {
    let dir = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()))
        .join("Pictures")
        .join("Windocker");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    open_path(&dir.display().to_string());
    Ok(())
}

pub fn icon_png(icon: windows::Win32::UI::WindowsAndMessaging::HICON) -> Option<String> {
    use windows::Win32::Graphics::Gdi::{GetObjectW, BITMAP};
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};
    unsafe {
        let mut info = ICONINFO::default();
        if GetIconInfo(icon, &mut info).is_err() {
            let _ = DestroyIcon(icon);
            return None;
        }
        let mut bm = BITMAP::default();
        let bytes = GetObjectW(
            info.hbmColor.into(),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bm as *mut _ as *mut _),
        );
        if bytes == 0 || bm.bmWidth <= 0 || bm.bmHeight <= 0 {
            let _ = DeleteObject(info.hbmColor.into());
            let _ = DeleteObject(info.hbmMask.into());
            let _ = DestroyIcon(icon);
            return None;
        }
        let width = bm.bmWidth.min(128);
        let height = bm.bmHeight.abs().min(128);
        let hdc = GetDC(None);
        let png = dib_from_dc(hdc, info.hbmColor, width, height, false);
        ReleaseDC(None, hdc);
        let _ = DeleteObject(info.hbmColor.into());
        let _ = DeleteObject(info.hbmMask.into());
        let _ = DestroyIcon(icon);
        png.map(|bytes| {
            use base64::Engine;
            format!(
                "data:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            )
        })
    }
}

#[allow(dead_code)]
pub fn screensaver_active() -> bool {
    unsafe {
        let mut active = BOOL(0);
        let _ = SystemParametersInfoW(
            SPI_GETSCREENSAVEACTIVE,
            0,
            Some(&mut active as *mut _ as *mut _),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        );
        let _ = COLORREF::default();
        active.as_bool()
    }
}
