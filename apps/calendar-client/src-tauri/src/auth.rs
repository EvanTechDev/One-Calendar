use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use futures_util::future::{AbortHandle, Abortable};
use reqwest::cookie::{CookieStore, Jar};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PublicUser {
    pub id: String,
    pub name: String,
    pub email: String,
    pub image: Option<String>,
    #[serde(default)]
    pub email_verified: bool,
    #[serde(default)]
    pub two_factor_enabled: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionView {
    pub user: Option<PublicUser>,
    pub expires_at: Option<String>,
    pub pending: bool,
    pub signing_in: bool,
    pub error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionReply {
    user: PublicUser,
    expires_at: String,
}

struct PendingLogin {
    state: String,
    verifier: String,
    started: Instant,
    exchanging: bool,
    abort: Option<AbortHandle>,
}

struct SessionInner {
    client: reqwest::Client,
    jar: Arc<Jar>,
    user: Option<PublicUser>,
    expires_at: Option<String>,
    pending: Option<PendingLogin>,
    generation: u64,
    loading: bool,
    restored: bool,
    error: Option<String>,
}

pub struct DesktopAuth {
    pub origin: reqwest::Url,
    pub identifier: String,
    pub client_id: String,
    pub redirect_uri: String,
    inner: Mutex<SessionInner>,
    vault: Mutex<()>,
    signed_out_marker: PathBuf,
}

fn client(jar: Arc<Jar>) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .cookie_provider(jar)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(300))
        .user_agent(format!("Zentra-Desktop/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| error.to_string())
}

impl DesktopAuth {
    pub fn new(origin: &str, identifier: &str, dev: bool, data_dir: PathBuf) -> Result<Self, String> {
        let jar = Arc::new(Jar::default());
        Ok(Self {
            origin: reqwest::Url::parse(origin).map_err(|error| error.to_string())?,
            identifier: identifier.into(),
            client_id: if dev { "zentra-desktop-dev" } else { "zentra-desktop" }.into(),
            redirect_uri: format!("{identifier}:/oauth/callback"),
            inner: Mutex::new(SessionInner {
                client: client(jar.clone())?, jar, user: None, expires_at: None,
                pending: None, generation: 0, loading: false, restored: false, error: None,
            }),
            vault: Mutex::new(()),
            signed_out_marker: data_dir.join(format!("signed-out-{:x}", Sha256::digest(origin.as_bytes()))),
        })
    }

    fn view(inner: &SessionInner) -> SessionView {
        SessionView {
            user: inner.user.clone(), expires_at: inner.expires_at.clone(),
            pending: inner.loading || inner.pending.is_some(), error: inner.error.clone(),
            signing_in: inner.pending.is_some(),
        }
    }

    pub fn snapshot(&self) -> Result<SessionView, String> {
        self.inner.lock().map(|inner| Self::view(&inner))
            .map_err(|_| "Session state is unavailable".into())
    }

    pub fn authorized_client(&self) -> Result<(reqwest::Client, u64), String> {
        let inner = self.inner.lock().map_err(|_| "Session state is unavailable")?;
        if inner.user.is_none() { return Err("Authentication required".into()); }
        Ok((inner.client.clone(), inner.generation))
    }

    pub fn is_current(&self, generation: u64) -> bool {
        self.inner.lock().map(|inner| inner.generation == generation).unwrap_or(false)
    }

    fn entry(&self) -> Result<keyring::Entry, String> {
        keyring::Entry::new(&self.identifier, self.origin.as_str())
            .map_err(|_| "The system credential store is unavailable".into())
    }

    fn mark_signed_out(&self) -> Result<(), String> {
        let parent = self.signed_out_marker.parent().ok_or("Credential state directory is unavailable")?;
        std::fs::create_dir_all(parent).map_err(|_| "Cannot save the signed-out state")?;
        std::fs::write(&self.signed_out_marker, b"signed-out")
            .map_err(|_| "Cannot save the signed-out state".into())
    }

    fn persist(&self, generation: u64) -> Result<(), String> {
        let _vault = self.vault.lock().map_err(|_| "Credential store is unavailable")?;
        let cookie = {
            let inner = self.inner.lock().map_err(|_| "Session state is unavailable")?;
            if inner.generation != generation { return Ok(()); }
            inner.jar.cookies(&self.origin).and_then(|value| value.to_str().ok().map(|value| {
                value.split(';').map(str::trim)
                    .filter(|cookie| cookie.split_once('=').is_some_and(|(name, _)| name.ends_with(".session_token")))
                    .collect::<Vec<_>>().join("; ")
            }))
        };
        match cookie {
            Some(value) if !value.is_empty() => {
                self.entry()?.set_password(&value).map_err(|_| "Cannot save the credential")?;
                match std::fs::remove_file(&self.signed_out_marker) {
                    Ok(()) => Ok(()),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
                    Err(_) => Err("Cannot enable persistent sign-in".into()),
                }
            }
            _ => {
                self.mark_signed_out()?;
                match self.entry()?.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(_) => Err("Cannot remove the credential from the system store".into()),
                }
            },
        }
    }
}

fn emit_session(app: &AppHandle) {
    crate::reminders::refresh(app);
    if let Ok(view) = app.state::<DesktopAuth>().snapshot() {
        let _ = app.emit("desktop-session", view);
    }
}

async fn persist_session(app: &AppHandle, generation: u64) -> Result<(), String> {
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || handle.state::<DesktopAuth>().persist(generation))
        .await.map_err(|_| "Credential storage failed".to_string())?
}

