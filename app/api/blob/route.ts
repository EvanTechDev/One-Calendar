import { put, list, del } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

const BACKUP_PATH = "backups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data, vercelBlobKey, supabaseKey, supabaseUrl } = body;

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data);
    const blob = new Blob([dataString], { type: "application/json" });
    const filePath = `${BACKUP_PATH}/${id}.json`;

    if (supabaseKey && supabaseUrl) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: existing, error: listError } = await supabase.storage.from("backups").list("", { search: id });
      if (listError) console.error("Supabase list error", listError);

      if (existing && existing.length > 0) {
        for (const file of existing) {
          await supabase.storage.from("backups").remove([file.name]);
        }
      }

      const upload = await supabase.storage.from("backups").upload(`${id}.json`, blob, {
        contentType: "application/json",
        upsert: true,
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

    const existingBlobs = await list();
    const allBlobs = existingBlobs?.blobs ?? [];

    const matchingBlobs = allBlobs.filter(blob => {
      const pathname = blob.pathname;
      return pathname.startsWith(`${BACKUP_PATH}/${id}`) || 
             pathname.includes(`/${id}_`) ||
             pathname === `${id}.json`;
    });

    for (const blob of matchingBlobs) {
      if (blob?.url) await del(blob.url);
    }

    const result = await put(filePath, blob, {
      access: "public",
      contentType: "application/json",
    });

    const actualUrl = result.url;
    const actualFilename = actualUrl.split("/").pop() ?? "";

    return NextResponse.json({ 
      success: true, 
      url: result.url,
      path: filePath,
      actualFilename,
      id,
      message: "Backup created with Vercel Blob.",
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

    const allBlobs = await list();
    const matchingBlobs = allBlobs.blobs.filter(blob => {
      const pathname = blob.pathname;
      return pathname.includes(`/${id}`) || pathname.includes(`/${id}_`);
    });

    if (matchingBlobs.length > 0) {
      const blobUrl = matchingBlobs[0].url;
      const response = await fetch(blobUrl);
      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
      }
      const data = await response.text();
      return NextResponse.json({ success: true, data });
    }

    const possibleUrls = [
      `https://public.blob.vercel-storage.com/${BACKUP_PATH}/${id}.json`,
      `https://public.blob.vercel-storage.com/${id}.json`,
      `https://public.blob.vercel-storage.com/backups/${id}.json`
    ];

    for (const url of possibleUrls) {
      try {
        const directResponse = await fetch(url);
        if (directResponse.ok) {
          const directData = await directResponse.text();
          return NextResponse.json({ success: true, data: directData });
        }
      } catch {}
    }

    return NextResponse.json({ error: "Backup not found", id }, { status: 404 });
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
