use serde::Serialize;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Url, WindowEvent};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_deep_link::DeepLinkExt;
mod auth;
mod transport;
mod integrations;
mod identity;
#[cfg(target_os = "linux")]
mod identity_layout;
#[cfg(target_os = "linux")]
mod protocol;
mod updates;
mod reminders;
#[cfg(feature = "acceptance")]
mod acceptance;

pub fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState}};
    let open = MenuItem::with_id(app, "open", "Open calendar", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let fullscreen = MenuItem::with_id(app, "fullscreen", "Toggle full screen", true, Some("F11"))?;
    let menu = Menu::with_items(app, &[&open, &fullscreen, &quit])?;
    let mut tray = TrayIconBuilder::new().menu(&menu).show_menu_on_left_click(false)
        .tooltip(app.config().product_name.as_deref().unwrap_or("Zentra Calendar"))
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "fullscreen" => { if let Some(window) = app.get_window("main") { let _ = desktop_fullscreen(window, None); } }
            "quit" => { transport::cancel_all(app); app.exit(0); }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(event, TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }) {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
    tray.build(app)?;
    Ok(())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopConfig {
    environment: String,
    api_origin: String,
    app_name: String,
    version: String,
}

#[tauri::command]
async fn desktop_config(
    window: tauri::Window,
    config: tauri::State<'_, DesktopConfig>,
) -> Result<DesktopConfig, String> {
    // X11 decoration extents can arrive after the first map without a content
    // resize event. Reconcile on the live window, yielding for the WM to apply it.
    for _ in 0..3 {
        fit_window(&window, false).map_err(|error| error.to_string())?;
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    // External CI can observe a real frontend -> IPC round trip without adding
    // test-only commands or exposing credentials. Ordinary launches stay quiet.
    if matches!(std::env::var("ZENTRA_SMOKE_TEST").as_deref(), Ok("1")) {
        let diagnostics = desktop_diagnostics(&window).map_err(|error| {
            eprintln!("ZENTRA_DESKTOP_SMOKE_ERROR {error}");
            error.to_string()
        })?;
        eprintln!(
            "ZENTRA_DESKTOP_SMOKE {}",
            serde_json::json!({
                "environment": config.environment,
                "apiOrigin": config.api_origin,
                "identifier": window.app_handle().config().identifier,
                "window": diagnostics,
            })
        );
    }
    #[cfg(feature = "acceptance")]
    acceptance::start(window.app_handle().clone());
    Ok(config.inner().clone())
}

fn desktop_diagnostics(window: &tauri::Window) -> tauri::Result<serde_json::Value> {
    let outer = window.outer_size()?;
    let inner = window.inner_size()?;
    let work = window
        .current_monitor()?
        .or(window.primary_monitor()?)
        .map(|monitor| {
            let work = monitor.work_area();
            serde_json::json!({ "width": work.size.width, "height": work.size.height })
        });
    // Tauri documents the native maximize-button getter as unsupported on
    // Linux. The Linux smoke test checks the window manager's actual state.
    #[cfg(target_os = "linux")]
    let maximizable: Option<bool> = None;
    #[cfg(not(target_os = "linux"))]
    let maximizable = Some(window.is_maximizable()?);
    Ok(serde_json::json!({
        "outer": { "width": outer.width, "height": outer.height },
        "inner": { "width": inner.width, "height": inner.height },
        "workArea": work,
        "scaleFactor": window.scale_factor()?,
        "resizable": window.is_resizable()?,
        "maximizable": maximizable,
        "visible": window.is_visible()?,
        "fullscreen": window.is_fullscreen()?,
    }))
}

#[tauri::command]
fn open_external(app: tauri::AppHandle, destination: String) -> Result<(), String> {
    let url = Url::parse(&destination).map_err(|error| error.to_string())?;
    if !matches!(url.scheme(), "https" | "http" | "mailto")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Unsupported external URL".into());
    }
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|error| error.to_string())
}

fn content_size(
    scale: f64,
    frame: PhysicalSize<u32>,
    available: PhysicalSize<u32>,
) -> PhysicalSize<u32> {
    let width = ((1320.0 * scale).round() as u32).min(available.width);
    let height = ((880.0 * scale).round() as u32).min(available.height);
    PhysicalSize::new(
        width.saturating_sub(frame.width).max(1),
        height.saturating_sub(frame.height).max(1),
    )
}

