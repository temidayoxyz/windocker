use std::path::PathBuf;
use std::str::FromStr;

use chrono::{DateTime, Datelike, Offset, Timelike, Utc};

use crate::model::{
    AiProviderStat, CalEvent, CurrencyNow, DayPoint, GithubNow, HourPoint, WeatherNow,
};

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(8))
        .build()
}

pub fn weather(query: &str) -> WeatherNow {
    if query.trim().is_empty() {
        return WeatherNow {
            city: String::new(),
            temp_c: 0.0,
            code: -1,
            wind: 0.0,
            humidity: 0.0,
            precip: 0.0,
            hi: 0.0,
            lo: 0.0,
            sunrise: String::new(),
            sunset: String::new(),
            hourly: Vec::new(),
            daily: Vec::new(),
            error: Some("Choose a city.".into()),
        };
    }
    let encoded = url_encode(query.trim());
    let geo_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={encoded}&count=1&language=en&format=json"
    );
    let geo: serde_json::Value = match agent().get(&geo_url).call() {
        Ok(res) => res.into_json().unwrap_or(serde_json::json!({})),
        Err(err) => return weather_error(query, &err.to_string()),
    };
    let Some(place) = geo["results"].get(0) else {
        return weather_error(query, "No matching city.");
    };
    let lat = place["latitude"].as_f64().unwrap_or(0.0);
    let lon = place["longitude"].as_f64().unwrap_or(0.0);
    let city = place["name"].as_str().unwrap_or(query).to_string();
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=4"
    );
    let body: serde_json::Value = match agent().get(&url).call() {
        Ok(res) => res.into_json().unwrap_or(serde_json::json!({})),
        Err(err) => return weather_error(&city, &err.to_string()),
    };
    let current = &body["current"];
    let mut hourly = Vec::new();
    if let (Some(times), Some(temps), Some(codes)) = (
        body["hourly"]["time"].as_array(),
        body["hourly"]["temperature_2m"].as_array(),
        body["hourly"]["weather_code"].as_array(),
    ) {
        let now = Utc::now().timestamp();
        for ((time, temp), code) in times.iter().zip(temps).zip(codes) {
            let Some(text) = time.as_str() else { continue };
            let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(text, "%Y-%m-%dT%H:%M")
            else {
                continue;
            };
            let stamp = parsed.and_utc().timestamp();
            if stamp + 3600 < now {
                continue;
            }
            hourly.push(HourPoint {
                label: format!("{:02}:00", parsed.hour()),
                temp_c: temp.as_f64().unwrap_or(0.0) as f32,
                code: code.as_i64().unwrap_or(0) as i32,
            });
            if hourly.len() == 6 {
                break;
            }
        }
    }
    let mut daily = Vec::new();
    if let (Some(times), Some(his), Some(los), Some(codes)) = (
        body["daily"]["time"].as_array(),
        body["daily"]["temperature_2m_max"].as_array(),
        body["daily"]["temperature_2m_min"].as_array(),
        body["daily"]["weather_code"].as_array(),
    ) {
        for (((time, hi), lo), code) in times.iter().zip(his).zip(los).zip(codes) {
            let label = time
                .as_str()
                .and_then(|t| chrono::NaiveDate::parse_from_str(t, "%Y-%m-%d").ok())
                .map(|d| d.format("%a").to_string())
                .unwrap_or_default();
            daily.push(DayPoint {
                label,
                hi: hi.as_f64().unwrap_or(0.0) as f32,
                lo: lo.as_f64().unwrap_or(0.0) as f32,
                code: code.as_i64().unwrap_or(0) as i32,
            });
        }
    }
    let sunrise = body["daily"]["sunrise"][0]
        .as_str()
        .and_then(|s| s.split('T').nth(1))
        .unwrap_or("")
        .to_string();
    let sunset = body["daily"]["sunset"][0]
        .as_str()
        .and_then(|s| s.split('T').nth(1))
        .unwrap_or("")
        .to_string();
    WeatherNow {
        city,
        temp_c: current["temperature_2m"].as_f64().unwrap_or(0.0) as f32,
        code: current["weather_code"].as_i64().unwrap_or(0) as i32,
        wind: current["wind_speed_10m"].as_f64().unwrap_or(0.0) as f32,
        humidity: current["relative_humidity_2m"].as_f64().unwrap_or(0.0) as f32,
        precip: current["precipitation"].as_f64().unwrap_or(0.0) as f32,
        hi: daily.first().map(|d| d.hi).unwrap_or(0.0),
        lo: daily.first().map(|d| d.lo).unwrap_or(0.0),
        sunrise,
        sunset,
        hourly,
        daily,
        error: None,
    }
}

