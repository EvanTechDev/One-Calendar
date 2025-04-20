import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

// 初始化 Supabase 客户端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 确保备份文件路径一致
const BACKUP_PATH = "backups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const filePath = `${BACKUP_PATH}/${id}.json`;

    // 删除同 ID 的旧备份
    const { data: existingFiles, error: listError } = await supabase.storage.from(BACKUP_PATH).list();
    if (listError) {
      console.error("Error listing files:", listError);
    } else {
      const matchingFiles = existingFiles.filter(file => file.name.startsWith(id));
      for (const file of matchingFiles) {
        await supabase.storage.from(BACKUP_PATH).remove([file.name]);
      }
    }

    // 上传新备份
    const { error: uploadError } = await supabase.storage.from(BACKUP_PATH).upload(filePath, new Blob([dataString]), {
      contentType: "application/json"
    });
    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json({ error: "Error uploading backup" }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BACKUP_PATH).getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: filePath,
      actualFilename: filePath.split('/').pop(),
      id: id,
      message: "Backup created successfully. Any previous backups with the same ID were replaced."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
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

    const { data: allFiles, error: listError } = await supabase.storage.from(BACKUP_PATH).list();
    if (listError) {
      console.error("Error listing files:", listError);
    } else {
      const matchingFiles = allFiles.filter(file => file.name.includes(id));
      if (matchingFiles.length > 0) {
        const filePath = `${BACKUP_PATH}/${matchingFiles[0].name}`;
        const { data: { publicUrl } } = supabase.storage.from(BACKUP_PATH).getPublicUrl(filePath);
        const response = await fetch(publicUrl);
        if (!response.ok) {
          return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
        }
        const data = await response.text();
        return NextResponse.json({ success: true, data });
      }
    }

    return NextResponse.json({
      error: "Backup not found",
      id: id
    }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
