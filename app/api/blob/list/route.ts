import { list } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("List API: Received GET request to list all backups")

    // 尝试列出所有备份文件
    const result = await list()

    // 提取所有备份文件的路径
    const backups = result.blobs.map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }))

    console.log(`List API: Found ${backups.length} backups`)

    return NextResponse.json({
      success: true,
      backups,
      count: backups.length,
    })
  } catch (error) {
    console.error("List API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

