import { put, list, del } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

// 确保备份文件路径一致
const BACKUP_PATH = "backups";

export async function POST(request: NextRequest) {
  try {
    console.log("Backup API: Received POST request");

    // 尝试解析JSON数据
    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      console.error("Backup API: Missing required fields", { id: !!id, data: !!data });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`Backup API: Preparing to store backup for ID: ${id}`);

    // 将数据转换为字符串
    const dataString = typeof data === "string" ? data : JSON.stringify(data);

    // 创建Blob对象
    const blob = new Blob([dataString], { type: "application/json" });

    // 构建完整的文件路径
    const filePath = `${BACKUP_PATH}/${id}.json`;
    console.log(`Backup API: Using file path: ${filePath}`);

    // 上传到Vercel Blob
    const result = await put(filePath, blob, {
      access: "public", // 确保可以公开访问
      contentType: "application/json",
    });

    console.log(`Backup API: Backup successfully stored at: ${result.url}`);
    return NextResponse.json({ 
      success: true, 
      url: result.url,
      path: filePath,
      id: id
    });
  } catch (error) {
    console.error("Backup API error:", error);
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
    console.log("Restore API: Received GET request");

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      console.error("Restore API: Missing backup ID");
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 });
    }

    // 构建完整的文件路径
    const filePath = `${BACKUP_PATH}/${id}.json`;
    console.log(`Restore API: Looking for backup with path: ${filePath}`);

    try {
      // 首先尝试使用Vercel Blob API直接获取
      console.log(`Restore API: Listing blobs with prefix: ${filePath}`);
      const blobs = await list({ prefix: filePath });
      console.log(`Restore API: Found ${blobs.blobs.length} matching blobs:`, 
        blobs.blobs.map(b => ({ url: b.url, pathname: b.pathname })));
      
      if (blobs.blobs.length > 0) {
        const blobUrl = blobs.blobs[0].url;
        console.log(`Restore API: Found blob at URL: ${blobUrl}`);
        
        // 获取blob内容
        const response = await fetch(blobUrl);
        
        if (!response.ok) {
          console.error(`Restore API: Failed to fetch blob content, status: ${response.status}`);
          return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
        }
        
        const data = await response.text();
        console.log("Restore API: Successfully retrieved backup data");
        
        return NextResponse.json({ success: true, data });
      }
      
      // 如果没有找到，尝试直接通过URL获取
      // 尝试多种可能的URL格式
      const possibleUrls = [
        `https://public.blob.vercel-storage.com/${filePath}`,
        `https://public.blob.vercel-storage.com/${id}.json`,
        `https://public.blob.vercel-storage.com/backups/${id}.json`,
        `https://public.blob.vercel-storage.com/${BACKUP_PATH}/${id}.json`
      ];
      
      console.log(`Restore API: Trying multiple possible URLs:`, possibleUrls);
      
      // 尝试所有可能的URL
      for (const url of possibleUrls) {
        try {
          console.log(`Restore API: Trying URL: ${url}`);
          const directResponse = await fetch(url);
          
          if (directResponse.ok) {
            const directData = await directResponse.text();
            console.log(`Restore API: Successfully retrieved backup data from URL: ${url}`);
            
            return NextResponse.json({ success: true, data: directData });
          } else {
            console.log(`Restore API: Failed to fetch from URL: ${url}, status: ${directResponse.status}`);
          }
        } catch (urlError) {
          console.error(`Restore API: Error fetching from URL: ${url}`, urlError);
        }
      }
      
      // 如果所有尝试都失败，返回404
      console.error("Restore API: All attempts to fetch backup failed");
      return NextResponse.json({ 
        error: "Backup not found", 
        id: id,
        path: filePath,
        triedUrls: possibleUrls
      }, { status: 404 });
      
    } catch (fetchError) {
      console.error("Restore API: Error fetching backup:", fetchError);
      return NextResponse.json({ 
        error: "Failed to fetch backup", 
        details: fetchError instanceof Error ? fetchError.message : "Unknown error",
        id: id,
        path: filePath
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log("Delete API: Received DELETE request");

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      console.error("Delete API: Missing backup ID");
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 });
    }

    // 构建完整的文件路径
    const filePath = `${BACKUP_PATH}/${id}.json`;
    console.log(`Delete API: Looking for backup with path: ${filePath}`);

    try {
      // 尝试删除备份
      const blobs = await list({ prefix: filePath });
      
      if (blobs.blobs.length > 0) {
        await del(blobs.blobs[0].url);
        console.log(`Delete API: Successfully deleted backup for ID: ${id}`);
      } else {
        console.log(`Delete API: No backup found for ID: ${id}`);
      }
      
      return NextResponse.json({ success: true });
    } catch (deleteError) {
      console.error("Delete API: Error deleting backup:", deleteError);
      // 即使删除失败，也返回成功，因为用户可能只是想清除本地状态
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Delete API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
