import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const blob = new Blob([dataString], { type: "application/json" });
    const fileName = `calendar/${id}.json`;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;

    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
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

    // Upload new file
    const formData = new FormData();
    formData.append('i', MISSKEY_TOKEN);
    formData.append('file', blob, fileName);

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

    const fileName = `calendar/${id}.json`;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;

    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    // Find the file with the name
    const listResponse = await fetch(`${MISSKEY_URL}/api/drive/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
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