fn weather_error(city: &str, message: &str) -> WeatherNow {
    WeatherNow {
        city: city.to_string(),
        temp_c: 0.0,
        code: -1,
        wind: 0.0,
        humidity: 0.0,
        precip: 0.0,
        hi: 0.0,
        lo: 0.0,
        sunrise: String::new(),
        sunset: String::new(),
        hourly: Vec::new(),
        daily: Vec::new(),
        error: Some(message.to_string()),
    }
}

pub fn currency(from: &str, to: &str, amount: f64) -> CurrencyNow {
    let from = from.trim().to_uppercase();
    let to = to.trim().to_uppercase();
    let url = format!("https://api.frankfurter.app/latest?from={from}&to={to}");
    match agent().get(&url).call() {
        Ok(res) => {
            let body: serde_json::Value = res.into_json().unwrap_or(serde_json::json!({}));
            let rate = body["rates"][&to].as_f64().unwrap_or(0.0);
            if rate == 0.0 {
                CurrencyNow {
                    from,
                    to,
                    rate: 0.0,
                    amount,
                    error: Some("That pair is not available.".into()),
                }
            } else {
                CurrencyNow {
                    from,
                    to,
                    rate,
                    amount,
                    error: None,
                }
            }
        }
        Err(err) => CurrencyNow {
            from,
            to,
            rate: 0.0,
            amount,
            error: Some(err.to_string()),
        },
    }
}

pub fn github(token: &str) -> GithubNow {
    if token.trim().is_empty() {
        return GithubNow {
            login: String::new(),
            total: 0,
            streak: 0,
            cells: Vec::new(),
            error: Some("Add a GitHub token.".into()),
        };
    }
    let query = r#"query { viewer { login contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } } } }"#;
    let response = agent()
        .post("https://api.github.com/graphql")
        .set("Authorization", &format!("Bearer {}", token.trim()))
        .set("User-Agent", "Windocker")
        .send_json(serde_json::json!({ "query": query }));
    let body: serde_json::Value = match response {
        Ok(res) => res.into_json().unwrap_or(serde_json::json!({})),
        Err(err) => {
            return GithubNow {
                login: String::new(),
                total: 0,
                streak: 0,
                cells: Vec::new(),
                error: Some(err.to_string()),
            };
        }
    };
    if let Some(message) = body["errors"][0]["message"].as_str() {
        return GithubNow {
            login: String::new(),
            total: 0,
            streak: 0,
            cells: Vec::new(),
            error: Some(message.to_string()),
        };
    }
    let viewer = &body["data"]["viewer"];
    let calendar = &viewer["contributionsCollection"]["contributionCalendar"];
    let mut cells = Vec::new();
    let mut days: Vec<(String, i32)> = Vec::new();
    if let Some(weeks) = calendar["weeks"].as_array() {
        for week in weeks {
            if let Some(list) = week["contributionDays"].as_array() {
                for day in list {
                    let count = day["contributionCount"].as_i64().unwrap_or(0) as i32;
                    let date = day["date"].as_str().unwrap_or("").to_string();
                    cells.push(count);
                    days.push((date, count));
                }
            }
        }
    }
    let mut streak = 0i64;
    for (_, count) in days.iter().rev() {
        if *count > 0 {
            streak += 1;
        } else if streak > 0 {
            break;
        }
    }
    GithubNow {
        login: viewer["login"].as_str().unwrap_or("").to_string(),
        total: calendar["totalContributions"].as_i64().unwrap_or(0),
        streak,
        cells,
        error: None,
    }
}

