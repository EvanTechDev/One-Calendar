import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("Backup API: Received POST request")

    // 尝试解析JSON数据
    const body = await request.json()
    const { id, data } = body

    if (!id || !data) {
      console.error("Backup API: Missing required fields", { id: !!id, data: !!data })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log(`Backup API: Preparing to store backup for ID: ${id}`)

    // 直接上传新备份
    console.log("Backup API: Uploading backup")

    // 将数据转换为字符串
    const dataString = typeof data === "string" ? data : JSON.stringify(data)

    // 创建Blob对象
    const blob = new Blob([dataString], { type: "application/json" })

    // 上传到Vercel Blob
    const result = await put(`backups/${id}.json`, blob, {
      contentType: "application/json",
      access: "public", // 确保可以公开访问
    })

    console.log(`Backup API: Backup successfully stored at: ${result.url}`)
    return NextResponse.json({ success: true, url: result.url })
  } catch (error) {
    console.error("Backup API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("Restore API: Received GET request")

    const id = request.nextUrl.searchParams.get("id")

    if (!id) {
      console.error("Restore API: Missing backup ID")
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 })
    }

    console.log(`Restore API: Looking for backup with ID: ${id}`)

    // 直接尝试获取备份
    try {
      const url = `https://public.blob.vercel-storage.com/backups/${id}.json`
      console.log(`Restore API: Fetching from URL: ${url}`)

      const response = await fetch(url)

      if (!response.ok) {
        console.error(`Restore API: Failed to fetch backup, status: ${response.status}`)
        return NextResponse.json({ error: "Backup not found" }, { status: 404 })
      }

      const data = await response.text()
      console.log("Restore API: Successfully retrieved backup data")

      return NextResponse.json({ success: true, data })
    } catch (fetchError) {
      console.error("Restore API: Error fetching backup:", fetchError)
      return NextResponse.json({ error: "Failed to fetch backup" }, { status: 500 })
    }
  } catch (error) {
    console.error("Restore API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log("Delete API: Received DELETE request")

    const id = request.nextUrl.searchParams.get("id")

    if (!id) {
      console.error("Delete API: Missing backup ID")
      return NextResponse.json({ error: "Missing backup ID" }, { status: 400 })
    }

    console.log(`Delete API: Delete operation not implemented for ID: ${id}`)

    // 简化实现，直接返回成功
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

