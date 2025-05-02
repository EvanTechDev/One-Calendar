import { type NextRequest, NextResponse } from "next/server";

async function ensureCalendarFolder(misskeyUrl: string, misskeyToken: string, userId: string): Promise<string> {
  const folderName = `calendar_${userId}`;
  
  const listFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      limit: 100,
    }),
  });
  if (!listFoldersResponse.ok) {
    throw new Error(`Failed to list folders: ${listFoldersResponse.statusText}`);
  }
  
  const folders = await listFoldersResponse.json();
  const calendarFolder = folders.find((folder: any) => folder.name === folderName);
  
  if (calendarFolder) {
    return calendarFolder.id;
  }
  
  const createFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      name: folderName,
    }),
  });
  if (!createFolderResponse.ok) {
    throw new Error(`Failed to create calendar folder: ${createFolderResponse.statusText}`);
  }
  
  const newFolder = await createFolderResponse.json();
  return newFolder.id;
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
    const blob = new Blob([dataString], { type: "application/json" });
    const fileName = `${id}.json`;
    const folderId = await ensureCalendarFolder(MISSKEY_URL, MISSKEY_TOKEN, id);
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
    const fileName = `${id}.json`;
    const folderId = await ensureCalendarFolder(MISSKEY_URL, MISSKEY_TOKEN, id);
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
    const data = await contentResponse.text();
    return NextResponse.json({ success: true, data });
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