pub fn ai_usage_stats(deepseek_key: &str) -> Vec<AiProviderStat> {
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    let mut stats = Vec::new();

    // 1. Claude Code local usage (~/.claude)
    let claude_dir = PathBuf::from(&home).join(".claude");
    if claude_dir.exists() {
        let (today_msgs, week_msgs, top_model) = scan_claude_dir(&claude_dir);
        let pct_5h = ((today_msgs as f32 / 45.0) * 100.0).min(100.0);
        let pct_wk = ((week_msgs as f32 / 300.0) * 100.0).min(100.0);
        stats.push(AiProviderStat {
            id: "claude".into(),
            name: "Claude".into(),
            primary_label: "Session".into(),
            primary_pct: pct_5h,
            primary_meta: format!("{today_msgs} msgs"),
            secondary_label: "Weekly".into(),
            secondary_pct: pct_wk,
            secondary_meta: format!("{week_msgs} msgs"),
            model: top_model,
            detail: "Local ~/.claude activity".into(),
            connected: true,
        });
    } else {
        stats.push(AiProviderStat {
            id: "claude".into(),
            name: "Claude".into(),
            primary_label: "Session".into(),
            primary_pct: 0.0,
            primary_meta: "Not found".into(),
            secondary_label: "Weekly".into(),
            secondary_pct: 0.0,
            secondary_meta: "—".into(),
            model: "No ~/.claude".into(),
            detail: "Install or sign in to Claude Code".into(),
            connected: false,
        });
    }

    // 2. Gemini local usage (~/.gemini)
    let gemini_dir = PathBuf::from(&home).join(".gemini");
    if gemini_dir.exists() {
        let recent_files = count_recent_files(&gemini_dir, 7);
        let today_files = count_recent_files(&gemini_dir, 1);
        stats.push(AiProviderStat {
            id: "gemini".into(),
            name: "Gemini".into(),
            primary_label: "Today".into(),
            primary_pct: ((today_files as f32 / 25.0) * 100.0).min(100.0),
            primary_meta: format!("{today_files} runs"),
            secondary_label: "7d".into(),
            secondary_pct: ((recent_files as f32 / 140.0) * 100.0).min(100.0),
            secondary_meta: format!("{recent_files} runs"),
            model: "Gemini".into(),
            detail: "Local ~/.gemini activity".into(),
            connected: true,
        });
    }

    // 3. Codex / ChatGPT local usage (~/.codex)
    let codex_dir = PathBuf::from(&home).join(".codex");
    if codex_dir.exists() {
        let today_files = count_recent_files(&codex_dir, 1);
        let week_files = count_recent_files(&codex_dir, 7);
        stats.push(AiProviderStat {
            id: "codex".into(),
            name: "ChatGPT".into(),
            primary_label: "5h".into(),
            primary_pct: ((today_files as f32 / 30.0) * 100.0).min(100.0),
            primary_meta: format!("{today_files} runs"),
            secondary_label: "Weekly".into(),
            secondary_pct: ((week_files as f32 / 150.0) * 100.0).min(100.0),
            secondary_meta: format!("{week_files} runs"),
            model: "Codex".into(),
            detail: "Local ~/.codex activity".into(),
            connected: true,
        });
    }

    // 4. DeepSeek Balance (API if key configured)
    if !deepseek_key.trim().is_empty() {
        let res = agent()
            .get("https://api.deepseek.com/user/balance")
            .set("Authorization", &format!("Bearer {}", deepseek_key.trim()))
            .call();
        if let Ok(resp) = res {
            if let Ok(json) = resp.into_json::<serde_json::Value>() {
                let bal = json["balance_infos"][0]["total_balance"]
                    .as_str()
                    .unwrap_or("0.00")
                    .to_string();
                let cur = json["balance_infos"][0]["currency"]
                    .as_str()
                    .unwrap_or("USD")
                    .to_string();
                stats.push(AiProviderStat {
                    id: "deepseek".into(),
                    name: "DeepSeek".into(),
                    primary_label: "Balance".into(),
                    primary_pct: 100.0,
                    primary_meta: format!("{bal} {cur}"),
                    secondary_label: "Status".into(),
                    secondary_pct: if json["is_available"].as_bool().unwrap_or(false) {
                        100.0
                    } else {
                        0.0
                    },
                    secondary_meta: if json["is_available"].as_bool().unwrap_or(false) {
                        "Active".into()
                    } else {
                        "Empty".into()
                    },
                    model: "DeepSeek API".into(),
                    detail: "Live API balance".into(),
                    connected: true,
        });
            }
        }
    }

    stats
}