fn random_secret() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| "Secure randomness is unavailable")?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

#[tauri::command]
pub async fn desktop_session(app: AppHandle) -> Result<SessionView, String> {
    let auth = app.state::<DesktopAuth>();
    let (generation, restore) = {
        let mut inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
        if inner.loading || inner.pending.is_some() { return Ok(DesktopAuth::view(&inner)); }
        inner.loading = true;
        inner.error = None;
        (inner.generation, !inner.restored)
    };
    emit_session(&app);
    let result = async {
        if restore {
            let handle = app.clone();
            let stored = tauri::async_runtime::spawn_blocking(move || {
                let auth = handle.state::<DesktopAuth>();
                let _vault = auth.vault.lock().map_err(|_| "Credential store is unavailable".to_string())?;
                match std::fs::metadata(&auth.signed_out_marker) {
                    Ok(_) => return Ok(None),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
                    Err(_) => return Err("Cannot read the saved sign-in state".into()),
                }
                match auth.entry()?.get_password() {
                    Ok(value) => Ok(Some(value)),
                    Err(keyring::Error::NoEntry) => Ok(None),
                    Err(_) => Err("Unlock your system credential store, then retry".into()),
                }
            }).await.map_err(|_| "Credential storage failed")??;
            let mut inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
            if inner.generation != generation { return Ok(None); }
            if let Some(cookies) = stored {
                for cookie in cookies.split(';').map(str::trim) {
                    inner.jar.add_cookie_str(&format!("{cookie}; Path=/; Secure; HttpOnly"), &auth.origin);
                }
            }
            inner.restored = true;
        }
        let http = {
            let inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
            if inner.generation != generation || inner.jar.cookies(&auth.origin).is_none() { return Ok(None); }
            inner.client.clone()
        };
        let response = http.get(auth.origin.join("/api/auth/desktop/session").unwrap())
            .timeout(Duration::from_secs(30)).send().await
            .map_err(|_| "Cannot connect to Zentra. Check your connection and retry.".to_string())?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED { return Ok(None); }
        if !response.status().is_success() { return Err("Zentra is temporarily unavailable. Retry shortly.".into()); }
        response.json::<SessionReply>().await.map(Some)
            .map_err(|_| "Zentra returned an invalid session response".into())
    }.await;
    let save = result.is_ok();
    let mut next_generation = generation;
    let mut expired = false;
    {
        let mut inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
        if inner.generation != generation { return Ok(DesktopAuth::view(&inner)); }
        inner.loading = false;
        match result {
            Ok(Some(session)) => { inner.user = Some(session.user); inner.expires_at = Some(session.expires_at); }
            Ok(None) => {
                expired = inner.user.is_some();
                inner.generation += 1;
                next_generation = inner.generation;
                inner.user = None;
                inner.expires_at = None;
                inner.jar = Arc::new(Jar::default());
                inner.client = client(inner.jar.clone())?;
            }
            Err(error) => inner.error = Some(error),
        }
    }
    if expired { super::transport::cancel_all(&app); }
    if save {
        if persist_session(&app, next_generation).await.is_err() {
            let mut inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
            if inner.generation == next_generation && inner.user.is_some() {
                inner.error = Some("Your system credential store could not save this session. Unlock it and retry.".into());
            }
        }
    }
    emit_session(&app);
    auth.snapshot()
}

