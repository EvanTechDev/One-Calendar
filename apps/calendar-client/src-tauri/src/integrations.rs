use futures_util::StreamExt;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use crate::auth::DesktopAuth;

#[derive(serde::Deserialize)]
struct BrowserPages {
    paths: Vec<String>,
    prefixes: Vec<String>,
}

fn supports_handoff(path: &str) -> bool {
    static PAGES: std::sync::OnceLock<BrowserPages> = std::sync::OnceLock::new();
    let pages = PAGES.get_or_init(|| serde_json::from_str(include_str!(
        "../../../../packages/auth/src/browser-pages.json"
    )).expect("Bundled browser-page policy must be valid"));
    pages.paths.iter().any(|value| value == path)
        || pages.prefixes.iter().any(|prefix| path.starts_with(prefix))
}

#[tauri::command]
pub async fn desktop_open_page(app: AppHandle, destination: String) -> Result<(), String> {
    let auth = app.state::<DesktopAuth>();
    let url = auth.origin.join(&destination).map_err(|_| "Invalid destination")?;
    if url.origin() != auth.origin.origin() || !url.username().is_empty() || url.password().is_some() {
        return Err("Not an official calendar page".into());
    }
    let handoff = supports_handoff(url.path());
    let target = if handoff {
        if let Ok((client, generation)) = auth.authorized_client() {
            let response = client.post(auth.origin.join("/api/auth/desktop/browser-link").unwrap())
                .header("origin", auth.origin.origin().ascii_serialization())
                .json(&serde_json::json!({ "destination": url.as_str() }))
                .timeout(Duration::from_secs(20)).send().await.map_err(|_| "Cannot connect to Zentra")?;
            if !response.status().is_success() { return Err("Could not open a browser session. Please retry.".into()); }
            let value: serde_json::Value = response.json().await.map_err(|_| "Invalid browser session response")?;
            if !auth.is_current(generation) { return Err("Session changed".into()); }
            let link = value.get("url").and_then(|v| v.as_str()).ok_or("Missing browser link")?;
            let link = reqwest::Url::parse(link).map_err(|_| "Invalid browser link")?;
            if link.origin() != auth.origin.origin() || link.path() != "/desktop/continue" {
                return Err("Invalid browser link".into());
            }
            link
        } else { url }
    } else { url };
    app.opener().open_url(target.as_str(), None::<&str>).map_err(|_| "Could not open your browser".into())
}

#[tauri::command]
pub async fn desktop_save_file(app: AppHandle, name: String, content: String) -> Result<bool, String> {
    if content.len() > 20 * 1024 * 1024 { return Err("Export is too large".into()); }
    let name = std::path::Path::new(&name).file_name().and_then(|v| v.to_str())
        .unwrap_or("calendar.ics").to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = app.dialog().file().set_file_name(name).blocking_save_file() else { return Ok(false); };
        let path = path.into_path().map_err(|_| "Unsupported file destination")?;
        std::fs::write(path, content).map(|_| true)
            .map_err(|_| "Could not save the file. Choose a writable folder.".to_string())
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn desktop_read_external(url: String) -> Result<String, String> {
    let url = reqwest::Url::parse(&url).map_err(|_| "Invalid calendar URL")?;
    if !matches!(url.scheme(), "https" | "http") || !url.username().is_empty() || url.password().is_some() {
        return Err("Use an HTTP or HTTPS calendar URL".into());
    }
    // A separate client intentionally carries no Zentra cookies or authorization.
    let client = reqwest::Client::builder().timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(5)).build().map_err(|e| e.to_string())?;
    let response = client.get(url).send().await.map_err(|_| "Could not download the calendar")?
        .error_for_status().map_err(|_| "The calendar URL returned an error")?;
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "Calendar download was interrupted")?;
        if bytes.len() + chunk.len() > 20 * 1024 * 1024 { return Err("Calendar file exceeds 20 MB".into()); }
        bytes.extend_from_slice(&chunk);
    }
    String::from_utf8(bytes).map_err(|_| "Calendar file is not UTF-8 text".into())
}

#[tauri::command]
pub fn desktop_notification_permission(app: AppHandle) -> Result<bool, String> {
    app.notification().request_permission()
        .map(|permission| permission == tauri_plugin_notification::PermissionState::Granted)
        .map_err(|error| error.to_string())
}