fn scan_claude_dir(dir: &PathBuf) -> (u32, u32, String) {
    let mut today = 0u32;
    let mut week = 0u32;
    let stats_file = dir.join("stats-cache.json");
    let mut model = "Claude".to_string();
    if let Ok(text) = std::fs::read_to_string(&stats_file) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
            let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
            if let Some(days) = json["dailyActivity"].as_array() {
                for d in days.iter().rev().take(7) {
                    let count = d["messageCount"].as_u64().unwrap_or(0) as u32;
                    week += count;
                    if d["date"].as_str() == Some(&today_str) {
                        today = count;
                    }
                }
            }
            if let Some(models) = json["modelUsage"].as_object() {
                if let Some((best, _)) = models.iter().max_by_key(|(_, v)| {
                    v["outputTokens"].as_u64().unwrap_or(0) + v["inputTokens"].as_u64().unwrap_or(0)
                }) {
                    model = best
                        .replace("claude-", "")
                        .split("-20")
                        .next()
                        .unwrap_or("Claude")
                        .to_string();
                }
            }
            return (today, week, model);
        }
    }
    let today_cnt = count_recent_files(dir, 1);
    let week_cnt = count_recent_files(dir, 7);
    (today_cnt * 4, week_cnt * 4, model)
}

fn count_recent_files(dir: &PathBuf, days: u64) -> u32 {
    let mut count = 0u32;
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(days * 86400))
        .unwrap_or(std::time::UNIX_EPOCH);
    fn walk_count(
        p: &std::path::Path,
        cutoff: std::time::SystemTime,
        count: &mut u32,
        depth: u8,
    ) {
        if depth > 3 || *count > 500 {
            return;
        }
        let Ok(rd) = std::fs::read_dir(p) else {
            return;
        };
        for e in rd.flatten() {
            let path = e.path();
            if path.is_dir() {
                walk_count(&path, cutoff, count, depth + 1);
            } else if let Ok(meta) = e.metadata() {
                if let Ok(mod_time) = meta.modified() {
                    if mod_time >= cutoff {
                        *count += 1;
                    }
                }
            }
        }
    }
    walk_count(dir, cutoff, &mut count, 0);
    count
}

pub fn ical(url: &str) -> Vec<CalEvent> {
    if url.is_empty() {
        return Vec::new();
    }
    let text = match agent().get(url).call() {
        Ok(res) => res.into_string().unwrap_or_default(),
        Err(_) => return Vec::new(),
    };
    parse_ical(&text)
}