#[tauri::command]
pub async fn desktop_sign_in(app: AppHandle) -> Result<(), String> {
    let auth = app.state::<DesktopAuth>();
    let state = random_secret()?;
    let verifier = random_secret()?;
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let generation = {
        let mut inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
        if inner.loading { return Err("Wait for the session to finish loading".into()); }
        if inner.user.is_some() { return Err("Sign out before switching accounts".into()); }
        if let Some(pending) = inner.pending.take() { if let Some(abort) = pending.abort { abort.abort(); } }
        inner.generation += 1;
        inner.loading = false;
        inner.error = None;
        inner.pending = Some(PendingLogin { state: state.clone(), verifier, started: Instant::now(), exchanging: false, abort: None });
        inner.generation
    };
    let mut url = auth.origin.join("/api/auth/oauth2/authorize").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("response_type", "code"), ("client_id", auth.client_id.as_str()),
        ("redirect_uri", auth.redirect_uri.as_str()), ("scope", "openid profile email desktop:session"),
        ("resource", auth.origin.join("/api/desktop").unwrap().as_str()),
        ("state", state.as_str()), ("code_challenge", challenge.as_str()), ("code_challenge_method", "S256"),
    ]);
    if app.opener().open_url(url.as_str(), None::<&str>).is_err() {
        desktop_cancel_sign_in(app.clone())?;
        return Err("Could not open your browser. Try again.".into());
    }
    emit_session(&app);
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(300)).await;
        let auth = handle.state::<DesktopAuth>();
        if let Ok(mut inner) = auth.inner.lock() {
            if inner.generation == generation && inner.pending.is_some() {
                if let Some(pending) = inner.pending.take() { if let Some(abort) = pending.abort { abort.abort(); } }
                inner.generation += 1;
                inner.error = Some("Sign-in expired. Please try again.".into());
            }
        }
        emit_session(&handle);
    });
    Ok(())
}

#[tauri::command]
pub fn desktop_cancel_sign_in(app: AppHandle) -> Result<(), String> {
    let auth = app.state::<DesktopAuth>();
    {
        let mut inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
        if let Some(pending) = inner.pending.take() { if let Some(abort) = pending.abort { abort.abort(); } }
        inner.generation += 1;
        inner.loading = false;
        inner.error = None;
    }
    emit_session(&app);
    Ok(())
}

