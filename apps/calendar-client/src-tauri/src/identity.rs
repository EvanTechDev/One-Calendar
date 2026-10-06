use std::sync::Mutex;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, WebviewUrl};
use crate::auth::{self, DesktopAuth};

pub const LABEL: &str = "identity";

#[derive(Default)]
pub struct Identity {
    operation: tokio::sync::Mutex<()>,
    owner: Mutex<Option<(String, String)>>,
    bounds: Mutex<Option<Bounds>>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds { x: f64, y: f64, width: f64, height: f64, viewport_width: f64, viewport_height: f64 }
impl Bounds {
    fn valid(&self) -> bool {
        [self.x, self.y, self.width, self.height, self.viewport_width, self.viewport_height].iter().all(|n| n.is_finite() && *n >= 0.0)
            && self.width >= 1.0 && self.height >= 1.0 && self.width <= 10000.0 && self.height <= 10000.0
    }
}

fn allowed(origin: &Url, url: &Url) -> bool {
    url.origin() == origin.origin() && url.username().is_empty() && url.password().is_none()
        && (url.path().starts_with("/oauth/") || url.path().starts_with("/api/auth/")
            || url.path().starts_with("/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/")
            || matches!(url.path(), "/desktop/continue" | "/desktop/settings" | "/reset-password"))
}

pub fn navigation(app: &AppHandle, url: &Url) -> bool {
    let auth = app.state::<DesktopAuth>();
    if url.scheme() == auth.identifier {
        tauri::async_runtime::spawn(auth::callback(app.clone(), url.clone()));
        return false;
    }
    let state = app.state::<Identity>();
    let settings = state.owner.lock().ok().and_then(|owner| owner.clone())
        .map(|(_, mode)| mode == "settings").unwrap_or(false);
    if settings && url.origin() == auth.origin.origin() && matches!(url.path(), "/sign-in" | "/sign-up") {
        tauri::async_runtime::spawn(auth::desktop_sign_out(app.clone()));
        return false;
    }
    allowed(&auth.origin, url)
}

#[tauri::command]
pub async fn desktop_identity_open(app: AppHandle, owner: String, mode: String, section: Option<String>, bounds: Bounds) -> Result<(), String> {
    if !bounds.valid() || owner.len() > 100 || !matches!(mode.as_str(), "sign-in" | "settings") { return Err("Invalid identity view".into()); }
    let state = app.state::<Identity>();
    let _operation = state.operation.lock().await;
    if let Some(view) = app.get_webview(LABEL) { view.close().map_err(|e| e.to_string())?; }
    *state.owner.lock().map_err(|_| "Identity view unavailable")? = Some((owner.clone(), mode.clone()));
    let url = if mode == "sign-in" {
        auth::begin_sign_in(app.clone()).await?
    } else {
        let auth = app.state::<DesktopAuth>();
        let (client, generation) = auth.authorized_client()?;
        let mut destination = auth.origin.join("/desktop/settings").unwrap();
        if let Some(section) = section { destination.query_pairs_mut().append_pair("section", &section); }
        let response = client.post(auth.origin.join("/api/auth/desktop/browser-link").unwrap())
            .header("origin", auth.origin.origin().ascii_serialization())
            .json(&serde_json::json!({"destination": destination.as_str()}))
            .timeout(std::time::Duration::from_secs(20)).send().await.map_err(|_| "Cannot connect to Zentra")?;
        if !response.status().is_success() { return Err("Could not open account settings".into()); }
        let body: serde_json::Value = response.json().await.map_err(|_| "Invalid session response")?;
        let url = Url::parse(body["url"].as_str().ok_or("Missing session link")?).map_err(|_| "Invalid session link")?;
        if !auth.is_current(generation) || url.origin() != auth.origin.origin() || url.path() != "/desktop/continue" { return Err("Session changed".into()); }
        url
    };
    let handle = app.clone();
    let builder = tauri::webview::WebviewBuilder::new(LABEL, WebviewUrl::External(url))
        // No remote IPC capability and no persistent browser cookies.
        .incognito(true)
        .on_page_load(move |_, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished)
                && (payload.url().path().starts_with("/oauth/") || payload.url().path() == "/desktop/settings") {
                let _ = handle.emit_to("main", "desktop-identity-loaded", &owner);
                smoke_loaded(&handle, payload.url().path());
            }
        })
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny);
    #[cfg(target_os = "linux")]
    crate::identity_layout::prepare(&app.get_webview("main").ok_or("Calendar view missing")?).await?;
    let view = app.get_window("main").ok_or("Main window missing")?
        .add_child(builder, LogicalPosition::new(bounds.x, bounds.y), LogicalSize::new(bounds.width, bounds.height))
        .map_err(|e| e.to_string())?;
    place(&view, &bounds, true).await?;
    *state.bounds.lock().map_err(|_| "Identity layout unavailable")? = Some(bounds);
    Ok(())
}

