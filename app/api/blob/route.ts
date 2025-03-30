import { put, list, del } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

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

    // 上传到Vercel Blob
    const result = await put(`backups/${id}.json`, blob, {
      access: "public", // 确保可以公开访问
      contentType: "application/json",
    });

    console.log(`Backup API: Backup successfully stored at: ${result.url}`);
    return NextResponse.json({ success: true, url: result.url });
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

    console.log(`Restore API: Looking for backup with ID: ${id}`);

    try {
      // 首先尝试使用Vercel Blob API直接获取
      const blobs = await list({ prefix: `backups/${id}.json` });
      console.log(`Restore API: Found ${blobs.blobs.length} matching blobs`);
      
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
      const directUrl = `https://public.blob.vercel-storage.com/backups/${id}.json`;
      console.log(`Restore API: Trying direct URL: ${directUrl}`);
      
      const directResponse = await fetch(directUrl);
      
      if (!directResponse.ok) {
        console.error(`Restore API: Failed to fetch from direct URL, status: ${directResponse.status}`);
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
      }
      
      const directData = await directResponse.text();
      console.log("Restore API: Successfully retrieved backup data from direct URL");
      
      return NextResponse.json({ success: true, data: directData });
    } catch (fetchError) {
      console.error("Restore API: Error fetching backup:", fetchError);
      
      // 最后尝试使用完全公开的URL
      try {
        const publicUrl = `https://public.blob.vercel-storage.com/backups/${id}.json`;
        console.log(`Restore API: Trying public URL as last resort: ${publicUrl}`);
        
        const publicResponse = await fetch(publicUrl);
        
        if (!publicResponse.ok) {
          console.error(`Restore API: Failed to fetch from public URL, status: ${publicResponse.status}`);
          return NextResponse.json({ error: "Backup not found" }, { status: 404 });
        }
        
        const publicData = await publicResponse.text();
        console.log("Restore API: Successfully retrieved backup data from public URL");
        
        return NextResponse.json({ success: true, data: publicData });
      } catch (publicError) {
        console.error("Restore API: Error fetching from public URL:", publicError);
        return NextResponse.json({ error: "Failed to fetch backup" }, { status: 500 });
      }
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

    try {
      // 尝试删除备份
      const blobs = await list({ prefix: `backups/${id}.json` });
      
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
