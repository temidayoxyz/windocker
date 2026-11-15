use sysinfo::{Disks, Networks, Pid, ProcessesToUpdate, System};

use crate::model::{DiskStat, ProcStat};

pub struct Metrics {
    pub sys: System,
    pub networks: Networks,
    pub prev_rx: u64,
    pub prev_tx: u64,
    pub disks: Disks,
}

impl Metrics {
    pub fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_memory();
        sys.refresh_cpu_usage();
        let networks = Networks::new_with_refreshed_list();
        let (prev_rx, prev_tx) = sum_net(&networks);
        Self {
            sys,
            networks,
            prev_rx,
            prev_tx,
            disks: Disks::new_with_refreshed_list(),
        }
    }

    pub fn refresh(&mut self, want_processes: bool) -> (f32, u64, u64, u64, u64, f32, u64, Vec<ProcStat>, Vec<ProcStat>) {
        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();
        let cpu = self.sys.global_cpu_usage();
        let ram_used = self.sys.used_memory();
        let ram_total = self.sys.total_memory();
        self.networks.refresh(true);
        let (rx, tx) = sum_net(&self.networks);
        let down = rx.saturating_sub(self.prev_rx);
        let up = tx.saturating_sub(self.prev_tx);
        self.prev_rx = rx;
        self.prev_tx = tx;
        if want_processes {
            self.sys.refresh_processes(ProcessesToUpdate::All, true);
        } else if let Ok(pid) = sysinfo::get_current_pid() {
            self.sys.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
        }
        let (self_cpu, self_mem) = self_usage(&self.sys);
        let (top_cpu, top_ram) = if want_processes { top_processes(&self.sys) } else { (Vec::new(), Vec::new()) };
        (cpu, ram_used, ram_total, down, up, self_cpu, self_mem, top_cpu, top_ram)
    }

    pub fn disk_stats(&mut self) -> Vec<DiskStat> {
        self.disks.refresh(true);
        self.disks
            .list()
            .iter()
            .map(|disk| DiskStat {
                name: disk.name().to_string_lossy().to_string(),
                mount: disk.mount_point().to_string_lossy().to_string(),
                total: disk.total_space(),
                free: disk.available_space(),
            })
            .collect()
    }
}

fn sum_net(networks: &Networks) -> (u64, u64) {
    let mut rx = 0u64;
    let mut tx = 0u64;
    for (_, data) in networks.iter() {
        rx += data.received();
        tx += data.transmitted();
    }
    (rx, tx)
}

fn self_usage(sys: &System) -> (f32, u64) {
    let Ok(pid) = sysinfo::get_current_pid() else { return (0.0, 0); };
    let Some(proc) = sys.process(pid) else { return (0.0, 0); };
    (proc.cpu_usage(), proc.memory())
}

fn top_processes(sys: &System) -> (Vec<ProcStat>, Vec<ProcStat>) {
    let mut rows: Vec<(String, f32, u64)> = sys
        .processes()
        .values()
        .map(|proc| (proc.name().to_string_lossy().to_string(), proc.cpu_usage(), proc.memory()))
        .filter(|(_, cpu, mem)| *cpu > 0.4 || *mem > 40 * 1024 * 1024)
        .collect();
    let mut by_cpu = rows.clone();
    by_cpu.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    by_cpu.truncate(3);
    rows.sort_by(|a, b| b.2.cmp(&a.2));
    rows.truncate(3);
    let cpu = by_cpu.into_iter().map(|(name, value, _)| ProcStat { name, value }).collect();
    let ram = rows
        .into_iter()
        .map(|(name, _, mem)| ProcStat { name, value: mem as f32 / (1024.0 * 1024.0) })
        .collect();
    let _ = Pid::from_u32(0);
    (cpu, ram)
}

pub fn media() -> Option<crate::model::MediaNow> {
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager, GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    unsafe {
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().ok()?.get().ok()?;
        let session = manager.GetCurrentSession().ok()?;
        let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
        let title = props.Title().ok().map(|s| s.to_string()).unwrap_or_default();
        let artist = props.Artist().ok().map(|s| s.to_string()).unwrap_or_default();
        if title.is_empty() && artist.is_empty() {
            return None;
        }
        let status = session
            .GetPlaybackInfo()
            .ok()
            .and_then(|info| info.PlaybackStatus().ok())
            .map(|status| match status {
                GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing => "playing",
                GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused => "paused",
                _ => "stopped",
            })
            .unwrap_or("stopped")
            .to_string();
        let timeline = session.GetTimelineProperties().ok();
        let position_sec = timeline
            .as_ref()
            .and_then(|t| t.Position().ok())
            .map(|t| t.Duration as f64 / 10_000_000.0)
            .unwrap_or(0.0);
        let duration_sec = timeline
            .as_ref()
            .and_then(|t| t.EndTime().ok())
            .map(|t| t.Duration as f64 / 10_000_000.0)
            .unwrap_or(0.0);
        Some(crate::model::MediaNow { title, artist, status, position_sec, duration_sec })
    }
}

