import { encrypt, decrypt } from "./crypto"

// 验证密码强度
export function validatePassword(password: string): boolean {
  // 至少8个字符，包含大小写字母、数字和特殊字符
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/
  return regex.test(password)
}

// 从密码生成唯一ID
export function generateIdFromPassword(password: string): string {
  // 简单的哈希函数，用于从密码生成唯一ID
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 转换为32位整数
  }
  return `backup_${Math.abs(hash).toString(16)}`
}

// 备份数据
export async function backupData(password: string, data: any): Promise<{ success: boolean; error?: string }> {
  try {
    // 从密码生成唯一ID
    const backupId = generateIdFromPassword(password)

    // 加密数据
    const encryptedData = await encrypt(JSON.stringify(data), password)

    // 上传到Vercel Blob
    const response = await fetch("/api/blob", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: backupId,
        data: encryptedData,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to upload backup")
    }

    return { success: true }
  } catch (error) {
    console.error("Backup error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during backup",
    }
  }
}

// 恢复数据
export async function restoreData(password: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 从密码生成唯一ID
    const backupId = generateIdFromPassword(password)

    // 从Vercel Blob获取加密数据
    const response = await fetch(`/api/blob?id=${backupId}`, {
      method: "GET",
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "No backup found for this password" }
      }
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to retrieve backup")
    }

    const { data: encryptedData } = await response.json()

    if (!encryptedData) {
      return { success: false, error: "No backup data found" }
    }

    // 解密数据
    const decryptedData = await decrypt(encryptedData, password)
    const parsedData = JSON.parse(decryptedData)

    return { success: true, data: parsedData }
  } catch (error) {
    console.error("Restore error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during restore",
    }
  }
}

