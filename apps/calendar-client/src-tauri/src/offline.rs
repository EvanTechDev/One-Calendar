use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock,
    },
    time::{SystemTime, UNIX_EPOCH},
};

const SCHEMA_VERSION: u32 = 1;
const NONCE_BYTES: usize = 12;
const KEY_BYTES: usize = 32;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CachedResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

pub struct OfflineStore {
    origin_dir: PathBuf,
    key_source: KeySource,
    key: OnceLock<[u8; KEY_BYTES]>,
    key_lock: Mutex<()>,
    io_lock: Mutex<()>,
    offline: AtomicBool,
}

enum KeySource {
    Keyring { service: String, account: String },
    #[cfg(test)]
    Fixed([u8; KEY_BYTES]),
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    version: u32,
    cached_at: u64,
    nonce: String,
    ciphertext: String,
}

#[derive(Deserialize, Serialize)]
struct ResponsePayload {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

impl OfflineStore {
    pub fn new(origin: &str, identifier: &str, data_dir: PathBuf) -> Self {
        let origin_hash = digest(origin.as_bytes());
        Self::at_origin(
            origin,
            data_dir,
            KeySource::Keyring {
                service: format!("{identifier}.offline"),
                account: origin_hash,
            },
        )
    }

    #[cfg(test)]
    pub fn new_with_key(origin: &str, key: [u8; KEY_BYTES], data_dir: PathBuf) -> Self {
        Self::at_origin(origin, data_dir, KeySource::Fixed(key))
    }

    fn at_origin(origin: &str, data_dir: PathBuf, key_source: KeySource) -> Self {
        Self {
            origin_dir: data_dir
                .join("offline")
                .join(digest(origin.as_bytes())),
            key_source,
            key: OnceLock::new(),
            key_lock: Mutex::new(()),
            io_lock: Mutex::new(()),
            offline: AtomicBool::new(false),
        }
    }

    pub fn read(
        &self,
        user_id: &str,
        path_and_query: &str,
    ) -> Result<Option<CachedResponse>, String> {
        let _io = self.io_lock.lock().map_err(|_| "Offline storage is unavailable")?;
        let path = self.response_path(user_id, path_and_query);
        let Some(plaintext) = self.read_encrypted(
            &path,
            &[b"response", user_id.as_bytes(), path_and_query.as_bytes()],
        )?
        else {
            return Ok(None);
        };
        let payload: ResponsePayload = serde_json::from_slice(&plaintext)
            .map_err(|_| "Offline data is invalid or corrupted".to_string())?;
        let body = URL_SAFE_NO_PAD
            .decode(payload.body)
            .map_err(|_| "Offline data is invalid or corrupted".to_string())?;
        Ok(Some(CachedResponse {
            status: payload.status,
            headers: payload.headers,
            body,
        }))
    }

    #[cfg(test)]
    pub fn write(
        &self,
        user_id: &str,
        path_and_query: &str,
        status: u16,
        headers: HashMap<String, String>,
        body: &[u8],
    ) -> Result<(), String> {
        self.write_if(user_id, path_and_query, status, headers, body, || true)
    }

    pub fn write_if(
        &self,
        user_id: &str,
        path_and_query: &str,
        status: u16,
        headers: HashMap<String, String>,
        body: &[u8],
        permitted: impl FnOnce() -> bool,
    ) -> Result<(), String> {
        let _io = self.io_lock.lock().map_err(|_| "Offline storage is unavailable")?;
        if !permitted() {
            return Err("The account changed before offline data was saved".into());
        }
        let payload = ResponsePayload {
            status,
            headers,
            body: URL_SAFE_NO_PAD.encode(body),
        };
        let plaintext = serde_json::to_vec(&payload)
            .map_err(|_| "Cannot encode offline data".to_string())?;
        self.write_encrypted(
            &self.response_path(user_id, path_and_query),
            &[b"response", user_id.as_bytes(), path_and_query.as_bytes()],
            &plaintext,
        )
    }

    #[cfg(test)]
    pub fn clear_user(&self, user_id: &str) -> Result<(), String> {
        let _io = self.io_lock.lock().map_err(|_| "Offline storage is unavailable")?;
        remove_directory(&self.origin_dir.join(digest(user_id.as_bytes())))
    }

    pub fn clear_origin(&self) -> Result<(), String> {
        let _io = self.io_lock.lock().map_err(|_| "Offline storage is unavailable")?;
        remove_directory(&self.origin_dir)
    }

