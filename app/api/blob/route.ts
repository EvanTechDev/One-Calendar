import { put as vercelPut, list as vercelList, del as vercelDel } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

// 确保备份文件路径一致
const BACKUP_PATH = "backups";

// Create a Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    console.log("Backup API: Received POST request");

    const body = await request.json();
    const { id, data, storageType } = body;

    if (!id || !data) {
      console.error("Backup API: Missing required fields", { id: !!id, data: !!data });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`Backup API: Preparing to store backup for ID: ${id}`);

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const blob = new Blob([dataString], { type: "application/json" });
    const filePath = `${BACKUP_PATH}/${id}.json`;
    console.log(`Backup API: Using file path: ${filePath}`);

    // Check and delete old backups if any
    try {
      if (storageType === 'vercel') {
        console.log(`Backup API: Checking for existing backups with ID: ${id}`);
        const existingBlobs = await vercelList();
        
        const matchingBlobs = existingBlobs.blobs.filter(blob => {
          const pathname = blob.pathname;
          return pathname.startsWith(`${BACKUP_PATH}/${id}`) || pathname.includes(`/${id}_`) || pathname === `${id}.json`;
        });
        
        if (matchingBlobs.length > 0) {
          console.log(`Backup API: Found ${matchingBlobs.length} existing backups with same ID`);
          for (const blob of matchingBlobs) {
            console.log(`Backup API: Deleting old backup: ${blob.pathname}`);
            await vercelDel(blob.url);
          }
        }
      } else if (storageType === 'supabase') {
        console.log(`Backup API: Checking for existing backups in Supabase storage`);
        const { data: existingFiles, error } = await supabase.storage.from('backups').list('', { limit: 100 });

        if (error) {
          throw new Error(`Error fetching existing files: ${error.message}`);
        }

        const matchingFiles = existingFiles.filter(file => file.name.startsWith(`${id}`));

        if (matchingFiles.length > 0) {
          console.log(`Backup API: Found ${matchingFiles.length} existing backups in Supabase`);
          for (const file of matchingFiles) {
            console.log(`Backup API: Deleting old backup: ${file.name}`);
            await supabase.storage.from('backups').remove([file.name]);
          }
        }
      }
    } catch (deleteError) {
      console.error("Backup API: Error deleting old backups:", deleteError);
    }

    let result;

    if (storageType === 'vercel') {
      result = await vercelPut(filePath, blob, {
        access: "public",
        contentType: "application/json",
      });
    } else if (storageType === 'supabase') {
      const { data: uploadData, error } = await supabase.storage.from('backups').upload(filePath, blob, {
        upsert: true,
        contentType: "application/json",
      });

      if (error) {
        throw new Error(`Error uploading to Supabase: ${error.message}`);
      }

      result = {
        url: `${supabaseUrl}/storage/v1/object/public/backups/${uploadData?.path}`,
      };
    }

    console.log(`Backup API: Backup successfully stored at: ${result.url}`);

    const actualUrl = result.url;
    const urlParts = actualUrl.split('/');
    const actualFilename = urlParts[urlParts.length - 1];
    
    console.log(`Backup API: Actual filename with hash: ${actualFilename}`);
    
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
    const storageType = request.nextUrl.searchParams.get("storageType");

    if (!id || !storageType) {
      console.error("Restore API: Missing backup ID or storage type");
      return NextResponse.json({ error: "Missing backup ID or storage type" }, { status: 400 });
    }

    console.log(`Restore API: Looking for backups with ID prefix: ${id}`);

    let matchingBlobs = [];

    if (storageType === 'vercel') {
      const allBlobs = await vercelList();
      matchingBlobs = allBlobs.blobs.filter(blob => {
        const pathname = blob.pathname;
        return pathname.includes(`/${id}`) || pathname.includes(`/${id}_`);
      });
    } else if (storageType === 'supabase') {
      const { data: allFiles, error } = await supabase.storage.from('backups').list('', { limit: 100 });

      if (error) {
        throw new Error(`Error fetching files from Supabase: ${error.message}`);
      }

      matchingBlobs = allFiles.filter(file => file.name.startsWith(id));
    }

    console.log(`Restore API: Found ${matchingBlobs.length} matching blobs`);

    if (matchingBlobs.length > 0) {
      const blobUrl = matchingBlobs[0].url || `${supabaseUrl}/storage/v1/object/public/backups/${matchingBlobs[0].name}`;
      console.log(`Restore API: Using blob at URL: ${blobUrl}`);
      
      const response = await fetch(blobUrl);

      if (!response.ok) {
        console.error(`Restore API: Failed to fetch blob content, status: ${response.status}`);
        return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
      }

      const data = await response.text();
      console.log("Restore API: Successfully retrieved backup data");

      return NextResponse.json({ success: true, data });
    }

    console.error("Restore API: No matching blobs found");
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
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
