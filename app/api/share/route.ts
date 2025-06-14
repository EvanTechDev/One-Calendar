import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@clerk/nextjs/server";

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
    console.log("POST: Starting request processing");

    const { userId } = await auth();
    console.log("POST: User ID from auth:", userId);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("POST: Parsing request body");
    const body = await request.json();
    const { id, data } = body;
    console.log("POST: Request body parsed - id:", id, "data type:", typeof data);
    
    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    console.log("POST: Data string length:", dataString.length);

    console.log("POST: Checking BACKUP_SALT exists:", !!process.env.BACKUP_SALT);
    console.log("POST: Checking MISSKEY_URL exists:", !!process.env.MISSKEY_URL);
    console.log("POST: Checking MISSKEY_TOKEN exists:", !!process.env.MISSKEY_TOKEN);

    console.log("POST: Starting encryption");
    const encryptionResult = encryptData(dataString, userId);
    console.log("POST: Encryption completed");

    const encryptedPayload = {
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv,
      authTag: encryptionResult.authTag
    };
    
    const blob = new Blob([JSON.stringify(encryptedPayload)], { type: "application/json" });
    const fileName = "data.json";
    
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }
    
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
      path: `shares/${id}/data.json`,
      id: id,
      message: "Share created successfully.",
    });
    } catch (error) {
    console.error("POST: Share API error:", error);
    console.error("POST: Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }
    
    const fileName = "data.json";
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }
    
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
      console.error("Decryption error:", decryptError);
      return NextResponse.json({ error: "Failed to decrypt data" }, { status: 500 });
    }
  } catch (error) {
    console.error("Share API error:", error);
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }
    
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }
    
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
    console.error("Share API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