    pub fn read_identity(&self) -> Result<Option<serde_json::Value>, String> {
        let _io = self.io_lock.lock().map_err(|_| "Offline storage is unavailable")?;
        let Some(plaintext) =
            self.read_encrypted(&self.origin_dir.join("identity.json"), &[b"identity"])?
        else {
            return Ok(None);
        };
        serde_json::from_slice(&plaintext)
            .map(Some)
            .map_err(|_| "Offline identity is invalid or corrupted".to_string())
    }

    #[cfg(test)]
    pub fn write_identity(&self, value: &serde_json::Value) -> Result<(), String> {
        self.write_identity_if(value, || true)
    }

    pub fn write_identity_if(
        &self,
        value: &serde_json::Value,
        permitted: impl FnOnce() -> bool,
    ) -> Result<(), String> {
        let _io = self.io_lock.lock().map_err(|_| "Offline storage is unavailable")?;
        if !permitted() {
            return Err("The account changed before offline identity was saved".into());
        }
        let plaintext = serde_json::to_vec(value)
            .map_err(|_| "Cannot encode offline identity".to_string())?;
        self.write_encrypted(
            &self.origin_dir.join("identity.json"),
            &[b"identity"],
            &plaintext,
        )
    }

    pub fn set_offline(&self, offline: bool) {
        self.offline.store(offline, Ordering::Relaxed);
    }

    pub fn is_offline(&self) -> bool {
        self.offline.load(Ordering::Relaxed)
    }

    fn response_path(&self, user_id: &str, path_and_query: &str) -> PathBuf {
        self.origin_dir
            .join(digest(user_id.as_bytes()))
            .join(format!("{}.json", digest(path_and_query.as_bytes())))
    }

    fn read_encrypted(
        &self,
        path: &Path,
        context: &[&[u8]],
    ) -> Result<Option<Vec<u8>>, String> {
        let encoded = match fs::read(path) {
            Ok(encoded) => encoded,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err("Cannot read offline data".to_string()),
        };
        let envelope: Envelope = serde_json::from_slice(&encoded)
            .map_err(|_| "Offline data is invalid or corrupted".to_string())?;
        if envelope.version != SCHEMA_VERSION {
            return Err("Offline data uses an unsupported version".to_string());
        }
        let nonce = URL_SAFE_NO_PAD
            .decode(envelope.nonce)
            .map_err(|_| "Offline data is invalid or corrupted".to_string())?;
        if nonce.len() != NONCE_BYTES {
            return Err("Offline data is invalid or corrupted".to_string());
        }
        let ciphertext = URL_SAFE_NO_PAD
            .decode(envelope.ciphertext)
            .map_err(|_| "Offline data is invalid or corrupted".to_string())?;
        let cipher = self.cipher()?;
        let aad = associated_data(context, envelope.cached_at);
        cipher
            .decrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: &ciphertext,
                    aad: &aad,
                },
            )
            .map(Some)
            .map_err(|_| "Offline data cannot be authenticated".to_string())
    }

    fn write_encrypted(
        &self,
        path: &Path,
        context: &[&[u8]],
        plaintext: &[u8],
    ) -> Result<(), String> {
        let cached_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "System clock is before the Unix epoch".to_string())?
            .as_secs();
        let mut nonce = [0u8; NONCE_BYTES];
        getrandom::fill(&mut nonce).map_err(|_| "Secure randomness is unavailable".to_string())?;
        let aad = associated_data(context, cached_at);
        let ciphertext = self
            .cipher()?
            .encrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: plaintext,
                    aad: &aad,
                },
            )
            .map_err(|_| "Cannot encrypt offline data".to_string())?;
        let envelope = Envelope {
            version: SCHEMA_VERSION,
            cached_at,
            nonce: URL_SAFE_NO_PAD.encode(nonce),
            ciphertext: URL_SAFE_NO_PAD.encode(ciphertext),
        };
        let encoded = serde_json::to_vec(&envelope)
            .map_err(|_| "Cannot encode offline data".to_string())?;
        atomic_write(path, &encoded)
    }

    fn cipher(&self) -> Result<Aes256Gcm, String> {
        Aes256Gcm::new_from_slice(self.encryption_key()?)
            .map_err(|_| "Offline encryption key is invalid".to_string())
    }

    fn encryption_key(&self) -> Result<&[u8; KEY_BYTES], String> {
        if let Some(key) = self.key.get() {
            return Ok(key);
        }
        let _guard = self
            .key_lock
            .lock()
            .map_err(|_| "Offline encryption key is unavailable".to_string())?;
        if let Some(key) = self.key.get() {
            return Ok(key);
        }
        let key = match &self.key_source {
            KeySource::Keyring { service, account } => keyring_key(service, account)?,
            #[cfg(test)]
            KeySource::Fixed(key) => *key,
        };
        let _ = self.key.set(key);
        self.key
            .get()
            .ok_or_else(|| "Offline encryption key is unavailable".to_string())
    }
}

