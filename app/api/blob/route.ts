import { type NextRequest, NextResponse } from "next/server";

let calendarFolderId: string | null = null;

async function ensureCalendarFolder(misskeyUrl: string, misskeyToken: string): Promise<string> {
  if (calendarFolderId) return calendarFolderId;

  const listFoldersResponse = await fetch(`${misskeyUrl}/api/drive/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ i: misskeyToken, limit: 100 }),
  });
  if (!listFoldersResponse.ok) throw new Error("Failed to list folders");
  const folders = await listFoldersResponse.json();
  const calendarFolder = folders.find((folder: any) => folder.name === "calendar");

  if (calendarFolder) {
    calendarFolderId = calendarFolder.id;
    return calendarFolderId;
  }

  const createFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ i: misskeyToken, name: "calendar" }),
  });
  if (!createFolderResponse.ok) throw new Error("Failed to create folder");
  const newFolder = await createFolderResponse.json();
  calendarFolderId = newFolder.id;
  return calendarFolderId;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;
    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const folderId = await ensureCalendarFolder(MISSKEY_URL, MISSKEY_TOKEN);
    const fileName = `${id}.json`;

    // List existing files
    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ i: MISSKEY_TOKEN, folderId, name: fileName, limit: 1 }),
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list files: ${listResponse.statusText}`);
    }

    const files = await listResponse.json();
    let currentData = {};

    if (files.length > 0) {
      const fileUrl = files[0].url;
      const contentResponse = await fetch(fileUrl);
      if (contentResponse.ok) {
        const content = await contentResponse.text();
        currentData = JSON.parse(content);
      }
    }

    // Add or update current user's data
    currentData[userId] = data;

    const updatedContent = JSON.stringify(currentData);
    const blob = new Blob([updatedContent], { type: "application/json" });

    // Delete existing files
    for (const file of files) {
      await fetch(`${MISSKEY_URL}/api/drive/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ i: MISSKEY_TOKEN, fileId: file.id }),
      });
    }

    // Upload new file
    const formData = new FormData();
    formData.append("i", MISSKEY_TOKEN);
    formData.append("file", blob, fileName);
    formData.append("folderId", folderId);

    const uploadResponse = await fetch(`${MISSKEY_URL}/api/drive/files/create`, {
      method: "POST",
      body: formData,
    });
    if (!uploadResponse.ok) throw new Error("Failed to upload file");

    const uploadedFile = await uploadResponse.json();
    return NextResponse.json({
      success: true,
      url: uploadedFile.url,
      id,
      message: "Backup created successfully",
    });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 });
    }

    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const folderId = await ensureCalendarFolder(MISSKEY_URL, MISSKEY_TOKEN);
    const fileName = `${id}.json`;

    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ i: MISSKEY_TOKEN, folderId, name: fileName, limit: 1 }),
    });
    if (!listResponse.ok) throw new Error("Failed to list files");

    const files = await listResponse.json();
    if (files.length === 0) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const fileUrl = files[0].url;
    const contentResponse = await fetch(fileUrl);
    if (!contentResponse.ok) throw new Error("Failed to fetch file content");

    const content = await contentResponse.text();
    const data = JSON.parse(content);

    if (!data[userId]) {
      return NextResponse.json({ error: "No backup found for this user" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: data[userId] });
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