pub async fn callback(app: AppHandle, url: tauri::Url) {
    let auth = app.state::<DesktopAuth>();
    if url.scheme() != auth.identifier || url.host_str().is_some() || url.path() != "/oauth/callback" || url.fragment().is_some() { return; }
    let pairs: Vec<_> = url.query_pairs().collect();
    let value = |name: &str| {
        let mut values = pairs.iter().filter(|(key, _)| key == name).map(|(_, value)| value.to_string());
        let first = values.next();
        if values.next().is_some() { None } else { first }
    };
    let Some(state) = value("state") else { return; };
    let Some((generation, verifier, registration)) = (|| {
        let mut inner = auth.inner.lock().ok()?;
        let generation = inner.generation;
        let pending = inner.pending.as_mut()?;
        if pending.state != state || pending.exchanging || pending.started.elapsed() > Duration::from_secs(300) { return None; }
        let (abort, registration) = AbortHandle::new_pair();
        pending.exchanging = true;
        pending.abort = Some(abort);
        Some((generation, pending.verifier.clone(), registration))
    })() else { return; };
    super::show_main(&app);
    let jar = Arc::new(Jar::default());
    let result = Abortable::new(async {
        let code = value("code").filter(|code| !code.is_empty() && code.len() <= 4096)
            .ok_or("Browser sign-in was declined or failed. Try again.")?;
        let http = client(jar.clone())?;
        let response = http.post(auth.origin.join("/api/auth/desktop/exchange").unwrap())
            .header("Origin", auth.origin.origin().ascii_serialization())
            .json(&serde_json::json!({ "code": code, "codeVerifier": verifier }))
            .timeout(Duration::from_secs(30)).send().await
            .map_err(|_| "Could not finish sign-in. Check your connection and try again.")?;
        if !response.status().is_success() { return Err("Sign-in could not be completed. Start again in your browser.".to_string()); }
        let reply = response.json::<SessionReply>().await.map_err(|_| "Invalid sign-in response")?;
        Ok((http, reply))
    }, registration).await;
    let Ok(result) = result else { return; };
    let success = result.is_ok();
    {
        let Ok(mut inner) = auth.inner.lock() else { return; };
        if inner.generation != generation { return; }
        inner.pending = None;
        match result {
            Ok((http, session)) => {
                inner.client = http; inner.jar = jar; inner.user = Some(session.user);
                inner.expires_at = Some(session.expires_at); inner.restored = true; inner.error = None;
            }
            Err(error) => inner.error = Some(error),
        }
    }
    if success && persist_session(&app, generation).await.is_err() {
        if let Ok(mut inner) = auth.inner.lock() {
            if inner.generation == generation {
                inner.error = Some("Signed in for this run. Unlock your system credential store to save the session.".into());
            }
        }
    }
    emit_session(&app);
}

pub async fn invalidate(app: &AppHandle, generation: u64) {
    let auth = app.state::<DesktopAuth>();
    let next = {
        let Ok(mut inner) = auth.inner.lock() else { return; };
        if inner.generation != generation { return; }
        let jar = Arc::new(Jar::default());
        let Ok(http) = client(jar.clone()) else { return; };
        inner.generation += 1; inner.user = None; inner.expires_at = None;
        inner.jar = jar; inner.client = http; inner.loading = false;
        inner.error = Some("Your session expired. Sign in again.".into());
        inner.generation
    };
    let _ = persist_session(app, next).await;
    emit_session(app);
}

#[tauri::command]
pub async fn desktop_sign_out(app: AppHandle) -> Result<(), String> {
    let auth = app.state::<DesktopAuth>();
    let handle = app.clone();
    let (http, generation) = tauri::async_runtime::spawn_blocking(move || -> Result<_, String> {
        let auth = handle.state::<DesktopAuth>();
        let _vault = auth.vault.lock().map_err(|_| "Credential store is unavailable")?;
        let mut inner = auth.inner.lock().map_err(|_| "Session state is unavailable")?;
        // This tombstone survives keychain failures and prevents restoring an
        // old credential after the user has explicitly signed out.
        auth.mark_signed_out()?;
        let http = inner.client.clone();
        if let Some(pending) = inner.pending.take() { if let Some(abort) = pending.abort { abort.abort(); } }
        inner.generation += 1; inner.user = None; inner.expires_at = None;
        inner.jar = Arc::new(Jar::default()); inner.client = client(inner.jar.clone())?;
        inner.restored = true; inner.loading = false; inner.error = None;
        Ok((http, inner.generation))
    }).await.map_err(|_| "Could not save the signed-out state")??;
    super::transport::cancel_all(&app);
    emit_session(&app);
    let stored = persist_session(&app, generation).await;
    let revoked = http.post(auth.origin.join("/api/auth/sign-out").unwrap())
        .header("Origin", auth.origin.origin().ascii_serialization())
        .timeout(Duration::from_secs(15)).send().await;
    if stored.is_err() { return Err("Signed out on this device. The system credential store could not remove the old credential; it will not be restored.".into()); }
    if !revoked.is_ok_and(|response| response.status().is_success()) {
        return Err("Signed out on this device. The server could not be reached to revoke the old session.".into());
    }
    Ok(())
}
