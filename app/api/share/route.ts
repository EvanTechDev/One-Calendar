import { put, list, del } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

// Ensure share file path is consistent
const SHARE_PATH = "shares"

export async function POST(request: NextRequest) {
  try {
    console.log("Share API: Received POST request")

    // Try to parse JSON data
    const body = await request.json()
    const { id, data } = body

    if (!id || !data) {
      console.error("Share API: Missing required fields", { id: !!id, data: !!data })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log(`Share API: Preparing to store share for ID: ${id}`)

    // Convert data to string
    const dataString = typeof data === "string" ? data : JSON.stringify(data)

    // Create Blob object
    const blob = new Blob([dataString], { type: "application/json" })

    // Build complete file path
    const filePath = `${SHARE_PATH}/${id}.json`
    console.log(`Share API: Using file path: ${filePath}`)

    // Upload to Vercel Blob
    const result = await put(filePath, blob, {
      access: "public", // Ensure it's publicly accessible
      contentType: "application/json",
    })

    console.log(`Share API: Share successfully stored at: ${result.url}`)

    return NextResponse.json({
      success: true,
      url: result.url,
      path: filePath,
      id: id,
      message: "Share created successfully.",
    })
  } catch (error) {
    console.error("Share API error:", error)
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
    console.log("Share API: Received GET request")

    const id = request.nextUrl.searchParams.get("id")

    if (!id) {
      console.error("Share API: Missing share ID")
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 })
    }

    // List all shares, find matching ID
    console.log(`Share API: Looking for share with ID: ${id}`)

    try {
      const allBlobs = await list({ prefix: SHARE_PATH })
      console.log(`Share API: Found ${allBlobs.blobs.length} total blobs`)

      // Find all files with this ID
      const matchingBlobs = allBlobs.blobs.filter((blob) => {
        return blob.pathname.includes(`/${id}.json`)
      })

      console.log(`Share API: Found ${matchingBlobs.length} matching blobs`)

      // If found matching files, use the first one
      if (matchingBlobs.length > 0) {
        const blobUrl = matchingBlobs[0].url
        console.log(`Share API: Using blob at URL: ${blobUrl}`)

        // Get blob content
        const response = await fetch(blobUrl)

        if (!response.ok) {
          console.error(`Share API: Failed to fetch blob content, status: ${response.status}`)
          return NextResponse.json({ error: "Failed to fetch share content" }, { status: 500 })
        }

        const data = await response.text()
        console.log("Share API: Successfully retrieved share data")

        return NextResponse.json({ success: true, data })
      }
    } catch (listError) {
      console.error("Share API: Error listing blobs:", listError)
    }

    // If no matching share found, return 404
    console.error("Share API: Share not found")
    return NextResponse.json(
      {
        error: "Share not found",
        id: id,
      },
      { status: 404 },
    )
  } catch (error) {
    console.error("Share API error:", error)
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
    console.log("Share API: Received DELETE request")

    // Try to parse JSON data
    const body = await request.json()
    const { id } = body

    if (!id) {
      console.error("Share API: Missing share ID")
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 })
    }

    // List all shares, find matching ID
    console.log(`Share API: Looking for share with ID: ${id} to delete`)

    try {
      const allBlobs = await list({ prefix: SHARE_PATH })
      console.log(`Share API: Found ${allBlobs.blobs.length} total blobs`)

      // Find all files with this ID
      const matchingBlobs = allBlobs.blobs.filter((blob) => {
        return blob.pathname.includes(`/${id}.json`)
      })

      console.log(`Share API: Found ${matchingBlobs.length} matching blobs to delete`)

      // Delete all matching blobs
      for (const blob of matchingBlobs) {
        console.log(`Share API: Deleting blob: ${blob.pathname}`)
        await del(blob.url)
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${matchingBlobs.length} shares with ID: ${id}`,
      })
    } catch (listError) {
      console.error("Share API: Error listing or deleting blobs:", listError)
      return NextResponse.json({ error: "Error deleting share" }, { status: 500 })
    }
  } catch (error) {
    console.error("Share API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

