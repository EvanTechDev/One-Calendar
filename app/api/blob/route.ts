import { put, list, del } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { id, data } = await request.json()

    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 检查是否已存在同ID的备份
    const { blobs } = await list()
    const existingBlob = blobs.find((blob) => blob.pathname === `backups/${id}.json`)

    if (existingBlob) {
      // 如果存在，先删除旧备份
      await del(existingBlob.url)
    }

    // 上传新备份
    const blob = await put(`backups/${id}.json`, data, {
      contentType: "application/json",
    })

    return NextResponse.json({ success: true, url: blob.url })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 })
    }

    // 查找备份
    const { blobs } = await list()
    const backup = blobs.find((blob) => blob.pathname === `backups/${id}.json`)

    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 })
    }

    // 获取备份数据
    const response = await fetch(backup.url)
    const data = await response.text()

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 })
    }

    // 查找备份
    const { blobs } = await list()
    const backup = blobs.find((blob) => blob.pathname === `backups/${id}.json`)

    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 })
    }

    // 删除备份
    await del(backup.url)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

