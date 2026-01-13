import { NextRequest, NextResponse } from "next/server"
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk"

const AGENT_NAME = "nomad-agent"

export async function POST(request: NextRequest) {
  try {
    const { roomName: requestedRoom, participantName } = await request.json()

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.LIVEKIT_URL

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 }
      )
    }

    // Use provided room name
    const roomName = requestedRoom || `nomad-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
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

    // Simple agent dispatch - just dispatch, LiveKit handles the rest
    try {
      const agentDispatch = new AgentDispatchClient(livekitUrl, apiKey, apiSecret)
      await agentDispatch.createDispatch(roomName, AGENT_NAME)
      console.log(`✅ Agent dispatched to room: ${roomName}`)
    } catch (dispatchError: any) {
      // Dispatch errors are okay - agent might already be assigned
      console.log(`ℹ️ Agent dispatch note: ${dispatchError?.message || "unknown"}`)
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

