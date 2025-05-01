import { api } from "misskey-js";
import { type NextRequest, NextResponse } from "next/server";

const BACKUP_FOLDER_NAME = "Backups";

const MISSKEY_URL = process.env.MISSKEY_URL!;
const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN!;

const drive = new api({ origin: MISSKEY_URL, credential: MISSKEY_TOKEN });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fileName = `${id}.json`;
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const fileBlob = new Blob([dataString], { type: "application/json" });

    // 查找或创建 Backups 文件夹
    let folderId: string;
    const folders = await drive.request("drive/folders", {});
    const existing = folders.find((f: any) => f.name === BACKUP_FOLDER_NAME);

    if (existing) {
      folderId = existing.id;
    } else {
      const created = await drive.request("drive/folders/create", {
        name: BACKUP_FOLDER_NAME
      });
      folderId = created.id;
    }

    // 删除已有的同名备份文件（如果存在）
    const files = await drive.request("drive/files", { folderId });
    const toDelete = files.find((f: any) => f.name === fileName);
    if (toDelete) {
      await drive.request("drive/files/delete", { fileId: toDelete.id });
    }

    // 上传新文件
    const uploadResult = await drive.uploadFile(fileBlob, fileName, folderId);

    return NextResponse.json({
      success: true,
      id,
      url: uploadResult.url,
      name: uploadResult.name,
      folderId,
      message: "Backup created successfully."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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

    const fileName = `${id}.json`;

    // 查找 Backups 文件夹
    const folders = await drive.request("drive/folders", {});
    const folder = folders.find((f: any) => f.name === BACKUP_FOLDER_NAME);
    if (!folder) {
      return NextResponse.json({ error: "Backup folder not found" }, { status: 404 });
    }

    // 查找指定文件
    const files = await drive.request("drive/files", { folderId: folder.id });
    const match = files.find((f: any) => f.name === fileName);
    if (!match) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    // 获取文件内容
    const response = await fetch(match.url);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
    }
    const content = await response.text();

    return NextResponse.json({ success: true, data: content });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
