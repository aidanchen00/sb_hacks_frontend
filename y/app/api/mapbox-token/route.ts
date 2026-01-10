import { NextResponse } from "next/server"

export async function GET() {
  // This endpoint helps verify the Mapbox token is configured
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  
  if (!token || token === "") {
    return NextResponse.json(
      { 
        configured: false,
        message: "NEXT_PUBLIC_MAPBOX_TOKEN not set in .env.local"
      },
      { status: 200 }
    )
  }
  
  // Return first few chars for verification (don't expose full token)
  const preview = token.substring(0, 10) + "..."
  
  return NextResponse.json({
    configured: true,
    preview: preview,
    length: token.length
  })
}

