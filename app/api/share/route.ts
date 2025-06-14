import { type NextRequest, NextResponse } from "next/server";

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
    const body = await request.json();
    const { id, data } = body;
    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const blob = new Blob([dataString], { type: "application/json" });
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
        error: error.message,
      },
      { status: 500 }
    );
  }
}
