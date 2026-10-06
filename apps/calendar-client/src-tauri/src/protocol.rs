//! Linux protocol registration must be isolated by application ID. The upstream
//! helper names its desktop file after the binary, shared by dev and production.
use std::{fs, process::Command};
use tauri::{AppHandle, Manager};

fn desktop_entry(name: &str, identifier: &str, executable: &str) -> Result<String, String> {
    if executable.contains(['\n', '\r', '\0']) {
        return Err("The installation path cannot be represented by a desktop entry".into());
    }
    // Exec quoting is decoded after the desktop-entry string escapes. Escape
    // both layers, and protect a literal percent from field-code expansion.
    let executable = executable.replace('\\', "\\\\")
        .replace('"', "\\\"").replace('`', "\\`").replace('$', "\\$").replace('%', "%%");
    let command = format!("\"{executable}\" %u").replace('\\', "\\\\");
    Ok(format!("[Desktop Entry]\nType=Application\nName={name}\nExec={command}\nTerminal=false\nNoDisplay=true\nMimeType=x-scheme-handler/{identifier};\n"))
}

pub fn register(app: &AppHandle) -> Result<(), String> {
    let identifier = &app.config().identifier;
    let filename = format!("{identifier}-handler.desktop");
    let directory = app.path().data_dir().map_err(|error| error.to_string())?.join("applications");
    let executable = app.env().appimage.map(std::path::PathBuf::from)
        .map(Ok).unwrap_or_else(std::env::current_exe).map_err(|error| error.to_string())?;
    let executable = executable.to_str().ok_or("The installation path is not UTF-8")?;
    let entry = desktop_entry(app.config().product_name.as_deref().unwrap_or("Zentra Calendar"), identifier, executable)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    fs::write(directory.join(&filename), entry).map_err(|error| error.to_string())?;
    let refreshed = Command::new("update-desktop-database").arg(&directory).status()
        .map_err(|_| "Install desktop-file-utils to register browser login links")?;
    if !refreshed.success() { return Err("The desktop application database could not be refreshed".into()); }
    let registered = Command::new("xdg-mime")
        .args(["default", &filename, &format!("x-scheme-handler/{identifier}")]).status()
        .map_err(|_| "Install xdg-utils to register browser login links")?;
    if !registered.success() { return Err("The browser login protocol could not be registered".into()); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::desktop_entry;

    #[test]
    fn callback_command_preserves_paths_with_spaces_and_field_codes() {
        let entry = desktop_entry("Zentra", "app.zntr.calendar.dev", "/home/test/100% Calendar.AppImage").unwrap();
        assert!(entry.contains("Exec=\"/home/test/100%% Calendar.AppImage\" %u\n"));
        assert!(entry.contains("MimeType=x-scheme-handler/app.zntr.calendar.dev;\n"));
        assert!(!entry.contains("x-scheme-handler/app.zntr.calendar;"));
        assert!(desktop_entry("Zentra", "app.zntr.calendar", "/home/test/line\nbreak").is_err());
    }
}
