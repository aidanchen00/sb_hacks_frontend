import { NextRequest, NextResponse } from "next/server"
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk"

export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName } = await request.json()

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.LIVEKIT_URL

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 }
      )
    }

    console.log(`🏠 Token requested for room: ${roomName}, participant: ${participantName}`)

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName || "user",
      name: participantName || "User"
    })

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    })

    const token = await at.toJwt()

    // Dispatch ONE agent to this fresh room
    try {
      const agentDispatch = new AgentDispatchClient(livekitUrl, apiKey, apiSecret)
      await agentDispatch.createDispatch(roomName, "")
      console.log(`✅ Agent dispatched for fresh room: ${roomName}`)
    } catch (dispatchError: any) {
      // If dispatch fails, it might already have an agent - that's okay
      console.log(`ℹ️ Agent dispatch note:`, dispatchError?.message || "Agent may already exist")
    }

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName: roomName
    })
  } catch (error) {
    console.error("Error generating token:", error)
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    )
  }
}

