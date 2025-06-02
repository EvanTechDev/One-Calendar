import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import crypto from "crypto";

function encryptData(data: string, userId: string): { encryptedData: string; iv: string; authTag: string } {
  const salt = process.env.SALT;
  if (!salt) {
    throw new Error("SALT environment variable is not set");
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
  const salt = process.env.SALT;
  if (!salt) {
    throw new Error("SALT environment variable is not set");
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

async function ensureCalendarFolderStructure(misskeyUrl: string, misskeyToken: string, userId: string): Promise<string> {
  const mainFolderName = "calendar";
  
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
  let mainCalendarFolder = mainFolders.find((folder: any) => folder.name === mainFolderName);
  
  if (!mainCalendarFolder) {
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
      throw new Error(`Failed to create main calendar folder: ${createMainFolderResponse.statusText}`);
    }
    
    mainCalendarFolder = await createMainFolderResponse.json();
  }

  const userFolderName = userId;
  
  const listUserFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      folderId: mainCalendarFolder.id,
      limit: 100,
    }),
  });
  
  if (!listUserFoldersResponse.ok) {
    throw new Error(`Failed to list user folders: ${listUserFoldersResponse.statusText}`);
  }
  
  const userFolders = await listUserFoldersResponse.json();
  let userFolder = userFolders.find((folder: any) => folder.name === userFolderName);
  
  if (!userFolder) {
    const createUserFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: misskeyToken,
        name: userFolderName,
        parentId: mainCalendarFolder.id,
      }),
    });
    
    if (!createUserFolderResponse.ok) {
      throw new Error(`Failed to create user folder: ${createUserFolderResponse.statusText}`);
    }
    
    userFolder = await createUserFolderResponse.json();
  }
  
  return userFolder.id;
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const body = await request.json();
    const { data } = body;
    if (!data) {
      return NextResponse.json({ error: "Missing required field: 'data' is required" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    
    const { encryptedData, iv, authTag } = encryptData(dataString, userId);
    
    const encryptedPayload = {
      encryptedData,
      iv,
      authTag,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(encryptedPayload)], { type: "application/json" });
    const fileName = "data.json";
    
    const folderId = await ensureCalendarFolderStructure(MISSKEY_URL, MISSKEY_TOKEN, userId);
    
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
    
    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${listResponse.statusText}`);
    }
    
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
    
    const formData = new FormData();
    formData.append('i', MISSKEY_TOKEN);
    formData.append('file', blob, fileName);
    formData.append('folderId', folderId);
    
    const uploadResponse = await fetch(`${MISSKEY_URL}/api/drive/files/create`, {
      method: 'POST',
      body: formData,
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
    }
    
    const uploadedFile = await uploadResponse.json();
    
    return NextResponse.json({
      success: true,
      url: uploadedFile.url,
      userId: userId,
      message: "Encrypted backup created successfully"
    });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const mainFolderName = "calendar";
    
    const listMainFoldersResponse = await fetch(`${MISSKEY_URL}/api/drive/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        limit: 100,
      }),
    });
    
    if (!listMainFoldersResponse.ok) {
      throw new Error(`Failed to list folders: ${listMainFoldersResponse.statusText}`);
    }
    
    const mainFolders = await listMainFoldersResponse.json();
    const mainCalendarFolder = mainFolders.find((folder: any) => folder.name === mainFolderName);
    
    if (!mainCalendarFolder) {
      return NextResponse.json({ error: "Calendar folder not found" }, { status: 404 });
    }

    const listUserFoldersResponse = await fetch(`${MISSKEY_URL}/api/drive/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: mainCalendarFolder.id,
        limit: 100,
      }),
    });
    
    if (!listUserFoldersResponse.ok) {
      throw new Error(`Failed to list user folders: ${listUserFoldersResponse.statusText}`);
    }
    
    const userFolders = await listUserFoldersResponse.json();
    const userFolder = userFolders.find((folder: any) => folder.name === userId);
    
    if (!userFolder) {
      return NextResponse.json({ error: "User backup folder not found" }, { status: 404 });
    }

    const listFilesResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: userFolder.id,
        limit: 100,
      }),
    });
    
    if (listFilesResponse.ok) {
      const files = await listFilesResponse.json();
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

    const deleteFolderResponse = await fetch(`${MISSKEY_URL}/api/drive/folders/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: userFolder.id,
      }),
    });
    
    if (!deleteFolderResponse.ok) {
      throw new Error(`Failed to delete user folder: ${deleteFolderResponse.statusText}`);
    }

    return NextResponse.json({
      success: true,
      message: "User backup folder and all files deleted successfully",
      userId: userId
    });
  } catch (error) {
    console.error("Delete API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const fileName = "data.json";
    const folderId = await ensureCalendarFolderStructure(MISSKEY_URL, MISSKEY_TOKEN, userId);
    
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
    
    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${listResponse.statusText}`);
    }
    
    const files = await listResponse.json();
    if (files.length === 0) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    
    const latestFile = files.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const fileUrl = latestFile.url;
    
    const contentResponse = await fetch(fileUrl);
    if (!contentResponse.ok) {
      throw new Error(`Failed to fetch file content: ${contentResponse.statusText}`);
    }
    
    const encryptedContent = await contentResponse.text();
    
    try {
      const encryptedPayload = JSON.parse(encryptedContent);
      
      // 检查加密载荷的完整性
      if (!encryptedPayload.encryptedData || !encryptedPayload.iv) {
        throw new Error("Invalid encrypted backup format: missing required fields");
      }
      
      // 处理向后兼容性：如果没有authTag，说明是旧版本的备份
      if (!encryptedPayload.authTag) {
        console.warn("Backup was created with old version without auth tag, attempting compatibility mode");
        throw new Error("This backup was created with an older version and is no longer compatible. Please create a new backup.");
      }
      
      const decryptedData = decryptData(
        encryptedPayload.encryptedData, 
        encryptedPayload.iv, 
        encryptedPayload.authTag, 
        userId
      );
      
      return NextResponse.json({ 
        success: true, 
        data: decryptedData,
        timestamp: encryptedPayload.timestamp 
      });
    } catch (decryptError) {
      console.error("Decryption error:", decryptError);
      
      if (decryptError instanceof Error) {
        if (decryptError.message.includes("bad decrypt") || decryptError.message.includes("wrong final block length")) {
          return NextResponse.json(
            { error: "Authentication failed: This backup may belong to a different user or the data has been tampered with." },
            { status: 403 }
          );
        } else if (decryptError.message.includes("older version")) {
          return NextResponse.json(
            { error: decryptError.message },
            { status: 409 }
          );
        }
      }
      
      return NextResponse.json(
        { error: "Failed to decrypt backup data. Please check if this backup belongs to your account." },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
