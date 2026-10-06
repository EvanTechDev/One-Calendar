fn main() {
    println!("cargo:rerun-if-env-changed=ZENTRA_DESKTOP_ENV");
    println!("cargo:rerun-if-env-changed=ZENTRA_API_ORIGIN");
    tauri_build::build()
}
