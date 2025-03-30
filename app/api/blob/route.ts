import { put, list, del } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

// 添加更详细的日志记录
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
    
    // 检查是否已存在同ID的备份
    console.log("Backup API: Checking for existing backups");
    const { blobs } = await list();
    const existingBlob = blobs.find(blob => blob.pathname === `backups/${id}.json`);
    
    if (existingBlob) {
      console.log(`Backup API: Found existing backup, deleting: ${existingBlob.url}`);
      // 如果存在，先删除旧备份
      await del(existingBlob.url);
    }
    
    // 上传新备份
    console.log("Backup API: Uploading new backup");
    const blob = await put(`backups/${id}.json`, data, {
      contentType: "application/json",
      access: 'public', // 确保可以公开访问
    });
    
    console.log(`Backup API: Backup successfully stored at: ${blob.url}`);
    return NextResponse.json({ success: true, url: blob.url });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
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
    
    // 查找备份
    const { blobs } = await list();
    const backup = blobs.find(blob => blob.pathname === `backups/${id}.json`);
    
    if (!backup) {
      console.error(`Restore API: No backup found for ID: ${id}`);
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    
    console.log(`Restore API: Found backup at: ${backup.url}`);
    
    // 获取备份数据
    const response = await fetch(backup.url);
    
    if (!response.ok) {
      console.error(`Restore API: Failed to fetch backup data, status: ${response.status}`);
      return NextResponse.json({ error: "Failed to fetch backup data" }, { status: 500 });
    }
    
    const data = await response.text();
    console.log("Restore API: Successfully retrieved backup data");
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
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
    
    console.log(`Delete API: Looking for backup with ID: ${id}`);
    
    // 查找备份
    const { blobs } = await list();
    const backup = blobs.find(blob => blob.pathname === `backups/${id}.json`);
    
    if (!backup) {
      console.error(`Delete API: No backup found for ID: ${id}`);
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    
    console.log(`Delete API: Deleting backup at: ${backup.url}`);
    
    // 删除备份
    await del(backup.url);
    console.log("Delete API: Backup successfully deleted");
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete API error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
