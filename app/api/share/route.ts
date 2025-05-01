import { type NextRequest, NextResponse } from "next/server";

let sharesFolderId: string | null = null;

async function ensureSharesFolder(misskeyUrl: string, misskeyToken: string): Promise<string> {
  if (sharesFolderId) {
    return sharesFolderId;
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
  const sharesFolder = folders.find((folder: any) => folder.name === 'shares');

  if (sharesFolder) {
    sharesFolderId = sharesFolder.id;
    return sharesFolderId;
  }

  const createFolderResponse = await fetch(`${misskeyUrl}/api/drive/folders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: misskeyToken,
      name: 'shares',
    }),
  });

  if (!createFolderResponse.ok) {
    throw new Error(`Failed to create shares folder: ${createFolderResponse.statusText}`);
  }

  const newFolder = await createFolderResponse.json();
  sharesFolderId = newFolder.id;
  return sharesFolderId;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const blob = new Blob([dataString], { type: "application/json" });
    const fileName = `${id}.json`;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;

    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const folderId = await ensureSharesFolder(MISSKEY_URL, MISSKEY_TOKEN);

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
      path: `shares/${id}.json`,
      id: id,
      message: "Share created successfully.",
    });
  } catch (error) {
    console.error("Share API error:", error);
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
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    const fileName = `${id}.json`;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;

    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const folderId = await ensureSharesFolder(MISSKEY_URL, MISSKEY_TOKEN);

    const folderShowResponse = await fetch(`${MISSKEY_URL}/api/drive/folders/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        folderId: folderId,
      }),
    });

    if (!folderShowResponse.ok) {
      throw new Error(`Failed to show folder: ${folderShowResponse.statusText}`);
    }

    const folderInfo = await folderShowResponse.json();

    if (folderInfo.name !== 'shares') {
      throw new Error("Shares folder not found");
    }

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

    const fileId = files[0].id;

    const fileShowResponse = await fetch(`${MISSKEY_URL}/api/drive/files/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: MISSKEY_TOKEN,
        fileId: fileId,
      }),
    });

    if (!fileShowResponse.ok) {
      throw new Error(`Failed to show file: ${fileShowResponse.statusText}`);
    }

    const fileInfo = await fileShowResponse.json();

    if (fileInfo.folderId !== folderId || fileInfo.name !== fileName) {
      throw new Error("File does not match");
    }

    const contentResponse = await fetch(fileInfo.url);

    if (!contentResponse.ok) {
      throw new Error(`Failed to fetch file content: ${contentResponse.statusText}`);
    }

    const data = await contentResponse.text();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    const fileName = `${id}.json`;

    const MISSKEY_URL = process.env.MISSKEY_URL;
    const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN;

    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
      throw new Error("MISSKEY_URL or MISSKEY_TOKEN is not set");
    }

    const folderId = await ensureSharesFolder(MISSKEY_URL, MISSKEY_TOKEN);

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

    return NextResponse.json({
      success: true,
      message: `Successfully deleted shares with ID: ${id}`,
    });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}
