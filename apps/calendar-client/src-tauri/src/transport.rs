use std::{collections::HashMap, sync::Mutex, time::{Duration, Instant}};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{future::{AbortHandle, Abortable}, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, AppHandle, Manager, State};
use crate::auth::{self, DesktopAuth};

#[derive(Default)]
pub struct Requests(Mutex<RequestRegistry>);

#[derive(Default)]
struct RequestRegistry {
    pending: HashMap<String, AbortHandle>,
    cancelled: HashMap<String, Instant>,
}

impl RequestRegistry {
    fn prune(&mut self) {
        self.cancelled.retain(|_, at| at.elapsed() < Duration::from_secs(60));
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequest {
    id: String,
    path: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ApiEvent {
    Headers { status: u16, headers: HashMap<String, String> },
    Chunk { data: String },
    End,
    Error { message: String },
}

fn target(auth: &DesktopAuth, path: &str) -> Result<reqwest::Url, String> {
    if !path.starts_with("/api/") || path.starts_with("//") || path.contains('\\') || path.contains('#') {
        return Err("Only calendar API paths are allowed".into());
    }
    let url = auth.origin.join(path).map_err(|_| "Invalid API path")?;
    // Authentication is a separate native capability. Its raw responses may
    // contain session tokens, so they must never cross this generic bridge.
    if url.origin() != auth.origin.origin() || !url.path().starts_with("/api/")
        || url.path().starts_with("/api/auth") || url.path().contains('%')
        || url.path().starts_with("/api/desktop") || url.path().trim_end_matches('/') == "/api/mcp" {
        return Err("This API is not available through the calendar bridge".into());
    }
    Ok(url)
}

#[tauri::command]
pub fn desktop_cancel_request(id: String, requests: State<'_, Requests>) {
    if id.is_empty() || id.len() > 100 { return; }
    if let Ok(mut registry) = requests.0.lock() {
        registry.prune();
        if let Some(abort) = registry.pending.remove(&id) { abort.abort(); }
        // IPC cancellation can overtake registration of the async request.
        // Retain that cancellation so it cannot turn into an orphaned write.
        if registry.cancelled.len() < 256 { registry.cancelled.insert(id, Instant::now()); }
    }
}

pub fn cancel_all(app: &AppHandle) {
    if let Some(requests) = app.try_state::<Requests>() {
        if let Ok(mut pending) = requests.0.lock() {
            for (_, abort) in pending.pending.drain() { abort.abort(); }
        }
    }
}

#[tauri::command]
pub async fn desktop_request(app: AppHandle, request: ApiRequest, events: Channel<ApiEvent>) -> Result<(), String> {
    let auth = app.state::<DesktopAuth>();
    let url = target(&auth, &request.path)?;
    let (http, generation) = auth.authorized_client()?;
    if !matches!(request.method.as_str(), "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE") {
        return Err("Unsupported HTTP method".into());
    }
    if request.id.is_empty() || request.id.len() > 100 { return Err("Invalid request ID".into()); }
    let (abort, registration) = AbortHandle::new_pair();
    {
        let requests = app.state::<Requests>();
        let mut pending = requests.0.lock().map_err(|_| "Request state is unavailable")?;
        pending.prune();
        if pending.cancelled.remove(&request.id).is_some() { return Err("Request cancelled".into()); }
        if pending.pending.contains_key(&request.id) || pending.pending.len() >= 64 { return Err("Too many pending requests".into()); }
        pending.pending.insert(request.id.clone(), abort);
    }
    let work = async {
        let method = reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|_| "Invalid HTTP method")?;
        let mut builder = http.request(method, url)
            .header("Origin", auth.origin.origin().ascii_serialization());
        for (name, value) in request.headers {
            if matches!(name.to_ascii_lowercase().as_str(), "accept" | "content-type" | "if-none-match" | "if-modified-since") {
                builder = builder.header(name, value);
            }
        }
        if let Some(body) = request.body {
            if body.len() > 28 * 1024 * 1024 { return Err("Upload exceeds 20 MB".to_string()); }
            let bytes = STANDARD.decode(body).map_err(|_| "Invalid request body")?;
            if bytes.len() > 20 * 1024 * 1024 { return Err("Upload exceeds 20 MB".to_string()); }
            builder = builder.body(bytes);
        }
        let response = builder.send().await.map_err(|_| "Cannot connect to Zentra. Check your connection and retry.")?;
        if !auth.is_current(generation) { return Err("The account changed during this request".into()); }
        let status = response.status();
        if status.is_success() && !matches!(request.method.as_str(), "GET" | "HEAD") {
            crate::reminders::refresh(&app);
        }
        if status == reqwest::StatusCode::UNAUTHORIZED {
            auth::invalidate(&app, generation).await;
            if let Ok(mut pending) = app.state::<Requests>().0.lock() {
                pending.pending.retain(|id, abort| {
                    if id == &request.id { true } else { abort.abort(); false }
                });
            }
        }
        let headers = response.headers().iter().filter_map(|(name, value)| {
            if matches!(name.as_str(), "content-type" | "content-disposition" | "retry-after" | "etag" | "last-modified" | "x-vercel-ai-ui-message-stream" | "x-accel-buffering") {
                value.to_str().ok().map(|value| (name.to_string(), value.to_string()))
            } else { None }
        }).collect();
        events.send(ApiEvent::Headers { status: status.as_u16(), headers }).map_err(|_| "Response receiver closed")?;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            if !auth.is_current(generation) && status != reqwest::StatusCode::UNAUTHORIZED { return Err("The account changed during this request".into()); }
            let chunk = chunk.map_err(|_| "The connection was interrupted")?;
            events.send(ApiEvent::Chunk { data: STANDARD.encode(chunk) }).map_err(|_| "Response receiver closed")?;
        }
        events.send(ApiEvent::End).map_err(|_| "Response receiver closed")?;
        Ok::<_, String>(())
    };
    let result = Abortable::new(work, registration).await;
    if let Ok(mut pending) = app.state::<Requests>().0.lock() { pending.pending.remove(&request.id); }
    match result {
        Ok(Ok(())) => Ok(()),
        Ok(Err(message)) => { let _ = events.send(ApiEvent::Error { message: message.clone() }); Err(message) }
        Err(_) => { let _ = events.send(ApiEvent::Error { message: "Request cancelled".into() }); Err("Request cancelled".into()) }
    }
}