fn fit_window(window: &tauri::Window, center: bool) -> tauri::Result<()> {
    if window.is_fullscreen()? { return Ok(()); }
    let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) else {
        return Ok(());
    };
    let outer = window.outer_size()?;
    let inner = window.inner_size()?;
    let frame = PhysicalSize::new(
        outer.width.saturating_sub(inner.width),
        outer.height.saturating_sub(inner.height),
    );
    let work = monitor.work_area();
    let desired = content_size(window.scale_factor()?, frame, work.size);
    if inner != desired {
        // GTK clamps non-resizable windows to at least their default size
        // (gtk_window_update_fixed_size). Tao's set_size only calls resize,
        // so reducing the content area for mapped decorations also requires
        // replacing that default. Keep the window non-resizable throughout.
        #[cfg(target_os = "linux")]
        {
            let logical = desired.to_logical::<i32>(window.scale_factor()?);
            let native = window.clone();
            window.run_on_main_thread(move || {
                use gtk::prelude::GtkWindowExt;
                match native.gtk_window() {
                    Ok(gtk) => {
                        gtk.set_default_size(logical.width, logical.height);
                        gtk.resize(logical.width, logical.height);
                    }
                    Err(error) => eprintln!("Could not adjust fixed GTK window size: {error}"),
                }
            })?;
        }
        #[cfg(not(target_os = "linux"))]
        window.set_size(desired)?;
    }
    if center {
        let outer_width = desired.width + frame.width;
        let outer_height = desired.height + frame.height;
        // Wayland compositors own placement and may decline this request.
        let _ = window.set_position(PhysicalPosition::new(
            work.position.x + work.size.width.saturating_sub(outer_width) as i32 / 2,
            work.position.y + work.size.height.saturating_sub(outer_height) as i32 / 2,
        ));
    }
    Ok(())
}

fn local_navigation(url: &Url) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let assets = (url.scheme() == "tauri"
        && url.host_str() == Some("localhost")
        && url.port().is_none())
        || (matches!(url.scheme(), "http" | "https")
            && url.host_str() == Some("tauri.localhost")
            && url.port().is_none());
    let development = cfg!(debug_assertions)
        && url.scheme() == "http"
        && matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
        && url.port() == Some(1420);
    assets || development
}

fn bundled_page(url: &Url) -> bool {
    local_navigation(url) && matches!(url.path(), "" | "/" | "/index.html" | "/app" | "/app/")
}