pub fn parse_ical(text: &str) -> Vec<CalEvent> {
    let unfolded = text.replace("\r\n ", "").replace("\n ", "");
    let mut events = Vec::new();
    let mut in_event = false;
    let mut summary = String::new();
    let mut start: Option<i64> = None;
    let mut end: Option<i64> = None;
    let mut uid = String::new();
    for line in unfolded.lines() {
        let line = line.trim();
        if line == "BEGIN:VEVENT" {
            in_event = true;
            summary.clear();
            start = None;
            end = None;
            uid.clear();
        } else if line == "END:VEVENT" && in_event {
            if let Some(start_ms) = start {
                events.push(CalEvent {
                    id: if uid.is_empty() {
                        format!("ical-{start_ms}")
                    } else {
                        uid.clone()
                    },
                    title: if summary.is_empty() {
                        "Busy".into()
                    } else {
                        summary.clone()
                    },
                    start_ms,
                    end_ms: end.unwrap_or(start_ms + 3_600_000),
                    source: "calendar".into(),
                });
            }
            in_event = false;
        } else if in_event {
            if let Some(value) = line.strip_prefix("SUMMARY:") {
                summary = value.to_string();
            } else if let Some(value) = line.strip_prefix("UID:") {
                uid = value.to_string();
            } else if let Some(value) = line
                .split_once(':')
                .filter(|(k, _)| k.starts_with("DTSTART"))
                .map(|(_, v)| v)
            {
                start = parse_ical_time(value);
            } else if let Some(value) = line
                .split_once(':')
                .filter(|(k, _)| k.starts_with("DTEND"))
                .map(|(_, v)| v)
            {
                end = parse_ical_time(value);
            }
        }
    }
    let now = Utc::now().timestamp_millis();
    let horizon = now + 1000 * 60 * 60 * 24 * 45;
    events.retain(|event| event.end_ms >= now - 86_400_000 && event.start_ms <= horizon);
    events.sort_by_key(|event| event.start_ms);
    events.truncate(40);
    events
}

fn parse_ical_time(value: &str) -> Option<i64> {
    if value.len() == 8 {
        let date = chrono::NaiveDate::parse_from_str(value, "%Y%m%d").ok()?;
        return Some(date.and_hms_opt(0, 0, 0)?.and_utc().timestamp_millis());
    }
    let stamp = value.trim_end_matches('Z');
    let naive = chrono::NaiveDateTime::parse_from_str(stamp, "%Y%m%dT%H%M%S").ok()?;
    Some(naive.and_utc().timestamp_millis())
}

pub fn city_clocks(zones: &[String]) -> Vec<(String, String, String)> {
    let now = Utc::now();
    zones
        .iter()
        .filter_map(|name| {
            let zone = chrono_tz::Tz::from_str(name).ok()?;
            let local: DateTime<chrono_tz::Tz> = now.with_timezone(&zone);
            let label = name.rsplit('/').next().unwrap_or(name).replace('_', " ");
            let hour = local.hour();
            let hour12 = if hour % 12 == 0 { 12 } else { hour % 12 };
            let text = format!(
                "{hour12}:{:02} {}",
                local.minute(),
                if hour < 12 { "AM" } else { "PM" }
            );
            Some((
                label,
                text,
                format!("{:+}", local.offset().fix().local_minus_utc() / 3600),
            ))
        })
        .collect()
}

