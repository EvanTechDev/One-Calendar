import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

function encryptData(data: string, userId: string): { encryptedData: string; iv: string; authTag: string } {
  const salt = process.env.BACKUP_SALT;
  if (!salt) {
    throw new Error("BACKUP_SALT environment variable is not set");
  }
  
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(userId, salt, 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptData(encryptedData: string, iv: string, authTag: string, userId: string): string {
  const salt = process.env.BACKUP_SALT;
  if (!salt) {
    throw new Error("BACKUP_SALT environment variable is not set");
  }
  
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(userId, salt, 32);
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function ensureShareFolderStructure(misskeyUrl: string, misskeyToken: string, shareId: string): Promise<string> {
  const mainFolderName = "shares";
  
  const listMainFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      limit: 100,
    }),
  });
  
  if (!listMainFoldersResponse.ok) {
    throw new Error(`Failed to list folders: ${listMainFoldersResponse.statusText}`);
  }
  
  const mainFolders = await listMainFoldersResponse.json();
  let mainSharesFolder = mainFolders.find((folder: any) => folder.name === mainFolderName);
  
  if (!mainSharesFolder) {
    const createMainFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: misskeyToken,
        name: mainFolderName,
      }),
    });
    
    if (!createMainFolderResponse.ok) {
      throw new Error(`Failed to create main shares folder: ${createMainFolderResponse.statusText}`);
    }
    
    mainSharesFolder = await createMainFolderResponse.json();
  }

  const shareFolderName = shareId;
  
  const listShareFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      folderId: mainSharesFolder.id,
      limit: 100,
    }),
  });
  
  if (!listShareFoldersResponse.ok) {
    throw new Error(`Failed to list share folders: ${listShareFoldersResponse.statusText}`);
  }
  
  const shareFolders = await listShareFoldersResponse.json();
  let shareFolder = shareFolders.find((folder: any) => folder.name === shareFolderName);
  
  if (!shareFolder) {
    const createShareFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: misskeyToken,
        name: shareFolderName,
        parentId: mainSharesFolder.id,
      }),
    });
    
    if (!createShareFolderResponse.ok) {
      throw new Error(`Failed to create share folder: ${createShareFolderResponse.statusText}`);
    }
    
    shareFolder = await createShareFolderResponse.json();
  }
  
  return shareFolder.id;
}

async function getMainSharesFolderId(misskeyUrl: string, misskeyToken: string): Promise<string | null> {
  const mainFolderName = "shares";
  
  const listMainFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      limit: 100,
    }),
  });
  
  if (!listMainFoldersResponse.ok) {
    throw new Error(`Failed to list folders: ${listMainFoldersResponse.statusText}`);
  }
  
  const mainFolders = await listMainFoldersResponse.json();
  const mainSharesFolder = mainFolders.find((folder: any) => folder.name === mainFolderName);
  
  return mainSharesFolder ? mainSharesFolder.id : null;
}

async function getShareFolderId(misskeyUrl: string, misskeyToken: string, mainFolderId: string, shareId: string): Promise<string | null> {
  const listShareFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      folderId: mainFolderId,
      limit: 100,
    }),
  });
  
  if (!listShareFoldersResponse.ok) {
    throw new Error(`Failed to list share folders: ${listShareFoldersResponse.statusText}`);
  }
  
  const shareFolders = await listShareFoldersResponse.json();
  const shareFolder = shareFolders.find((folder: any) => folder.name === shareId);
  
  return shareFolder ? shareFolder.id : null;
}

