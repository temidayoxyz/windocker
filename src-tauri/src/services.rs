use std::str::FromStr;

use chrono::{DateTime, Datelike, Offset, Timelike, Utc};

use crate::model::{CalEvent, CurrencyNow, DayPoint, GithubNow, HourPoint, WeatherNow};

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
            hi: 0.0,
            lo: 0.0,
            hourly: Vec::new(),
            daily: Vec::new(),
            error: Some("Choose a city.".into()),
        };
    }
    let encoded = url_encode(query.trim());
    let geo_url = format!("https://geocoding-api.open-meteo.com/v1/search?name={encoded}&count=1&language=en&format=json");
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
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4"
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
            let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(text, "%Y-%m-%dT%H:%M") else { continue };
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
    WeatherNow {
        city,
        temp_c: current["temperature_2m"].as_f64().unwrap_or(0.0) as f32,
        code: current["weather_code"].as_i64().unwrap_or(0) as i32,
        wind: current["wind_speed_10m"].as_f64().unwrap_or(0.0) as f32,
        hi: daily.first().map(|d| d.hi).unwrap_or(0.0),
        lo: daily.first().map(|d| d.lo).unwrap_or(0.0),
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
        hi: 0.0,
        lo: 0.0,
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
                CurrencyNow { from, to, rate: 0.0, amount, error: Some("That pair is not available.".into()) }
            } else {
                CurrencyNow { from, to, rate, amount, error: None }
            }
        }
        Err(err) => CurrencyNow { from, to, rate: 0.0, amount, error: Some(err.to_string()) },
    }
}

pub fn github(token: &str) -> GithubNow {
    if token.trim().is_empty() {
        return GithubNow { login: String::new(), total: 0, streak: 0, cells: Vec::new(), error: Some("Add a GitHub token.".into()) };
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
            return GithubNow { login: String::new(), total: 0, streak: 0, cells: Vec::new(), error: Some(err.to_string()) };
        }
    };
    if let Some(message) = body["errors"][0]["message"].as_str() {
        return GithubNow { login: String::new(), total: 0, streak: 0, cells: Vec::new(), error: Some(message.to_string()) };
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
                    id: if uid.is_empty() { format!("ical-{start_ms}") } else { uid.clone() },
                    title: if summary.is_empty() { "Busy".into() } else { summary.clone() },
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
            } else if let Some(value) = line.split_once(':').filter(|(k, _)| k.starts_with("DTSTART")).map(|(_, v)| v) {
                start = parse_ical_time(value);
            } else if let Some(value) = line.split_once(':').filter(|(k, _)| k.starts_with("DTEND")).map(|(_, v)| v) {
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
            let text = format!("{hour12}:{:02} {}", local.minute(), if hour < 12 { "AM" } else { "PM" });
            Some((label, text, format!("{:+}", local.offset().fix().local_minus_utc() / 3600)))
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
        let end = info.TimeZoneKeyName.iter().position(|c| *c == 0).unwrap_or(info.TimeZoneKeyName.len());
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

    #[test]
    fn reads_a_basic_event() {
        let text = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:abc\nSUMMARY:Standup\nDTSTART:20261120T150000Z\nDTEND:20261120T153000Z\nEND:VEVENT\nEND:VCALENDAR\n";
        let events = parse_ical(text);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].title, "Standup");
        assert_eq!(events[0].id, "abc");
    }
}