fn keyring_key(service: &str, account: &str) -> Result<[u8; KEY_BYTES], String> {
    let entry = keyring::Entry::new(service, account)
        .map_err(|_| "The system credential store is unavailable".to_string())?;
    match entry.get_password() {
        Ok(encoded) => {
            let decoded = URL_SAFE_NO_PAD
                .decode(encoded)
                .map_err(|_| "Saved offline encryption key is invalid".to_string())?;
            decoded
                .try_into()
                .map_err(|_| "Saved offline encryption key is invalid".to_string())
        }
        Err(keyring::Error::NoEntry) => {
            let mut key = [0u8; KEY_BYTES];
            getrandom::fill(&mut key)
                .map_err(|_| "Secure randomness is unavailable".to_string())?;
            entry
                .set_password(&URL_SAFE_NO_PAD.encode(key))
                .map_err(|_| "Cannot save the offline encryption key".to_string())?;
            Ok(key)
        }
        Err(_) => Err("Unlock your system credential store, then retry".to_string()),
    }
}

fn associated_data(context: &[&[u8]], cached_at: u64) -> Vec<u8> {
    let mut data = b"zentra-offline/v1".to_vec();
    data.extend_from_slice(&cached_at.to_be_bytes());
    for part in context {
        data.extend_from_slice(&(part.len() as u64).to_be_bytes());
        data.extend_from_slice(part);
    }
    data
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Offline data directory is unavailable".to_string())?;
    fs::create_dir_all(parent).map_err(|_| "Cannot create the offline data directory".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Offline data filename is unavailable".to_string())?;
    let mut suffix = [0u8; 16];
    getrandom::fill(&mut suffix).map_err(|_| "Secure randomness is unavailable".to_string())?;
    let temporary = parent.join(format!(".{file_name}.{}.tmp", hex(&suffix)));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| "Cannot create temporary offline data".to_string())?;
        file.write_all(contents)
            .map_err(|_| "Cannot write offline data".to_string())?;
        file.sync_all()
            .map_err(|_| "Cannot save offline data".to_string())?;
        drop(file);
        fs::rename(&temporary, path).map_err(|_| "Cannot replace offline data".to_string())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn remove_directory(path: &Path) -> Result<(), String> {
    match fs::remove_dir_all(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("Cannot clear offline data".to_string()),
    }
}

fn digest(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

fn hex(value: &[u8]) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let sequence = NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed);
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            Self(std::env::temp_dir().join(format!(
                "zentra-offline-{}-{timestamp}-{sequence}",
                std::process::id()
            )))
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn store(directory: &TestDirectory) -> OfflineStore {
        OfflineStore::new_with_key("https://calendar.example", [7; KEY_BYTES], directory.0.clone())
    }

    fn headers() -> HashMap<String, String> {
        HashMap::from([("content-type".to_string(), "application/json".to_string())])
    }

    #[test]
    fn response_roundtrip_uses_an_encrypted_versioned_envelope() {
        let directory = TestDirectory::new();
        let store = store(&directory);
        let path = "/api/events?start=2026-01-01";
        let body = b"calendar data\0\xff";
        store
            .write("user-1", path, 200, headers(), body)
            .unwrap();

        let response = store.read("user-1", path).unwrap().unwrap();
        assert_eq!(response.status, 200);
        assert_eq!(response.headers, headers());
        assert_eq!(response.body, body);

        let encoded = fs::read(store.response_path("user-1", path)).unwrap();
        let text = String::from_utf8(encoded).unwrap();
        let envelope: Envelope = serde_json::from_str(&text).unwrap();
        assert_eq!(envelope.version, SCHEMA_VERSION);
        assert!(envelope.cached_at > 0);
        assert!(!text.contains("calendar data"));
        assert!(!text.contains("/api/events"));
        assert!(!text.contains("user-1"));
    }

    #[test]
    fn users_origins_and_exact_paths_are_isolated() {
        let directory = TestDirectory::new();
        let first = store(&directory);
        first.write("user-1", "/api/events?a=1", 200, headers(), b"one").unwrap();
        first.write("user-1", "/api/events?a=2", 200, headers(), b"two").unwrap();
        first.write("user-2", "/api/events?a=1", 200, headers(), b"other").unwrap();

        assert_eq!(first.read("user-1", "/api/events?a=1").unwrap().unwrap().body, b"one");
        assert_eq!(first.read("user-1", "/api/events?a=2").unwrap().unwrap().body, b"two");
        assert_eq!(first.read("user-2", "/api/events?a=1").unwrap().unwrap().body, b"other");
        assert!(first.read("user-2", "/api/events?a=2").unwrap().is_none());

        let other_origin = OfflineStore::new_with_key(
            "https://other.example",
            [7; KEY_BYTES],
            directory.0.clone(),
        );
        assert!(other_origin.read("user-1", "/api/events?a=1").unwrap().is_none());
    }

    #[test]
    fn tampering_corruption_and_wrong_versions_fail_closed() {
        let directory = TestDirectory::new();
        let store = store(&directory);
        let record = store.response_path("user-1", "/api/events");
        store.write("user-1", "/api/events", 200, headers(), b"secret").unwrap();
        store
            .write("user-1", "/api/events?fresh", 200, headers(), b"fresh")
            .unwrap();

        let mut envelope: Envelope =
            serde_json::from_slice(&fs::read(&record).unwrap()).unwrap();
        let mut ciphertext = URL_SAFE_NO_PAD.decode(&envelope.ciphertext).unwrap();
        ciphertext[0] ^= 1;
        envelope.ciphertext = URL_SAFE_NO_PAD.encode(ciphertext);
        fs::write(&record, serde_json::to_vec(&envelope).unwrap()).unwrap();
        assert!(store.read("user-1", "/api/events").is_err());

        fs::write(&record, b"not json").unwrap();
        assert!(store.read("user-1", "/api/events").is_err());

        let fresh_record = store.response_path("user-1", "/api/events?fresh");
        let mut envelope: Envelope =
            serde_json::from_slice(&fs::read(&fresh_record).unwrap()).unwrap();
        envelope.version = SCHEMA_VERSION + 1;
        fs::write(&fresh_record, serde_json::to_vec(&envelope).unwrap()).unwrap();
        assert!(store.read("user-1", "/api/events?fresh").is_err());
    }

    #[test]
    fn clear_user_preserves_other_users_and_clear_origin_removes_everything() {
        let directory = TestDirectory::new();
        let store = store(&directory);
        store.write("user-1", "/api/events", 200, headers(), b"one").unwrap();
        store.write("user-2", "/api/events", 200, headers(), b"two").unwrap();
        store.write_identity(&serde_json::json!({"id": "user-1"})).unwrap();

        store.clear_user("user-1").unwrap();
        assert!(store.read("user-1", "/api/events").unwrap().is_none());
        assert_eq!(store.read("user-2", "/api/events").unwrap().unwrap().body, b"two");
        store.clear_user("missing-user").unwrap();

        store.clear_origin().unwrap();
        assert!(store.read("user-2", "/api/events").unwrap().is_none());
        assert!(store.read_identity().unwrap().is_none());
        store.clear_origin().unwrap();
    }

    #[test]
    fn stale_account_writes_are_rejected_before_touching_storage() {
        let directory = TestDirectory::new();
        let store = store(&directory);
        assert!(store
            .write_if(
                "user-1",
                "/api/events",
                200,
                headers(),
                b"stale",
                || false,
            )
            .is_err());
        assert!(store.read("user-1", "/api/events").unwrap().is_none());
        assert!(store
            .write_identity_if(&serde_json::json!({"id": "user-1"}), || false)
            .is_err());
        assert!(store.read_identity().unwrap().is_none());
    }

    #[test]
    fn identity_roundtrip_and_offline_flag() {
        let directory = TestDirectory::new();
        let store = store(&directory);
        assert!(store.read_identity().unwrap().is_none());
        let identity = serde_json::json!({
            "id": "user-1",
            "name": "Calendar User",
            "settings": {"weekStartsOn": 1}
        });
        store.write_identity(&identity).unwrap();
        assert_eq!(store.read_identity().unwrap(), Some(identity));

        assert!(!store.is_offline());
        store.set_offline(true);
        assert!(store.is_offline());
        store.set_offline(false);
        assert!(!store.is_offline());
    }
}
