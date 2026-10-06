use serde::Serialize;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Url, WindowEvent};
use tauri_plugin_opener::OpenerExt;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopConfig {
    environment: String,
    api_origin: String,
    app_name: String,
    version: String,
}

#[tauri::command]
fn desktop_config(config: tauri::State<'_, DesktopConfig>) -> DesktopConfig {
    config.inner().clone()
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
    let width = ((1200.0 * scale).round() as u32).min(available.width);
    let height = ((720.0 * scale).round() as u32).min(available.height);
    PhysicalSize::new(
        width.saturating_sub(frame.width).max(1),
        height.saturating_sub(frame.height).max(1),
    )
}

fn fit_window(window: &tauri::WebviewWindow, center: bool) -> tauri::Result<()> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri::plugin::Builder::new("desktop-navigation")
                .on_navigation(|webview, url| {
                    if local_navigation(url) {
                        return true;
                    }
                    if matches!(url.scheme(), "https" | "http" | "mailto") {
                        let _ = open_external(webview.app_handle().clone(), url.to_string());
                    }
                    false
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![desktop_config, open_external])
        .setup(|app| {
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
            let window = app
                .get_webview_window("main")
                .ok_or("Main window is missing")?;
            window.set_title(&name)?;
            fit_window(&window, true)?;
            window.show()?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(
                event,
                WindowEvent::Moved(_)
                    | WindowEvent::Resized(_)
                    | WindowEvent::ScaleFactorChanged { .. }
            ) {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    let _ = fit_window(&webview, false);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Zentra Calendar");
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
            PhysicalSize::new(1784, 1040),
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
}
