// 从密码派生密钥
async function deriveKey(password: string, salt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  // 如果没有提供盐值，则生成一个新的
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16))
  }

  // 从密码派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )

  return { key, salt }
}

// 加密数据
export async function encrypt(data: string, password: string): Promise<string> {
  // 生成初始化向量
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // 从密码派生密钥
  const { key, salt } = await deriveKey(password)

  // 加密数据
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    new TextEncoder().encode(data),
  )

  // 将加密数据、盐值和初始化向量合并为一个数组
  const result = new Uint8Array(salt.length + iv.length + encryptedData.byteLength)
  result.set(salt, 0)
  result.set(iv, salt.length)
  result.set(new Uint8Array(encryptedData), salt.length + iv.length)

  // 将结果转换为Base64字符串
  return btoa(String.fromCharCode(...result))
}

// 解密数据
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  // 将Base64字符串转换回Uint8Array
  const data = new Uint8Array(
    atob(encryptedData)
      .split("")
      .map((char) => char.charCodeAt(0)),
  )

  // 提取盐值、初始化向量和加密数据
  const salt = data.slice(0, 16)
  const iv = data.slice(16, 28)
  const ciphertext = data.slice(28)

  // 从密码和盐值派生密钥
  const { key } = await deriveKey(password, salt)

  // 解密数据
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext,
  )

  // 将解密后的数据转换为字符串
  return new TextDecoder().decode(decryptedData)
}