fn url_encode(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => out.push(byte as char),
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

pub fn default_city_for_timezone() -> String {
    let name = iana_from_windows();
    match name.as_str() {
        "Europe/London" => "London",
        "Europe/Paris" | "Europe/Berlin" => "Paris",
        "America/New_York" => "New York",
        "America/Chicago" => "Chicago",
        "America/Denver" => "Denver",
        "America/Los_Angeles" => "Los Angeles",
        "Asia/Tokyo" => "Tokyo",
        "Asia/Singapore" => "Singapore",
        "Australia/Sydney" => "Sydney",
        "Africa/Lagos" => "Lagos",
        "Africa/Johannesburg" => "Johannesburg",
        "Africa/Nairobi" => "Nairobi",
        "Africa/Cairo" => "Cairo",
        "Africa/Casablanca" => "Casablanca",
        "Europe/Athens" => "Athens",
        "Europe/Helsinki" => "Helsinki",
        "Europe/Bucharest" => "Bucharest",
        "Europe/Moscow" => "Moscow",
        "Asia/Shanghai" => "Shanghai",
        "Asia/Kolkata" => "Kolkata",
        "Asia/Bangkok" => "Bangkok",
        "Asia/Seoul" => "Seoul",
        "Pacific/Auckland" => "Auckland",
        "America/Bogota" => "Bogota",
        "America/Sao_Paulo" => "Sao Paulo",
        "America/Argentina/Buenos_Aires" => "Buenos Aires",
        "Asia/Riyadh" => "Riyadh",
        "Asia/Dubai" => "Dubai",
        "Asia/Jerusalem" => "Jerusalem",
        "Europe/Istanbul" => "Istanbul",
        _ => "",
    }
    .to_string()
}

fn iana_from_windows() -> String {
    use windows::Win32::System::Time::GetDynamicTimeZoneInformation;
    unsafe {
        let mut info = windows::Win32::System::Time::DYNAMIC_TIME_ZONE_INFORMATION::default();
        if GetDynamicTimeZoneInformation(&mut info) == u32::MAX {
            return String::new();
        }
        let end = info
            .TimeZoneKeyName
            .iter()
            .position(|c| *c == 0)
            .unwrap_or(info.TimeZoneKeyName.len());
        let key = String::from_utf16_lossy(&info.TimeZoneKeyName[..end]);
        match key.as_str() {
            "GMT Standard Time" => "Europe/London",
            "Romance Standard Time" | "W. Europe Standard Time" => "Europe/Paris",
            "Central Europe Standard Time" => "Europe/Berlin",
            "Eastern Standard Time" => "America/New_York",
            "Central Standard Time" => "America/Chicago",
            "Mountain Standard Time" => "America/Denver",
            "Pacific Standard Time" => "America/Los_Angeles",
            "Tokyo Standard Time" => "Asia/Tokyo",
            "Singapore Standard Time" => "Asia/Singapore",
            "AUS Eastern Standard Time" => "Australia/Sydney",
            "W. Central Africa Standard Time" => "Africa/Lagos",
            "South Africa Standard Time" => "Africa/Johannesburg",
            "E. Africa Standard Time" => "Africa/Nairobi",
            "Egypt Standard Time" => "Africa/Cairo",
            "Morocco Standard Time" => "Africa/Casablanca",
            "GTB Standard Time" => "Europe/Athens",
            "FLE Standard Time" => "Europe/Helsinki",
            "E. Europe Standard Time" => "Europe/Bucharest",
            "Russian Standard Time" => "Europe/Moscow",
            "China Standard Time" => "Asia/Shanghai",
            "India Standard Time" => "Asia/Kolkata",
            "SE Asia Standard Time" => "Asia/Bangkok",
            "Korea Standard Time" => "Asia/Seoul",
            "New Zealand Standard Time" => "Pacific/Auckland",
            "SA Pacific Standard Time" => "America/Bogota",
            "SA Eastern Standard Time" => "America/Sao_Paulo",
            "Argentina Standard Time" => "America/Argentina/Buenos_Aires",
            "Arab Standard Time" => "Asia/Riyadh",
            "Arabian Standard Time" => "Asia/Dubai",
            "Israel Standard Time" => "Asia/Jerusalem",
            "Turkey Standard Time" => "Europe/Istanbul",
            _ => "",
        }
        .to_string()
    }
}

#[allow(dead_code)]
pub fn weekday_name(date: chrono::NaiveDate) -> String {
    match date.weekday() {
        chrono::Weekday::Mon => "Mon",
        chrono::Weekday::Tue => "Tue",
        chrono::Weekday::Wed => "Wed",
        chrono::Weekday::Thu => "Thu",
        chrono::Weekday::Fri => "Fri",
        chrono::Weekday::Sat => "Sat",
        chrono::Weekday::Sun => "Sun",
    }
    .into()
}

#[cfg(test)]
mod tests {
    use super::parse_ical;
    use chrono::Utc;

    #[test]
    fn reads_a_basic_event() {
        let day = Utc::now().format("%Y%m%d").to_string();
        let text = format!(
            "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:abc\nSUMMARY:Standup\nDTSTART:{day}T150000Z\nDTEND:{day}T153000Z\nEND:VEVENT\nEND:VCALENDAR\n"
        );
        let events = parse_ical(&text);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].title, "Standup");
        assert_eq!(events[0].id, "abc");
    }
}
