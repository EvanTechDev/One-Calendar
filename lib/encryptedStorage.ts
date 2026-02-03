class EncryptedStorage {
  private key: CryptoKey | null = null
  private password: string | null = null

  get isUnlocked(): boolean {
    return this.key !== null && this.password !== null
  }

  private b64(u: Uint8Array): string {
    return btoa(String.fromCharCode(...u))
  }

  private ub64(s: string): Uint8Array {
    return new Uint8Array(atob(s).split("").map((c) => c.charCodeAt(0)))
  }

  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    )
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    )
  }

  async unlock(password: string): Promise<boolean> {
    if (!password) return false
    
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      this.key = await this.deriveKey(password, salt)
      this.password = password
      return true
    } catch {
      return false
    }
  }

  lock(): void {
    this.key = null
    this.password = null
  }

  getItem(key: string): string | null {
    if (!this.isUnlocked) return null
    
    const encrypted = localStorage.getItem(key)
    if (!encrypted) return null
    
    return encrypted
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.isUnlocked || !this.password) return
    
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const derivedKey = await this.deriveKey(this.password, salt)
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      derivedKey,
      new TextEncoder().encode(value)
    )
    
    const encrypted = JSON.stringify({
      v: 1,
      salt: this.b64(salt),
      iv: this.b64(iv),
      ct: this.b64(new Uint8Array(ciphertext))
    })
    
    localStorage.setItem(key, encrypted)
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key)
  }

  async decryptValue(encryptedData: string): Promise<string | null> {
    if (!this.isUnlocked || !this.password) return null
    
    try {
      const data = JSON.parse(encryptedData)
      const salt = this.ub64(data.salt)
      const iv = this.ub64(data.iv)
      const ct = this.ub64(data.ct)
      
      const derivedKey = await this.deriveKey(this.password, salt)
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        derivedKey,
        ct
      )
      
      return new TextDecoder().decode(plaintext)
    } catch {
      return null
    }
  }
}

export const es = new EncryptedStorage()
