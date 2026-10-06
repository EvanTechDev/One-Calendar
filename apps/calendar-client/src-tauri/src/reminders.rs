use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{collections::HashMap, io::Cursor, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Notify;

#[derive(Default)]
pub struct Reminders { wake: Notify }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Reminder { key: String, due_at: u64, deadline: u64, title: String, description: Option<String> }
#[derive(Deserialize)]
struct Feed { reminders: Vec<Reminder> }

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

pub fn refresh(app: &AppHandle) {
    if let Some(state) = app.try_state::<Reminders>() { state.wake.notify_one(); }
}

// The OS notification is silent on all three platforms; this bundled sound is
// the sole audio source. A failed/blocked delivery still counts as Fired.
fn deliver(app: &AppHandle, reminder: &Reminder) {
    let mut notification = notify_rust::Notification::new();
    notification.summary(&reminder.title).body(reminder.description.as_deref().unwrap_or(""));
    #[cfg(target_os = "linux")]
    notification.hint(notify_rust::Hint::SuppressSound(true));
    #[cfg(target_os = "windows")]
    notification.app_id(&app.config().identifier);
    #[cfg(target_os = "macos")]
    let _ = notify_rust::set_application(&app.config().identifier);
    if notification.show().is_err() { eprintln!("System reminder delivery failed"); }
    let _ = app.emit("desktop-reminder", serde_json::json!({ "title": reminder.title }));
    if let Ok(stream) = rodio::OutputStreamBuilder::open_default_stream() {
        let bytes = include_bytes!("../../../../packages/calendar-ui/assets/reminder.wav");
        if let Ok(sink) = rodio::play(stream.mixer(), Cursor::new(bytes.as_slice())) {
            sink.sleep_until_end();
        }
    }
}

async fn reconcile(app: &AppHandle) -> Result<Duration, String> {
    let auth = app.state::<crate::auth::DesktopAuth>();
    let (client, generation) = match auth.authorized_client() {
        Ok(value) => value,
        Err(_) => return Ok(Duration::from_secs(60)),
    };
    let user = auth.snapshot()?.user.ok_or("Session ended")?;
    let response = client.get(auth.origin.join("/api/events?delivery=desktop-reminders").unwrap())
        .timeout(Duration::from_secs(20)).send().await.map_err(|_| "Reminder service unavailable")?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        crate::auth::invalidate(app, generation).await;
        return Ok(Duration::from_secs(60));
    }
    let feed: Feed = response.error_for_status().map_err(|_| "Reminder service unavailable")?
        .json().await.map_err(|_| "Invalid reminder response")?;
    if !auth.is_current(generation) { return Ok(Duration::from_secs(60)); }
    let scope = format!("{:x}", Sha256::digest(format!("{}\0{}", auth.origin, user.id)));
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?.join("reminders");
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        let path = directory.join(format!("{scope}.json"));
        let mut fired: HashMap<String, u64> = match std::fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| "Reminder history is unreadable".to_string())?,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => HashMap::new(),
            Err(error) => return Err(error.to_string()),
        };
        let now = now_ms();
        // Values are expiry instants, not delivery instants: a seven-day lead
        // must remain Fired until its full catch-up window has closed.
        fired.retain(|_, expires_at| *expires_at > now);
        let mut next = 60_000;
        for reminder in feed.reminders {
            let now = now_ms();
            if reminder.deadline <= now || reminder.due_at >= reminder.deadline { continue; }
            if reminder.due_at > now { next = next.min(reminder.due_at - now); continue; }
            let key = format!("{:x}", Sha256::digest(reminder.key.as_bytes()));
            if fired.contains_key(&key) { continue; }
            let auth = handle.state::<crate::auth::DesktopAuth>();
            if !auth.is_current(generation) { break; }
            fired.insert(key, reminder.deadline.max(now.saturating_add(86_400_000)));
            let temporary = path.with_extension("tmp");
            std::fs::write(&temporary, serde_json::to_vec(&fired).map_err(|error| error.to_string())?)
                .and_then(|_| std::fs::rename(&temporary, &path)).map_err(|error| error.to_string())?;
            if auth.is_current(generation) { deliver(&handle, &reminder); }
        }
        Ok(Duration::from_millis(next.max(1_000)))
    }).await.map_err(|error| error.to_string())?
}

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            // Never deliver an old cached schedule while offline. Every pass
            // reconciles edits/deletions against the authenticated server feed.
            let delay = match reconcile(&app).await {
                Ok(delay) => delay,
                Err(error) => {
                    eprintln!("{error}");
                    Duration::from_secs(60)
                }
            };
            let state = app.state::<Reminders>();
            tokio::select! { _ = tokio::time::sleep(delay) => {}, _ = state.wake.notified() => {} }
        }
    });
}
