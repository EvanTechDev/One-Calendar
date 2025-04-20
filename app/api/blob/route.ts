import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY
);

const BACKUP_BUCKET = 'backups';

export async function POST(request: NextRequest) {
  try {
    console.log("Backup API: Received POST request");

    const body = await request.json();
    const { id, data } = body;

    if (!id || !data) {
      console.error("Backup API: Missing required fields", { id: !!id, data: !!data });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`Backup API: Preparing to store backup for ID: ${id}`);

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const filePath = `${BACKUP_BUCKET}/${id}.json`;

    try {
      console.log(`Backup API: Checking for existing backups with ID: ${id}`);
      
      // 删除现有备份
      const { data: existingFiles, error: listError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .list('', { prefix: `${id}` });

      if (listError) {
        console.error("Backup API: Error listing existing backups", listError);
      }

      if (existingFiles && existingFiles.length > 0) {
        console.log(`Backup API: Found ${existingFiles.length} existing backups with same ID`);
        
        // 删除所有匹配的文件
        for (const file of existingFiles) {
          console.log(`Backup API: Deleting old backup: ${file.name}`);
          const { error: deleteError } = await supabase.storage
            .from(BACKUP_BUCKET)
            .remove([file.name]);
          if (deleteError) {
            console.error("Backup API: Error deleting old backup", deleteError);
          }
        }
        console.log(`Backup API: Successfully deleted ${existingFiles.length} old backups`);
      } else {
        console.log(`Backup API: No existing backups found with ID: ${id}`);
      }
    } catch (deleteError) {
      console.error("Backup API: Error deleting old backups:", deleteError);
    }

    // 上传新的备份文件
    const { error: uploadError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(filePath, Buffer.from(dataString), {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("Backup API: Error uploading new backup", uploadError);
      return NextResponse.json({ error: "Failed to upload backup" }, { status: 500 });
    }

    console.log(`Backup API: Backup successfully stored at: ${filePath}`);

    return NextResponse.json({
      success: true,
      url: `${process.env.SUPABASE_STORAGE_URL}/${BACKUP_BUCKET}/${filePath}`,
      path: filePath,
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

    const { data: blobs, error: listError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .list('', { prefix: id });

    if (listError) {
      console.error("Restore API: Error listing backups", listError);
      return NextResponse.json({ error: "Error listing backups" }, { status: 500 });
    }

    if (blobs && blobs.length > 0) {
      const file = blobs[0];
      const { signedURL, error: urlError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .createSignedUrl(file.name, 60); // Signed URL for 1 minute

      if (urlError) {
        console.error("Restore API: Error creating signed URL", urlError);
        return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
      }

      const response = await fetch(signedURL);
      if (!response.ok) {
        console.error("Restore API: Failed to fetch backup content", response.status);
        return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
      }

      const data = await response.text();
      console.log("Restore API: Successfully retrieved backup data");

      return NextResponse.json({ success: true, data });
    } else {
      console.error("Restore API: Backup not found for ID:", id);
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
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
