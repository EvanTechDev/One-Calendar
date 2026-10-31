use serde::Serialize;
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct UpdateState {
    update: Mutex<Option<Update>>,
    busy: AtomicBool,
}

struct Busy<'a>(&'a AtomicBool);
impl Drop for Busy<'_> {
    fn drop(&mut self) { self.0.store(false, Ordering::SeqCst); }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo { version: String, notes: Option<String> }

#[tauri::command]
pub async fn desktop_check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let state = app.state::<UpdateState>();
    if state.busy.swap(true, Ordering::SeqCst) { return Err("An update operation is already running".into()); }
    let _busy = Busy(&state.busy);
    let key = option_env!("ZENTRA_UPDATER_PUBLIC_KEY").filter(|value| !value.is_empty())
        .ok_or("Updates are not configured in this build. Install a signed release build to enable updates.")?;
    let channel = if option_env!("ZENTRA_DESKTOP_ENV") == Some("dev") { "desktop-dev" } else { "desktop-stable" };
    let endpoint = format!("https://github.com/EvanTechDev/One-Calendar/releases/download/{channel}/latest.json")
        .parse().map_err(|_| "Invalid updater endpoint")?;
    #[cfg(feature = "acceptance")]
    let endpoint = crate::acceptance::endpoint(&app, endpoint)?;
    let updater = app.updater_builder().pubkey(key).endpoints(vec![endpoint])
        .map_err(|error| error.to_string())?.build().map_err(|error| error.to_string())?;
    let update = updater.check().await.map_err(|error| format!("Could not check for updates: {error}"))?;
    let info = update.as_ref().map(|value| UpdateInfo { version: value.version.clone(), notes: value.body.clone() });
    *state.update.lock().map_err(|_| "Updater state is unavailable")? = update;
    Ok(info)
}

#[tauri::command]
pub async fn desktop_install_update(app: AppHandle) -> Result<(), String> {
    let state = app.state::<UpdateState>();
    if state.busy.swap(true, Ordering::SeqCst) { return Err("An update operation is already running".into()); }
    let _busy = Busy(&state.busy);
    let update = state.update.lock().map_err(|_| "Updater state is unavailable")?.take()
        .ok_or("Check for updates before installing")?;
    let mut downloaded = 0_u64;
    update.download_and_install(|length, total| {
        downloaded += length as u64;
        let _ = app.emit("desktop-update-progress", serde_json::json!({ "downloaded": downloaded, "total": total }));
    }, || { let _ = app.emit("desktop-update-installing", ()); })
        .await.map_err(|error| format!("Update was not installed: {error}. Check for updates to retry."))?;
    crate::transport::cancel_all(&app);
    app.restart();
}