fn smoke_loaded(app: &AppHandle, path: &str) {
    if std::env::var("ZENTRA_SMOKE_TEST").as_deref() != Ok("1") { return; }
    static STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if STARTED.swap(true, std::sync::atomic::Ordering::SeqCst) { return; }
    let app = app.clone();
    let path = path.to_owned();
    tauri::async_runtime::spawn(async move {
        let result: Result<serde_json::Value, String> = async {
            let window = app.get_window("main").ok_or("Main window missing")?;
            crate::desktop_fullscreen(window.clone(), Some(true))?;
            for _ in 0..50 {
                if window.is_fullscreen().unwrap_or(false) { break; }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
            let entered = window.is_fullscreen().map_err(|e| e.to_string())?;
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
            crate::desktop_fullscreen(window.clone(), Some(false))?;
            for _ in 0..50 {
                if !window.is_fullscreen().unwrap_or(true) { break; }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
            for _ in 0..10 {
                crate::fit_window(&window, false).map_err(|e| e.to_string())?;
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
            let identity = app.get_webview(LABEL).ok_or("Identity view missing")?;
            let main = app.get_webview("main").ok_or("Calendar view missing")?;
            let requested = app.state::<Identity>().bounds.lock().map_err(|_| "Identity layout unavailable")?.clone();
            #[cfg(target_os = "linux")]
            let actual = crate::identity_layout::measure(&identity).await?;
            #[cfg(not(target_os = "linux"))]
            let actual = serde_json::json!({"position": identity.position().map_err(|e| e.to_string())?,
                "size": identity.size().map_err(|e| e.to_string())?});
            Ok(serde_json::json!({"path":path,"enteredFullscreen":entered,
                "identityPosition": actual["position"],
                "identitySize": actual["size"],
                "requested": requested,
                "mainSize": main.size().map_err(|e| e.to_string())?,
                "window":crate::desktop_diagnostics(&window).map_err(|e| e.to_string())?}))
        }.await;
        match result {
            Ok(report) => eprintln!("ZENTRA_IDENTITY_SMOKE {report}"),
            Err(error) => eprintln!("ZENTRA_IDENTITY_SMOKE_ERROR {error}"),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_documents_stay_on_the_official_identity_routes() {
        let origin = Url::parse("https://precal.xyehr.cn").unwrap();
        for path in ["/oauth/sign-in", "/oauth/sign-up", "/oauth/reset-password", "/desktop/settings", "/desktop/continue", "/api/auth/oauth2/authorize"] {
            assert!(allowed(&origin, &origin.join(path).unwrap()));
        }
        for url in ["https://calendar.xyehr.cn/oauth/sign-in", "https://precal.xyehr.cn.evil.test/oauth/sign-in", "https://user@precal.xyehr.cn/oauth/sign-in", "https://precal.xyehr.cn/app", "https://precal.xyehr.cn/account", "tauri://localhost/"] {
            assert!(!allowed(&origin, &Url::parse(url).unwrap()));
        }
    }
}

#[tauri::command]
pub async fn desktop_identity_bounds(app: AppHandle, owner: String, bounds: Bounds, visible: bool) -> Result<(), String> {
    let state = app.state::<Identity>();
    let _operation = state.operation.lock().await;
    if !bounds.valid() || state.owner.lock().map_err(|_| "Identity view unavailable")?.as_ref().map(|v| &v.0) != Some(&owner) { return Ok(()); }
    if let Some(view) = app.get_webview(LABEL) {
        place(&view, &bounds, visible).await?;
        *state.bounds.lock().map_err(|_| "Identity layout unavailable")? = Some(bounds);
    }
    Ok(())
}

async fn place(view: &tauri::Webview, bounds: &Bounds, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    return crate::identity_layout::place(view, bounds.x.round() as i32, bounds.y.round() as i32,
        bounds.width.round() as i32, bounds.height.round() as i32, visible).await;
    #[cfg(not(target_os = "linux"))]
    {
        if visible {
            view.set_position(LogicalPosition::new(bounds.x, bounds.y)).map_err(|e| e.to_string())?;
            view.set_size(LogicalSize::new(bounds.width, bounds.height)).map_err(|e| e.to_string())?;
            view.show().map_err(|e| e.to_string())?;
        } else { view.hide().map_err(|e| e.to_string())?; }
        Ok(())
    }
}

#[tauri::command]
pub async fn desktop_identity_close(app: AppHandle, owner: String) -> Result<(), String> {
    let state = app.state::<Identity>();
    let _operation = state.operation.lock().await;
    let previous = {
        let mut current = state.owner.lock().map_err(|_| "Identity view unavailable")?;
        if current.as_ref().map(|v| &v.0) != Some(&owner) { return Ok(()); }
        current.take()
    };
    if let Some(view) = app.get_webview(LABEL) { view.close().map_err(|e| e.to_string())?; }
    if previous.map(|(_, mode)| mode == "sign-in").unwrap_or(false) { auth::desktop_cancel_sign_in(app.clone())?; }
    else if app.state::<DesktopAuth>().authorized_client().is_ok() {
        // Profile/email/2FA edits happen through the same-origin account form.
        // Refresh the independent native session after that surface closes.
        tauri::async_runtime::spawn(auth::desktop_session(app.clone()));
    }
    Ok(())
}
