//! Installed, signed two-version update rehearsal. Excluded from release builds.
use std::{fs::OpenOptions, io::Write, path::PathBuf, sync::atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Manager, Url};

static STARTED: AtomicBool = AtomicBool::new(false);

#[derive(serde::Serialize, serde::Deserialize)]
struct Rehearsal {
    endpoint: String,
    report: String,
    sentinel: String,
}

fn configuration_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|error| error.to_string())?.join("update-acceptance.json"))
}

fn settings(app: &AppHandle) -> Result<Option<Rehearsal>, String> {
    if let Ok(report) = std::env::var("ZENTRA_UPDATE_ACCEPTANCE_REPORT") {
        return Ok(Some(Rehearsal {
            report,
            endpoint: std::env::var("ZENTRA_UPDATE_ACCEPTANCE_ENDPOINT").map_err(|error| error.to_string())?,
            sentinel: std::env::var("ZENTRA_UPDATE_ACCEPTANCE_SENTINEL").map_err(|error| error.to_string())?,
        }));
    }
    match std::fs::read(configuration_path(app)?) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn endpoint(app: &AppHandle, ordinary: Url) -> Result<Url, String> {
    let Some(configuration) = settings(app)? else { return Ok(ordinary) };
    let value = configuration.endpoint;
    let url = Url::parse(&value).map_err(|error| error.to_string())?;
    if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") || !url.username().is_empty() || url.password().is_some() {
        return Err("Acceptance endpoint must be loopback HTTP".into());
    }
    Ok(url)
}

fn record(app: &AppHandle, phase: &str, error: Option<&str>) -> Result<(), String> {
    let path = settings(app)?.ok_or("Acceptance configuration is missing")?.report;
    let executable = std::env::var_os("APPIMAGE").map(PathBuf::from)
        .map(Ok).unwrap_or_else(std::env::current_exe).map_err(|error| error.to_string())?;
    let mut file = OpenOptions::new().create(true).append(true).open(path).map_err(|error| error.to_string())?;
    writeln!(file, "{}", serde_json::json!({
        "phase": phase, "version": app.package_info().version.to_string(),
        "identifier": app.config().identifier, "pid": std::process::id(),
        "executable": executable, "appData": app.path().app_data_dir().map_err(|error| error.to_string())?,
        "error": error,
    })).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())
}

async fn rehearse(app: AppHandle) -> Result<(), String> {
    record(&app, "started", None)?;
    let data = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&data).map_err(|error| error.to_string())?;
    let marker = data.join("update-acceptance-marker");
    let configuration = settings(&app)?.ok_or("Acceptance configuration is missing")?;
    let expected = &configuration.sentinel;
    if app.package_info().version.to_string() == "0.0.2" {
        if std::fs::read_to_string(marker).map_err(|error| error.to_string())? != *expected {
            return Err("Application data was not preserved".into());
        }
        if crate::updates::desktop_check_update(app.clone()).await?.is_some() {
            return Err("Current version still reports an update".into());
        }
        record(&app, "upgraded", None)?;
        std::fs::remove_file(configuration_path(&app)?).map_err(|error| error.to_string())?;
        app.exit(0);
        return Ok(());
    }
    if app.package_info().version.to_string() != "0.0.1" { return Err("Unexpected rehearsal version".into()); }
    std::fs::write(marker, expected).map_err(|error| error.to_string())?;
    // Windows' installer may launch through Explorer with a fresh environment.
    // Keep the rehearsal's report endpoint across that real installer restart.
    // This module and its loopback override are absent from normal releases.
    std::fs::write(configuration_path(&app)?, serde_json::to_vec(&configuration).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    if crate::updates::desktop_check_update(app.clone()).await?.is_none() { return Err("Update B was not discovered".into()); }
    // The server corrupts the first download only. The real updater must reject
    // its signature before replacing the installed executable.
    match crate::updates::desktop_install_update(app.clone()).await {
        Err(error) if error.to_ascii_lowercase().contains("signature") => record(&app, "invalid-signature-rejected", None)?,
        Err(error) => return Err(format!("Expected signature rejection: {error}")),
        Ok(()) => return Err("Corrupt artifact unexpectedly installed".into()),
    }
    if crate::updates::desktop_check_update(app.clone()).await?.is_none() { return Err("Retry did not discover B".into()); }
    record(&app, "installing", None)?;
    crate::updates::desktop_install_update(app).await
}

pub fn start(app: AppHandle) {
    if !matches!(settings(&app), Ok(Some(_))) || STARTED.swap(true, Ordering::SeqCst) { return; }
    tauri::async_runtime::spawn(async move {
        if let Err(error) = rehearse(app.clone()).await {
            let _ = record(&app, "failed", Some(&error));
            app.exit(1);
        }
    });
}
