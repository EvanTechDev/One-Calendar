import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

const BACKUP_PATH = "backups";

// POST 请求 - 上传备份
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();  // 解析 JSON 请求体

    const { id, data, supabaseKey, supabaseUrl } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const buffer = Buffer.from(dataString, "utf-8");  // 使用 Buffer 处理数据

    // 如果提供了 Supabase Key 和 Supabase URL
    if (supabaseKey && supabaseUrl) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 检查是否已经存在备份文件
      const { data: existing, error: listError } = await supabase.storage.from("backups").list("", { search: id });
      if (listError) {
        return NextResponse.json({ error: `Supabase list error: ${listError.message}` }, { status: 500 });
      }

      // 如果存在，删除已有文件
      if (existing && existing.length > 0) {
        for (const file of existing) {
          await supabase.storage.from("backups").remove([file.name]);
        }
      }

      // 上传备份文件到 Supabase
      const upload = await supabase.storage.from("backups").upload(`${id}.json`, buffer, {
        contentType: "application/json",
        upsert: true, // 允许文件覆盖
      });

      if (upload.error) {
        return NextResponse.json({ error: upload.error.message }, { status: 500 });
      }

      const url = `${supabaseUrl}/storage/v1/object/public/backups/${id}.json`;

      return NextResponse.json({
        success: true,
        url,
        path: `${id}.json`,
        actualFilename: `${id}.json`,
        id,
        message: "Backup created with Supabase.",
      });
    }

    return NextResponse.json({ error: "Missing Supabase URL or Key" }, { status: 400 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// GET 请求 - 下载备份
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const supabaseKey = request.nextUrl.searchParams.get("supabaseKey");
    const supabaseUrl = request.nextUrl.searchParams.get("supabaseUrl");

    if (!id) {
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 });
    }

    if (supabaseKey && supabaseUrl) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: file, error } = await supabase.storage.from("backups").download(`${id}.json`);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      const text = await file.text();

      return NextResponse.json({ success: true, data: text });
    }

    return NextResponse.json({ error: "Missing Supabase URL or Key" }, { status: 400 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
