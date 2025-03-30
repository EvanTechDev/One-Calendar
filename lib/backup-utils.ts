// 验证密码强度
export function validatePassword(password: string): boolean {
  // 至少8个字符，包含大小写字母、数字和特殊字符
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
  return regex.test(password);
}

// 从密码生成唯一ID - 确保备份和恢复使用完全相同的算法
export function generateIdFromPassword(password: string): string {
  // 简单的哈希函数，用于从密码生成唯一ID
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 返回固定格式的ID，不添加任何额外的哈希值
  return `backup_${Math.abs(hash).toString(16)}`;
}

// 列出所有备份 - 新增函数
export async function listAllBackups(): Promise<string[]> {
  try {
    const response = await fetch('/api/blob/list', {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list backups: ${response.status}`);
    }
    
    const result = await response.json();
    return result.backups || [];
  } catch (error) {
    console.error("Error listing backups:", error);
    return [];
  }
}
