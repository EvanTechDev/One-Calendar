import { type NextRequest, NextResponse } from "next/server";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

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

function deriveKey(salt: string): { key: Buffer, iv: Buffer } {
  const hash = createHash('sha512').update(salt).digest();
  return {
    key: hash.slice(0, 32),
    iv: hash.slice(32, 48)
  };
}

function encryptData(data: string, userId: string): string {
  const { key, iv } = deriveKey(userId);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decryptData(encryptedData: string, userId: string): string {
  const { key, iv } = deriveKey(userId);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function POST(request: NextRequest) {
  try {
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }
    const body = await request.json();
    const { id, data } = body;
    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields: 'id' and 'data' are required" }, { status: 400 });
    }
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const encryptedData = encryptData(dataString, id);
    const blob = new Blob([encryptedData], { type: "application/json" });
    const fileName = "data.json";
    const folderId = await ensureCalendarFolderStructure(MISSKEY_URL, MISSKEY_TOKEN, id);
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
      id: id,
      message: "Backup created successfully"
    });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 });
    }
    const fileName = "data.json";
    const folderId = await ensureCalendarFolderStructure(MISSKEY_URL, MISSKEY_TOKEN, id);
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
    const encryptedData = await contentResponse.text();
    const decryptedData = decryptData(encryptedData, id);
    return NextResponse.json({ success: true, data: decryptedData });
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}
