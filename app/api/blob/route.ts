import { put, list, del } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

// 确保备份文件路径一致
const BACKUP_PATH = "backups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 将数据转换为字符串
    const dataString = typeof data === "string" ? data : JSON.stringify(data);

    // 创建Blob对象
    const blob = new Blob([dataString], { type: "application/json" });

    // 构建完整的文件路径
    const filePath = `${BACKUP_PATH}/${id}.json`;

    // 上传到Vercel Blob
    const result = await put(filePath, blob, {
      access: "public",
      contentType: "application/json",
    });
    
    return NextResponse.json({ 
      success: true, 
      url: result.url,
      path: filePath,
      id: id,
      message: "Backup created successfully"
    });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
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

    // 列出所有备份，查找匹配的ID
    const allBlobs = await list();
    
    // 查找匹配的备份文件
    const matchingBlobs = allBlobs.blobs.filter(blob => 
      blob.pathname.includes(`/${id}`) || 
      blob.pathname.includes(`/${id}_`) ||
      blob.pathname === `${id}.json`
    );
    
    // 如果找到匹配的文件，使用最新的一个
    if (matchingBlobs.length > 0) {
      // 按上传时间排序，获取最新的备份
      const latestBackup = matchingBlobs.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
      
      // 获取blob内容
      const response = await fetch(latestBackup.url);
      
      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
      }
      
      const data = await response.text();
      
      return NextResponse.json({ success: true, data });
    }
    
    return NextResponse.json({ 
      error: "Backup not found", 
      id: id,
    }, { status: 404 });
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