fn route_browser_link(app: tauri::AppHandle, mut url: Url) {
    if local_navigation(&url) {
        let Some(config) = app.try_state::<DesktopConfig>() else { return };
        let Ok(mut official) = Url::parse(&config.api_origin) else { return };
        official.set_path(url.path());
        official.set_query(url.query());
        official.set_fragment(url.fragment());
        url = official;
    }
    if !matches!(url.scheme(), "https" | "http" | "mailto") { return; }
    tauri::async_runtime::spawn(async move {
        let official = app.try_state::<auth::DesktopAuth>()
            .map(|auth| url.origin() == auth.origin.origin()).unwrap_or(false);
        let result = if official {
            integrations::desktop_open_page(app, url.to_string()).await
        } else {
            open_external(app, url.to_string())
        };
        if result.is_err() { eprintln!("Failed to open a browser link"); }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let application = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            startup_trace("second instance callback started");
            show_main(app);
            startup_trace("second instance callback returned");
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(transport::Requests::default())
        .manage(updates::UpdateState::default())
        .manage(reminders::Reminders::default())
        .manage(identity::Identity::default())
        .plugin(
            tauri::plugin::Builder::<tauri::Wry, ()>::new("desktop-navigation")
                .on_navigation(|webview, url| {
                    startup_trace(&format!("navigation {} {} allowed={}", url.origin().ascii_serialization(), url.path(), bundled_page(url)));
                    if webview.label() == identity::LABEL {
                        return identity::navigation(webview.app_handle(), url);
                    }
                    if bundled_page(url) {
                        return true;
                    }
                    route_browser_link(webview.app_handle().clone(), url.clone());
                    false
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            desktop_config, desktop_startup_error, open_external,
            desktop_fullscreen, identity::desktop_identity_open, identity::desktop_identity_bounds, identity::desktop_identity_close,
            integrations::desktop_connection,
            auth::desktop_session, auth::desktop_cancel_sign_in,
            auth::desktop_sign_out, transport::desktop_request, transport::desktop_cancel_request,
            integrations::desktop_open_page, integrations::desktop_save_file,
            integrations::desktop_read_external, integrations::desktop_notification_permission,
            updates::desktop_check_update, updates::desktop_install_update,
        ])
        .setup(|app| {
            startup_trace("setup started");
            let environment = option_env!("ZENTRA_DESKTOP_ENV").unwrap_or("production");
            if !matches!(environment, "dev" | "production") {
                return Err("ZENTRA_DESKTOP_ENV must be dev or production".into());
            }
            let expected_id = if environment == "dev" {
                "app.zntr.calendar.dev"
            } else {
                "app.zntr.calendar"
            };
            if app.config().identifier != expected_id {
                return Err("Desktop environment and application identifier do not match".into());
            }
            let default_origin = if environment == "dev" {
                "https://precal.xyehr.cn"
            } else {
                "https://calendar.xyehr.cn"
            };
            let origin = Url::parse(option_env!("ZENTRA_API_ORIGIN").unwrap_or(default_origin))?;
            if origin.scheme() != "https"
                || !origin.username().is_empty()
                || origin.password().is_some()
                || origin.path() != "/"
                || origin.query().is_some()
                || origin.fragment().is_some()
            {
                return Err("ZENTRA_API_ORIGIN must be an HTTPS origin".into());
            }
            let name = app
                .config()
                .product_name
                .clone()
                .unwrap_or("Zentra Calendar".into());
            app.manage(DesktopConfig {
                environment: environment.into(),
                api_origin: origin.origin().ascii_serialization(),
                app_name: name.clone(),
                version: app.package_info().version.to_string(),
            });
            app.manage(auth::DesktopAuth::new(origin.as_str(), expected_id, environment == "dev", app.path().app_data_dir()?)?);
            let window_config = app.config().app.windows.iter()
                .find(|window| window.label == "main").ok_or("Main window configuration is missing")?.clone();
            let browser = app.handle().clone();
            tauri::WebviewWindowBuilder::from_config(app, &window_config)?
                .on_new_window(move |url, _| {
                    route_browser_link(browser.clone(), url);
                    tauri::webview::NewWindowResponse::Deny
                })
                .build()?;
            startup_trace("webview created");
            setup_tray(app)?;
            startup_trace("tray created");
            reminders::start(app.handle().clone());
            #[cfg(target_os = "linux")]
            protocol::register(app.handle())?;
            #[cfg(all(debug_assertions, target_os = "windows"))]
            app.deep_link().register_all().map_err(|error| {
                std::io::Error::other(format!("Could not register desktop login links: {error}"))
            })?;
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    tauri::async_runtime::spawn(auth::callback(handle.clone(), url));
                }
            });
            let window = app
                .get_window("main")
                .ok_or("Main window is missing")?;
            window.set_title(&name)?;
            fit_window(&window, true)?;
            window.show()?;
            startup_trace("window shown");
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Focused(true)) {
                reminders::refresh(window.app_handle());
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            if matches!(
                event,
                WindowEvent::Focused(true)
                    | WindowEvent::Moved(_)
                    | WindowEvent::Resized(_)
                    | WindowEvent::ScaleFactorChanged { .. }
            ) {
                if window.is_fullscreen().unwrap_or(false) { return; }
                if window.is_maximized().unwrap_or(false) {
                    if let Err(error) = window.unmaximize() {
                        eprintln!("Failed to restore the fixed-size window: {error}");
                    }
                    return;
                }
                if let Err(error) = fit_window(window, false) {
                    eprintln!("Failed to adapt the desktop window: {error}");
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running Zentra Calendar");
    application.run(|_app, _event| {
        #[cfg(target_os = "macos")]
        if matches!(_event, tauri::RunEvent::Reopen { .. }) {
            show_main(_app);
        }
    });
}

fn startup_trace(message: &str) {
    if std::env::var_os("ZENTRA_SMOKE_TEST").is_some()
        || std::env::var_os("ZENTRA_UPDATE_ACCEPTANCE_REPORT").is_some() {
        eprintln!("ZENTRA_STARTUP {:?}", message.chars().take(2000).collect::<String>());
    }
}

#[tauri::command]
fn desktop_startup_error(message: String) {
    startup_trace(&format!("frontend import failed: {message}"));
}

#[tauri::command]
fn desktop_fullscreen(window: tauri::Window, enabled: Option<bool>) -> Result<(), String> {
    let full = enabled.unwrap_or(!window.is_fullscreen().map_err(|e| e.to_string())?);
    window.set_fullscreen(full).map_err(|e| e.to_string())?;
    if !full { fit_window(&window, false).map_err(|e| e.to_string())?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn includes_window_decorations_in_the_logical_size() {
        assert_eq!(
            content_size(
                1.5,
                PhysicalSize::new(16, 40),
                PhysicalSize::new(2560, 1440),
            ),
            PhysicalSize::new(1964, 1280),
        );
    }

    #[test]
    fn fits_the_available_work_area() {
        assert_eq!(
            content_size(
                1.5,
                PhysicalSize::new(16, 40),
                PhysicalSize::new(1600, 900),
            ),
            PhysicalSize::new(1584, 860),
        );
    }

    #[test]
    fn keeps_remote_pages_outside_the_application_webview() {
        assert!(local_navigation(&Url::parse("tauri://localhost/app").unwrap()));
        assert!(local_navigation(
            &Url::parse("http://tauri.localhost/app").unwrap()
        ));
        for address in [
            "https://calendar.xyehr.cn/app",
            "https://tauri.localhost.example.com/app",
            "file:///etc/passwd",
            "javascript:alert(1)",
        ] {
            assert!(!local_navigation(&Url::parse(address).unwrap()));
        }
    }

    #[test]
    fn only_bundled_app_documents_stay_inside_the_webview() {
        assert!(bundled_page(&Url::parse("tauri://localhost").unwrap()));
        assert!(bundled_page(&Url::parse("tauri://localhost/").unwrap()));
        assert!(bundled_page(&Url::parse("http://tauri.localhost/app?date=2026-10-06").unwrap()));
        for path in ["/account", "/home", "/sign-in", "/invite/example"] {
            assert!(!bundled_page(&Url::parse(&format!("tauri://localhost{path}")).unwrap()));
        }
    }
}
