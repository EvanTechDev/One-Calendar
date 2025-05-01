import { type NextRequest, NextResponse } from "next/server";

let calendarFolderId: string | null = null;
const userFolderCache: { [userId: string]: string } = {};

async function ensureCalendarFolder(misskeyUrl: string, misskeyToken: string): Promise<string> {
  if (calendarFolderId) {
    return calendarFolderId;
  }

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
  const calendarFolder = folders.find((folder: any) => folder.name === 'calendar');

  if (calendarFolder) {
    calendarFolderId = calendarFolder.id;
    return calendarFolderId;
  }

  const createFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      name: 'calendar',
    }),
  });

  if (!createFolderResponse.ok) {
    throw new Error(`Failed to create calendar folder: ${createFolderResponse.statusText}`);
  }

  const newFolder = await createFolderResponse.json();
  calendarFolderId = newFolder.id;
  return calendarFolderId;
}

async function ensureUserFolder(misskeyUrl: string, misskeyToken: string, userId: string, parentFolderId: string): Promise<string> {
  if (userFolderCache[userId]) {
    return userFolderCache[userId];
  }

  const userFolderName = `${userId}`;

  const listFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      parentId: parentFolderId,
      limit: 100,
    }),
  });

  if (!listFoldersResponse.ok) {
    throw new Error(`Failed to list user folders: ${listFoldersResponse.statusText}`);
  }

  const folders = await listFoldersResponse.json();
  const userFolder = folders.find((folder: any) => folder.name === userFolderName);

  if (userFolder) {
    userFolderCache[userId] = userFolder.id;
    return userFolder.id;
  }

  const createFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      name: userFolderName,
      parentId: parentFolderId,
    }),
  });

  if (!createFolderResponse.ok) {
    throw new Error(`Failed to create user folder: ${createFolderResponse.statusText}`);
  }

  const newFolder = await createFolderResponse.json();
  userFolderCache[userId] = newFolder.id;
  return newFolder.id;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const blob = new Blob([dataString], { type: "application/json" });
    const fileName = `${id}.json`;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;

    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const parentFolderId = await ensureCalendarFolder(MISSKEY_URL, MISSKEY_TOKEN);
    const userFolderId = await ensureUserFolder(MISSKEY_URL, MISSKEY_TOKEN, userId, parentFolderId);

    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: userFolderId,
        name: fileName,
        limit: 10,
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
    formData.append('folderId', userFolderId);

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
      message: "Backup created successfully. Any previous backups with the same ID were replaced."
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
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 });
    }

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const fileName = `${id}.json`;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;

    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const parentFolderId = await ensureCalendarFolder(MISSKEY_URL, MISSKEY_TOKEN);
    const userFolderId = await ensureUserFolder(MISSKEY_URL, MISSKEY_TOKEN, userId, parentFolderId);

    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: userFolderId,
        name: fileName,
        limit: 1,
      }),
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${listResponse.statusText}`);
    }

    const files = await listResponse.json();

    if (files.length === 0) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const file = files[0];
    const fileUrl = file.url;

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
