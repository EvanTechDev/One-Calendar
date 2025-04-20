import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

// 初始化 Supabase 客户端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 确保备份文件路径一致
const BACKUP_PATH = "backups";

export async function POST(request: NextRequest) {
    console.log("Backup API: Received POST request");
    try {
        const body = await request.json();
        console.log("Backup API: Request body", body);
        const { id, data } = body;

        if (!id || !data) {
            console.error("Backup API: Missing required fields", { id: !!id, data: !!data });
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log(`Backup API: Preparing to store backup for ID: ${id}`);
        const dataString = typeof data === "string" ? data : JSON.stringify(data);
        const filePath = `${BACKUP_PATH}/${id}.json`;
        console.log(`Backup API: Using file path: ${filePath}`);

        // 删除同 ID 的旧备份
        console.log(`Backup API: Checking for existing backups with ID: ${id}`);
        const { data: existingFiles, error: listError } = await supabase.storage.from(BACKUP_PATH).list();
        if (listError) {
            console.error("Backup API: Error listing files:", listError);
        } else {
            const matchingFiles = existingFiles.filter(file => file.name.startsWith(id));
            if (matchingFiles.length > 0) {
                console.log(`Backup API: Found ${matchingFiles.length} existing backups with same ID`);
                for (const file of matchingFiles) {
                    console.log(`Backup API: Deleting old backup: ${file.name}`);
                    await supabase.storage.from(BACKUP_PATH).remove([file.name]);
                }
                console.log(`Backup API: Successfully deleted ${matchingFiles.length} old backups`);
            } else {
                console.log(`Backup API: No existing backups found with ID: ${id}`);
            }
        }

        // 上传新备份
        console.log("Backup API: Uploading new backup");
        const { error: uploadError } = await supabase.storage.from(BACKUP_PATH).upload(filePath, new Blob([dataString]), {
            contentType: "application/json"
        });
        if (uploadError) {
            console.error("Backup API: Error uploading file:", uploadError);
            return NextResponse.json({ error: "Error uploading backup" }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage.from(BACKUP_PATH).getPublicUrl(filePath);
        console.log(`Backup API: Backup successfully stored at: ${publicUrl}`);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            path: filePath,
            actualFilename: filePath.split('/').pop(),
            id: id,
            message: "Backup created successfully. Any previous backups with the same ID were replaced."
        });
    } catch (error) {
        console.error("Backup API error:", error);
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
    console.log("Restore API: Received GET request");
    try {
        const id = request.nextUrl.searchParams.get("id");
        console.log(`Restore API: Requested backup ID: ${id}`);

        if (!id) {
            console.error("Restore API: Missing backup ID");
            return NextResponse.json({ error: "Missing backup ID" }, { status: 400 });
        }

        console.log(`Restore API: Looking for backups with ID prefix: ${id}`);
        const { data: allFiles, error: listError } = await supabase.storage.from(BACKUP_PATH).list();
        if (listError) {
            console.error("Restore API: Error listing files:", listError);
        } else {
            const matchingFiles = allFiles.filter(file => file.name.includes(id));
            console.log(`Restore API: Found ${matchingFiles.length} matching blobs:`);
            matchingFiles.forEach(b => console.log(`- ${b.name}`));
            if (matchingFiles.length > 0) {
                const filePath = `${BACKUP_PATH}/${matchingFiles[0].name}`;
                const { data: { publicUrl } } = supabase.storage.from(BACKUP_PATH).getPublicUrl(filePath);
                console.log(`Restore API: Using blob at URL: ${publicUrl}`);
                const response = await fetch(publicUrl);
                if (!response.ok) {
                    console.error(`Restore API: Failed to fetch blob content, status: ${response.status}`);
                    return NextResponse.json({ error: "Failed to fetch backup content" }, { status: 500 });
                }
                const data = await response.text();
                console.log("Restore API: Successfully retrieved backup data");
                return NextResponse.json({ success: true, data });
            }
        }

        console.error("Restore API: All attempts to fetch backup failed");
        return NextResponse.json({
            error: "Backup not found",
            id: id
        }, { status: 404 });
    } catch (error) {
        console.error("Restore API error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
