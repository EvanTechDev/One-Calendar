fn main() {
    println!("cargo:rerun-if-env-changed=ZENTRA_DESKTOP_ENV");
    println!("cargo:rerun-if-env-changed=ZENTRA_API_ORIGIN");
    println!("cargo:rerun-if-env-changed=ZENTRA_UPDATER_PUBLIC_KEY");
    tauri_build::build()
}
