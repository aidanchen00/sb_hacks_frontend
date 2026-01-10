"use client"

import { useEffect, useRef, useState } from "react"
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, DataPacket_Kind } from "livekit-client"
import { VideoConference } from "@/components/meeting/video-conference"
import { MapboxMap } from "@/components/meeting/mapbox-map"

export default function MeetingPage() {
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [mapRoute, setMapRoute] = useState<any>(null)
  const [mapMarkers, setMapMarkers] = useState<any[]>([])

  useEffect(() => {
    // Initialize LiveKit room
    const connectToRoom = async () => {
      try {
        // Get room token from your backend API
        // Get user name from localStorage or prompt
        const userName = localStorage.getItem("userName") || `User-${Math.random().toString(36).substr(2, 9)}`
        if (!localStorage.getItem("userName")) {
          localStorage.setItem("userName", userName)
        }
        
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: "nomadsync-room",
            participantName: userName
          })
        })
        
        const { token, url } = await response.json()
        
        const newRoom = new Room()
        
        // Set up data channel listener for map updates
        newRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          if (kind === DataPacket_Kind.RELIABLE) {
            try {
              const data = JSON.parse(new TextDecoder().decode(payload))
              handleMapUpdate(data)
            } catch (e) {
              console.error("Error parsing data channel message:", e)
            }
          }
        })
        
        await newRoom.connect(url, token)
        
        // Enable camera and microphone by default
        await newRoom.localParticipant.setCameraEnabled(true)
        await newRoom.localParticipant.setMicrophoneEnabled(true)
        
        setRoom(newRoom)
        setIsConnected(true)
      } catch (error) {
        console.error("Failed to connect to room:", error)
      }
    }

    connectToRoom()

    return () => {
      if (room) {
        room.disconnect()
      }
    }
  }, [])

  const handleMapUpdate = (data: any) => {
    if (data.type === "MAP_UPDATE") {
      // Handle location markers (restaurants, activities, hotels)
      if (data.data?.restaurants) {
        const markers = data.data.restaurants.map((r: any) => ({
          id: r.name,
          coordinates: r.coordinates,
          type: "restaurant",
          data: r
        }))
        setMapMarkers((prev) => [...prev, ...markers])
      }
      if (data.data?.activities) {
        const markers = data.data.activities.map((a: any) => ({
          id: a.name,
          coordinates: a.coordinates,
          type: "activity",
          data: a
        }))
        setMapMarkers((prev) => [...prev, ...markers])
      }
      if (data.data?.hotels) {
        const markers = data.data.hotels.map((h: any) => ({
          id: h.name,
          coordinates: h.coordinates,
          type: "hotel",
          data: h
        }))
        setMapMarkers((prev) => [...prev, ...markers])
      }
    } else if (data.type === "ROUTE_UPDATE") {
      // Handle route updates
      setMapRoute(data.route)
      if (data.waypoints) {
        const waypointMarkers = data.waypoints.map((wp: any) => ({
          id: wp.location || `waypoint-${wp.coordinates.join(",")}`,
          coordinates: wp.coordinates,
          type: "waypoint",
          data: wp
        }))
        setMapMarkers((prev) => [...prev, ...waypointMarkers])
      }
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Connecting to meeting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Side: Video Conference */}
      <div className="w-1/2 border-r border-border overflow-hidden">
        {room && <VideoConference room={room} />}
      </div>

      {/* Right Side: Mapbox Map */}
      <div className="w-1/2 overflow-hidden">
        <MapboxMap route={mapRoute} markers={mapMarkers} />
      </div>
    </div>
  )
}

