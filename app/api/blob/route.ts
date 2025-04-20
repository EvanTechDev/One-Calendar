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

    // 在上传新备份前，检查并删除同ID的旧备份
    try {
      console.log(`Backup API: Checking for existing backups with ID: ${id}`);
      const existingBlobs = await list();
      
      // 查找所有以该ID开头的文件
      const matchingBlobs = existingBlobs.blobs.filter(blob => {
        const pathname = blob.pathname;
        // 检查是否匹配 backups/id 或 backups/id_[additional_hash]
        return pathname.startsWith(`${BACKUP_PATH}/${id}`) || 
               pathname.includes(`/${id}_`) ||
               pathname === `${id}.json`;
      });
      
      if (matchingBlobs.length > 0) {
        console.log(`Backup API: Found ${matchingBlobs.length} existing backups with same ID`);
        
        // 删除所有匹配的旧备份
        for (const blob of matchingBlobs) {
          console.log(`Backup API: Deleting old backup: ${blob.pathname}`);
          await del(blob.url);
        }
        
        console.log(`Backup API: Successfully deleted ${matchingBlobs.length} old backups`);
      } else {
        console.log(`Backup API: No existing backups found with ID: ${id}`);
      }
    } catch (deleteError) {
      // 如果删除失败，记录错误但继续尝试上传新备份
      console.error("Backup API: Error deleting old backups:", deleteError);
    }

    // 上传到Vercel Blob
    const result = await put(filePath, blob, {
      access: "public", // 确保可以公开访问
      contentType: "application/json",
    });

    console.log(`Backup API: Backup successfully stored at: ${result.url}`);
    
    // 记录实际的URL和路径，包括Vercel可能添加的额外哈希值
    const actualUrl = result.url;
    const urlParts = actualUrl.split('/');
    const actualFilename = urlParts[urlParts.length - 1];
    
    console.log(`Backup API: Actual filename with hash: ${actualFilename}`);
    
    // 尝试列出所有备份，确认文件已存储
    try {
      const blobs = await list({ prefix: BACKUP_PATH });
      console.log(`Backup API: Current backups (${blobs.blobs.length}):`);
      blobs.blobs.forEach(b => console.log(`- ${b.pathname} (${b.url})`));
    } catch (listError) {
      console.error("Backup API: Error listing backups:", listError);
    }
    
    return NextResponse.json({ 
      success: true, 
      url: result.url,
      path: filePath,
      actualFilename: actualFilename,
      id: id,
      message: "Backup created successfully. Any previous backups with the same ID were replaced."
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

    // 列出所有备份，查找匹配的ID前缀
    console.log(`Restore API: Looking for backups with ID prefix: ${id}`);
    
    try {
      const allBlobs = await list();
      console.log(`Restore API: Found ${allBlobs.blobs.length} total blobs`);
      
      // 查找所有以该ID开头的文件
      const matchingBlobs = allBlobs.blobs.filter(blob => {
        const pathname = blob.pathname;
        // 检查是否匹配 backup_[hash] 或 backup_[hash]_[additional_hash]
        return pathname.includes(`/${id}`) || pathname.includes(`/${id}_`);
      });
      
      console.log(`Restore API: Found ${matchingBlobs.length} matching blobs:`);
      matchingBlobs.forEach(b => console.log(`- ${b.pathname} (${b.url})`));
      
      // 如果找到匹配的文件，使用第一个
      if (matchingBlobs.length > 0) {
        const blobUrl = matchingBlobs[0].url;
        console.log(`Restore API: Using blob at URL: ${blobUrl}`);
        
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
    } catch (listError) {
      console.error("Restore API: Error listing blobs:", listError);
    }
    
    // 如果没有通过列表找到，尝试多种可能的路径格式
    const possiblePaths = [
      `${BACKUP_PATH}/${id}.json`,
      `${BACKUP_PATH}/${id}_*.json`, // 通配符匹配额外哈希值
      `${id}.json`,
      `${id}_*.json`,
      id
    ];
    
    console.log(`Restore API: Will try these path patterns: ${possiblePaths.join(", ")}`);
    
    // 尝试所有可能的路径
    for (const pathPattern of possiblePaths) {
      try {
        // 如果路径包含通配符，需要特殊处理
        if (pathPattern.includes('*')) {
          const basePattern = pathPattern.replace('*', '');
          console.log(`Restore API: Trying to match pattern: ${basePattern}`);
          
          const blobs = await list({ prefix: basePattern.split('_')[0] });
          const matchingBlobs = blobs.blobs.filter(blob => 
            blob.pathname.startsWith(basePattern.split('*')[0])
          );
          
          if (matchingBlobs.length > 0) {
            const blobUrl = matchingBlobs[0].url;
            console.log(`Restore API: Found blob matching pattern at URL: ${blobUrl}`);
            
            // 获取blob内容
            const response = await fetch(blobUrl);
            
            if (!response.ok) {
              console.error(`Restore API: Failed to fetch blob content, status: ${response.status}`);
              continue;
            }
            
            const data = await response.text();
            console.log("Restore API: Successfully retrieved backup data");
            
            return NextResponse.json({ success: true, data });
          }
        } else {
          console.log(`Restore API: Trying exact path: ${pathPattern}`);
          const blobs = await list({ prefix: pathPattern });
          
          if (blobs.blobs.length > 0) {
            const blobUrl = blobs.blobs[0].url;
            console.log(`Restore API: Found blob at URL: ${blobUrl}`);
            
            // 获取blob内容
            const response = await fetch(blobUrl);
            
            if (!response.ok) {
              console.error(`Restore API: Failed to fetch blob content, status: ${response.status}`);
              continue;
            }
            
            const data = await response.text();
            console.log("Restore API: Successfully retrieved backup data");
            
            return NextResponse.json({ success: true, data });
          }
        }
      } catch (pathError) {
        console.error(`Restore API: Error with path ${pathPattern}:`, pathError);
      }
    }
    
    // 如果没有找到，尝试直接通过URL获取
    // 尝试多种可能的URL格式，包括可能的额外哈希值
    const possibleUrls = [
      `https://public.blob.vercel-storage.com/${BACKUP_PATH}/${id}.json`,
      `https://public.blob.vercel-storage.com/${id}.json`,
      `https://public.blob.vercel-storage.com/backups/${id}.json`
    ];
    
    console.log(`Restore API: Trying direct URLs:`, possibleUrls);
    
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
      triedPaths: possiblePaths,
    }, { status: 404 });
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