export async function POST(request: NextRequest) {
  try {
    // 检查环境变量
    if (!process.env.BACKUP_SALT || !process.env.MISSKEY_URL || !process.env.MISSKEY_TOKEN) {
      return NextResponse.json(
        { error: "Missing required environment variables" },
        { status: 500 }
      );
    }

    // 获取认证信息
    let userId: string;
    try {
      const authResult = await auth();
      if (!authResult?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = authResult.userId;
    } catch (authError) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    // 解析请求体
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { id, data } = body;
    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields: id and data" }, { status: 400 });
    }
    
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    
    // 加密数据
    let encryptionResult: { encryptedData: string; iv: string; authTag: string };
    try {
      encryptionResult = encryptData(dataString, userId);
    } catch (encryptError) {
      return NextResponse.json(
        { error: "Encryption failed" },
        { status: 500 }
      );
    }
    
    // 创建加密载荷
    const encryptedPayload = {
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv,
      authTag: encryptionResult.authTag
    };
    
    const blob = new Blob([JSON.stringify(encryptedPayload)], { type: "application/json" });
    const fileName = "data.json";
    
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    
    // 确保文件夹结构存在
    let folderId: string;
    try {
      folderId = await ensureShareFolderStructure(MISSKEY_URL, MISSKEY_TOKEN, id);
    } catch (folderError) {
      return NextResponse.json(
        { error: "Failed to create folder structure" },
        { status: 500 }
      );
    }
    
    // 删除现有文件
    try {
      const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          i: MISSKEY_TOKEN,
          folderId: folderId,
          name: fileName,
          limit: 100,
        }),
      });
      
      if (listResponse.ok) {
        const files = await listResponse.json();
        for (const file of files) {
          await fetch(`${MISSKEY_URL}/api/drive/files/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              i: MISSKEY_TOKEN,
              fileId: file.id,
            }),
          });
        }
      }
    } catch (deleteError) {
      // 删除失败不影响上传，继续执行
    }
    
    // 上传新文件
    try {
      const formData = new FormData();
      formData.append('i', MISSKEY_TOKEN);
      formData.append('file', blob, fileName);
      formData.append('folderId', folderId);
      
      const uploadResponse = await fetch(`${MISSKEY_URL}/api/drive/files/create`, {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      
      const uploadedFile = await uploadResponse.json();
      
      return NextResponse.json({
        success: true,
        url: uploadedFile.url,
        path: `shares/${id}/data.json`,
        id: id,
        message: "Share created successfully.",
      });
    } catch (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }
    
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 检查环境变量
    if (!process.env.BACKUP_SALT || !process.env.MISSKEY_URL || !process.env.MISSKEY_TOKEN) {
      return NextResponse.json(
        { error: "Missing required environment variables" },
        { status: 500 }
      );
    }

    // 获取认证信息
    let userId: string;
    try {
      const authResult = await auth();
      if (!authResult?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = authResult.userId;
    } catch (authError) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }
    
    const fileName = "data.json";
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    
    const folderId = await ensureShareFolderStructure(MISSKEY_URL, MISSKEY_TOKEN, id);
    
    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: folderId,
        name: fileName,
        limit: 1,
      }),
    });
    
    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${listResponse.statusText}`);
    }
    
    const files = await listResponse.json();
    if (files.length === 0) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }
    
    const fileInfo = files[0];
    const contentResponse = await fetch(fileInfo.url);
    if (!contentResponse.ok) {
      throw new Error(`Failed to fetch file content: ${contentResponse.statusText}`);
    }
    
    const encryptedContent = await contentResponse.text();
    
    try {
      const encryptedPayload = JSON.parse(encryptedContent);
      const decryptedData = decryptData(
        encryptedPayload.encryptedData,
        encryptedPayload.iv,
        encryptedPayload.authTag,
        userId
      );
      
      return NextResponse.json({ success: true, data: decryptedData });
    } catch (decryptError) {
      return NextResponse.json({ error: "Failed to decrypt data" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 检查环境变量
    if (!process.env.MISSKEY_URL || !process.env.MISSKEY_TOKEN) {
      return NextResponse.json(
        { error: "Missing required environment variables" },
        { status: 500 }
      );
    }

    // 获取认证信息
    try {
      const authResult = await auth();
      if (!authResult?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch (authError) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }
    
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    
    const mainFolderId = await getMainSharesFolderId(MISSKEY_URL, MISSKEY_TOKEN);
    if (!mainFolderId) {
      return NextResponse.json({ 
        success: true, 
        message: `No shares folder found, nothing to delete.` 
      });
    }

    const shareFolderId = await getShareFolderId(MISSKEY_URL, MISSKEY_TOKEN, mainFolderId, id);
    if (!shareFolderId) {
      return NextResponse.json({ 
        success: true, 
        message: `No share found with ID: ${id}, nothing to delete.` 
      });
    }

    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: shareFolderId,
        limit: 100,
      }),
    });
    
    if (listResponse.ok) {
      const files = await listResponse.json();
      for (const file of files) {
        await fetch(`${MISSKEY_URL}/api/drive/files/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            i: MISSKEY_TOKEN,
            fileId: file.id,
          }),
        });
      }
    }

    await fetch(`${MISSKEY_URL}/api/drive/folders/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: shareFolderId,
      }),
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted share with ID: ${id}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
