// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window");
            // Navigation allowlist: the hosted app origin only. No OAuth IdP hosts
            // are allowed — the hosted app enables no social providers (see
            // README.md "Capability grants"). No localhost exception: devUrl points
            // at production; add one only if a local devUrl is ever configured.
            window.on_navigation(|url| {
                let host = url.host_str().unwrap_or("");
                let allowed =
                    host == "calendar.xyehr.cn" || host.ends_with(".calendar.xyehr.cn");
                allowed && url.scheme() == "https"
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
