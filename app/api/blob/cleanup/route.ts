import { list, del } from "@vercel/blob"
import { NextResponse } from "next/server"

// 清理超过指定天数的备份
const DAYS_TO_KEEP = 30 // 保留最近30天的备份

export async function POST(request: Request) {
  try {
    console.log("Cleanup API: Starting backup cleanup process")

    // 获取所有备份
    const allBlobs = await list()
    console.log(`Cleanup API: Found ${allBlobs.blobs.length} total blobs`)

    // 计算截止日期
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP)

    // 找出需要删除的旧备份
    const oldBlobs = allBlobs.blobs.filter((blob) => {
      return new Date(blob.uploadedAt) < cutoffDate
    })

    console.log(`Cleanup API: Found ${oldBlobs.length} blobs older than ${DAYS_TO_KEEP} days`)

    // 删除旧备份
    const deletedBlobs = []
    for (const blob of oldBlobs) {
      try {
        console.log(`Cleanup API: Deleting old backup: ${blob.pathname}`)
        await del(blob.url)
        deletedBlobs.push(blob.pathname)
      } catch (error) {
        console.error(`Cleanup API: Error deleting blob ${blob.pathname}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Deleted ${deletedBlobs.length} old backups.`,
      deletedBlobs,
    })
  } catch (error) {
    console.error("Cleanup API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

