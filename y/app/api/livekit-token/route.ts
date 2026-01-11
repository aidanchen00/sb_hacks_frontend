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

    // Generate unique room name to prevent agent conflicts
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

    // Check if room already has an agent before dispatching
    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret)
    let hasAgent = false
    
    try {
      const participants = await roomService.listParticipants(roomName)
      hasAgent = participants.some(p => 
        p.identity?.toLowerCase().includes("agent") ||
        p.name?.toLowerCase().includes("agent") ||
        p.name?.toLowerCase().includes("nomad")
      )
      console.log(`📊 Room ${roomName}: ${participants.length} participants, hasAgent: ${hasAgent}`)
    } catch (e) {
      // Room might not exist yet, which is fine
      console.log(`ℹ️ Room ${roomName} may not exist yet`)
    }

    // Dispatch agent only if not already present
    if (!hasAgent) {
      try {
        const agentDispatch = new AgentDispatchClient(livekitUrl, apiKey, apiSecret)
        // Dispatch with explicit agent name for better tracking
        await agentDispatch.createDispatch(roomName, AGENT_NAME)
        console.log(`✅ Agent "${AGENT_NAME}" dispatched to room: ${roomName}`)
      } catch (dispatchError: any) {
        // If dispatch fails with "already exists", that's okay
        const msg = dispatchError?.message || ""
        if (msg.includes("already") || msg.includes("exists")) {
          console.log(`ℹ️ Agent dispatch: agent already dispatched`)
        } else {
          console.warn(`⚠️ Agent dispatch failed:`, msg)
        }
      }
    } else {
      console.log(`ℹ️ Agent already in room ${roomName}, skipping dispatch`)
    }

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName: roomName // Return the actual room name used
    })
  } catch (error) {
    console.error("Error generating token:", error)
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    )
  }
}