pub fn media_command(command: &str) -> Result<(), String> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;
    unsafe {
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?;
        let session = manager.GetCurrentSession().map_err(|_| "Nothing is playing.".to_string())?;
        let op = match command {
            "play" => session.TryPlayAsync().map_err(|e| e.to_string())?,
            "pause" => session.TryPauseAsync().map_err(|e| e.to_string())?,
            "next" => session.TrySkipNextAsync().map_err(|e| e.to_string())?,
            "previous" => session.TrySkipPreviousAsync().map_err(|e| e.to_string())?,
            "toggle" => {
                let playing = session
                    .GetPlaybackInfo()
                    .ok()
                    .and_then(|info| info.PlaybackStatus().ok())
                    .map(|s| s == windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                    .unwrap_or(false);
                if playing {
                    session.TryPauseAsync().map_err(|e| e.to_string())?
                } else {
                    session.TryPlayAsync().map_err(|e| e.to_string())?
                }
            }
            _ => return Err("Unknown media command.".into()),
        };
        op.get().map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub fn radios() -> (Option<bool>, Option<bool>) {
    use windows::Devices::Radios::{Radio, RadioKind, RadioState};
    unsafe {
        let Ok(list) = Radio::GetRadiosAsync().and_then(|op| op.get()) else {
            return (None, None);
        };
        let mut wifi = None;
        let mut bluetooth = None;
        let count = list.Size().unwrap_or(0);
        for index in 0..count {
            let Ok(radio) = list.GetAt(index) else { continue };
            let Ok(kind) = radio.Kind() else { continue };
            let on = radio.State().ok().map(|s| s == RadioState::On);
            if kind == RadioKind::WiFi {
                wifi = on;
            } else if kind == RadioKind::Bluetooth {
                bluetooth = on;
            }
        }
        (wifi, bluetooth)
    }
}

pub fn toggle_radio(kind_name: &str) -> Result<(), String> {
    use windows::Devices::Radios::{Radio, RadioKind, RadioState};
    unsafe {
        let list = Radio::GetRadiosAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?;
        let wanted = if kind_name == "bluetooth" { RadioKind::Bluetooth } else { RadioKind::WiFi };
        let count = list.Size().unwrap_or(0);
        for index in 0..count {
            let radio = list.GetAt(index).map_err(|e| e.to_string())?;
            if radio.Kind().unwrap_or(RadioKind::Other) != wanted {
                continue;
            }
            let on = radio.State().unwrap_or(RadioState::Off) == RadioState::On;
            let next = if on { RadioState::Off } else { RadioState::On };
            radio.SetStateAsync(next).map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?;
            return Ok(());
        }
        Err("That radio is not available. Opening Windows settings instead.".into())
    }
}

pub fn brightness() -> Option<u32> {
    use windows::Win32::Devices::Display::{
        DestroyPhysicalMonitors, GetMonitorBrightness, GetNumberOfPhysicalMonitorsFromHMONITOR,
        GetPhysicalMonitorsFromHMONITOR, PHYSICAL_MONITOR,
    };
    use windows::Win32::Graphics::Gdi::{MonitorFromPoint, MONITOR_DEFAULTTOPRIMARY};
    use windows::Win32::Foundation::POINT;
    unsafe {
        let monitor = MonitorFromPoint(POINT { x: 100, y: 100 }, MONITOR_DEFAULTTOPRIMARY);
        let mut count = 0u32;
        if GetNumberOfPhysicalMonitorsFromHMONITOR(monitor, &mut count).is_err() || count == 0 {
            return None;
        }
        let mut physical = vec![PHYSICAL_MONITOR::default(); count as usize];
        if GetPhysicalMonitorsFromHMONITOR(monitor, &mut physical).is_err() {
            return None;
        }
        let mut min = 0u32;
        let mut current = 0u32;
        let mut max = 0u32;
        let ok = GetMonitorBrightness(physical[0].hPhysicalMonitor, &mut min, &mut current, &mut max) != 0;
        let _ = DestroyPhysicalMonitors(&physical);
        if !ok || max <= min {
            return None;
        }
        Some(((current - min) as f32 / (max - min) as f32 * 100.0).round() as u32)
    }
}

pub fn set_brightness(percent: u32) -> Result<(), String> {
    use windows::Win32::Devices::Display::{
        DestroyPhysicalMonitors, GetMonitorBrightness, GetNumberOfPhysicalMonitorsFromHMONITOR,
        GetPhysicalMonitorsFromHMONITOR, SetMonitorBrightness, PHYSICAL_MONITOR,
    };
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{MonitorFromPoint, MONITOR_DEFAULTTOPRIMARY};
    unsafe {
        let monitor = MonitorFromPoint(POINT { x: 100, y: 100 }, MONITOR_DEFAULTTOPRIMARY);
        let mut count = 0u32;
        GetNumberOfPhysicalMonitorsFromHMONITOR(monitor, &mut count).map_err(|e| e.to_string())?;
        if count == 0 {
            return Err("This display does not expose a brightness control.".into());
        }
        let mut physical = vec![PHYSICAL_MONITOR::default(); count as usize];
        GetPhysicalMonitorsFromHMONITOR(monitor, &mut physical).map_err(|e| e.to_string())?;
        let mut min = 0u32;
        let mut current = 0u32;
        let mut max = 0u32;
        let read = GetMonitorBrightness(physical[0].hPhysicalMonitor, &mut min, &mut current, &mut max);
        let result = if read != 0 && max > min {
            let value = min + ((percent.min(100)) * (max - min) / 100);
            if SetMonitorBrightness(physical[0].hPhysicalMonitor, value) != 0 {
                Ok(())
            } else {
                Err("Windows rejected the brightness change.".into())
            }
        } else {
            Err("This display does not expose a brightness control.".into())
        };
        let _ = DestroyPhysicalMonitors(&physical);
        result
    }
}
