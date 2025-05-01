import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const MISSKEY_INSTANCE = process.env.MISSKEY_URL!;
const MISSKEY_TOKEN = process.env.MISSKEY_TOKEN!;

const BACKUP_FOLDER_NAME = "Backups";

// 发送文件上传请求的函数
async function uploadFile(fileBlob: Blob, fileName: string, folderId: string) {
  try {
    const formData = new FormData();
    formData.append("file", fileBlob, fileName);
    formData.append("folderId", folderId);

    const headers = {
      "Authorization": `Bearer ${MISSKEY_TOKEN}`,
      "Content-Type": "multipart/form-data",
    };

    const response = await axios.post(
      `${MISSKEY_INSTANCE}/api/drive/files/create`,
      formData,
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error("File upload failed:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Request body:", body);
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fileName = `${id}.json`;
    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const fileBlob = new Blob([dataString], { type: "application/json" });

    // 查找或创建 Backups 文件夹
    let folderId: string;
    const folders = await axios.get(`${MISSKEY_INSTANCE}/api/drive/folders`, {
      headers: { "Authorization": `Bearer ${MISSKEY_TOKEN}` }
    });
    const existing = folders.data.find((f: any) => f.name === BACKUP_FOLDER_NAME);

    if (existing) {
      folderId = existing.id;
    } else {
      const created = await axios.post(`${MISSKEY_INSTANCE}/api/drive/folders/create`, {
        name: BACKUP_FOLDER_NAME
      }, {
        headers: { "Authorization": `Bearer ${MISSKEY_TOKEN}` }
      });
      folderId = created.data.id;
    }

    // 上传新文件
    const uploadResult = await uploadFile(fileBlob, fileName, folderId);

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
