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
    console.log("Backup: Starting backup process")

    // 从密码生成唯一ID
    const backupId = generateIdFromPassword(password)
    console.log(`Backup: Generated backup ID: ${backupId}`)

    // 加密数据
    console.log("Backup: Encrypting data")
    const encryptedData = await encrypt(JSON.stringify(data), password)

    console.log("Backup: Sending data to API")
    // 上传到API路由
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

    console.log(`Backup: API response status: ${response.status}`)

    // 获取响应内容
    const result = await response.json()
    console.log("Backup: API response:", result)

    if (!response.ok || !result.success) {
      throw new Error(result.error || `API returned status ${response.status}`)
    }

    console.log("Backup: Backup completed successfully")
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
    console.log("Restore: Starting restore process")

    // 从密码生成唯一ID
    const backupId = generateIdFromPassword(password)
    console.log(`Restore: Generated backup ID: ${backupId}`)

    console.log("Restore: Fetching data from API")
    // 从API路由获取加密数据
    const response = await fetch(`/api/blob?id=${backupId}`, {
      method: "GET",
    })

    console.log(`Restore: API response status: ${response.status}`)

    if (!response.ok) {
      if (response.status === 404) {
        console.error("Restore: Backup not found")
        return { success: false, error: "No backup found for this password" }
      }

      const errorData = await response.json()
      throw new Error(errorData.error || `API returned status ${response.status}`)
    }

    // 获取响应内容
    const result = await response.json()
    console.log("Restore: API response:", result)

    if (!result.success || !result.data) {
      console.error("Restore: No data in response")
      return { success: false, error: "No backup data found" }
    }

    console.log("Restore: Decrypting data")
    // 解密数据
    const decryptedData = await decrypt(result.data, password)

    console.log("Restore: Parsing JSON data")
    // 解析JSON数据
    const parsedData = JSON.parse(decryptedData)

    console.log("Restore: Restore completed successfully")
    return { success: true, data: parsedData }
  } catch (error) {
    console.error("Restore error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during restore",
    }
  }
}

