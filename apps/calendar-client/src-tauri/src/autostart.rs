use tauri_plugin_autostart::ManagerExt;

pub const ARGUMENT: &str = "--autostart";

#[tauri::command]
pub fn desktop_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn desktop_set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    }
    .map_err(|error| error.to_string())?;
    launcher.is_enabled().map_err(|error| error.to_string())
}
