import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

function encryptData(data: string, userId: string): { encryptedData: string; iv: string } {
  const algorithm = 'aes-256-cbc';

  const key = crypto.scryptSync(userId, 'calendar-backup-salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex')
  };
}

function decryptData(encryptedData: string, iv: string, userId: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(userId, 'calendar-backup-salt', 32);
  
  const decipher = crypto.createDecipher(algorithm, key);
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
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }

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

    const { encryptedData, iv } = encryptData(dataString, userId);
    
    const encryptedPayload = {
      encryptedData,
      iv,
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

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated" }, { status: 401 });
    }

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

      if (!encryptedPayload.encryptedData || !encryptedPayload.iv) {
        throw new Error("Invalid encrypted backup format");
      }

      const decryptedData = decryptData(encryptedPayload.encryptedData, encryptedPayload.iv, userId);
      
      return NextResponse.json({ 
        success: true, 
        data: decryptedData,
        timestamp: encryptedPayload.timestamp 
      });
    } catch (decryptError) {
      console.error("Decryption error:", decryptError);
      return NextResponse.json(
        { error: "Failed to decrypt backup data. This backup may belong to a different user or be corrupted." },
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
