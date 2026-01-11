"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, DataPacket_Kind } from "livekit-client"
import { VideoConference } from "@/components/meeting/video-conference"
import { MapboxMap } from "@/components/meeting/mapbox-map"
import { ItineraryPanel, ItineraryItem } from "@/components/meeting/itinerary-panel"

export default function MeetingPage() {
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [mapRoute, setMapRoute] = useState<any>(null)
  const [mapMarkers, setMapMarkers] = useState<any[]>([])
  const [agentState, setAgentState] = useState<string>("idle")
  const [agentThinkingMessage, setAgentThinkingMessage] = useState<string | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string>("")
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])

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
        
        // Generate a unique room name for this session (or use existing one)
        // Clear old room to get fresh agent
        const newRoomName = `nomad-${Date.now().toString(36)}`
        setRoomName(newRoomName)
        console.log(`🏠 Creating fresh room: ${newRoomName}`)
        
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: newRoomName,
            participantName: userName
          })
        })
        
        const { token, url } = await response.json()
        
        const newRoom = new Room()
        
        // Set up data channel listener for map updates and agent state
        newRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          if (kind === DataPacket_Kind.RELIABLE) {
            try {
              const data = JSON.parse(new TextDecoder().decode(payload))
              console.log("📨 [DATA RECEIVED] Received data from agent:", {
                type: data.type,
                hasRoute: !!data.route,
                hasPath: !!data.path,
                waypointsCount: data.waypoints?.length || 0,
                pathLength: data.route?.path?.length || data.path?.length || 0,
                agentState: data.state
              })
              
              // Handle agent state updates
              if (data.type === "AGENT_STATE") {
                setAgentState(data.state || "idle")
                setAgentThinkingMessage(data.thinking_message || null)
                setCurrentTool(data.tool_name || null)
              } else if (data.type === "ITINERARY_ADD") {
                // Add item to itinerary
                const newItem: ItineraryItem = data.item
                setItinerary((prev) => {
                  // Prevent duplicates
                  if (prev.some((i) => i.id === newItem.id)) {
                    return prev
                  }
                  return [...prev, newItem]
                })
              } else if (data.type === "ITINERARY_REMOVE") {
                // Remove item from itinerary by name (fuzzy match)
                const itemName = data.item_name?.toLowerCase()
                setItinerary((prev) => prev.filter((i) => !i.name.toLowerCase().includes(itemName)))
              } else if (data.type === "ITINERARY_CLEAR") {
                // Clear all itinerary items
                setItinerary([])
              } else {
                handleMapUpdate(data)
              }
            } catch (e) {
              console.error("❌ [DATA ERROR] Error parsing data channel message:", e)
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
    console.log("🗺️ [MAP UPDATE HANDLER] Processing update:", data.type)
    
    if (data.type === "MAP_UPDATE") {
      console.log("📍 [MAP UPDATE] Handling location markers")
      // Handle location markers (restaurants, activities, hotels)
      if (data.data?.restaurants) {
        const markers = data.data.restaurants.map((r: any) => ({
          id: r.name,
          coordinates: r.coordinates,
          type: "restaurant",
          data: r
        }))
        console.log(`   ✅ Added ${markers.length} restaurant markers`)
        setMapMarkers((prev) => [...prev, ...markers])
      }
      if (data.data?.activities) {
        const markers = data.data.activities.map((a: any) => ({
          id: a.name,
          coordinates: a.coordinates,
          type: "activity",
          data: a
        }))
        console.log(`   ✅ Added ${markers.length} activity markers`)
        setMapMarkers((prev) => [...prev, ...markers])
      }
      if (data.data?.hotels) {
        const markers = data.data.hotels.map((h: any) => ({
          id: h.name,
          coordinates: h.coordinates,
          type: "hotel",
          data: h
        }))
        console.log(`   ✅ Added ${markers.length} hotel markers`)
        setMapMarkers((prev) => [...prev, ...markers])
      }
    } else if (data.type === "ROUTE_UPDATE") {
      // Handle route updates - use data.route if available, otherwise use top-level data
      const routeData = data.route || {
        path: data.path || [],
        waypoints: data.waypoints || [],
        bounds: data.bounds || data.route?.bounds,
        route_type: data.route_type || "driving"
      }
      
      console.log("🛣️ [ROUTE UPDATE] Received route:", {
        pathLength: routeData.path?.length || 0,
        waypointsCount: routeData.waypoints?.length || 0,
        hasBounds: !!routeData.bounds,
        firstPathPoint: routeData.path?.[0],
        lastPathPoint: routeData.path?.[routeData.path?.length - 1]
      })
      
      setMapRoute(routeData)
      
      // Only show start and end waypoints, not every point in the path
      if (data.waypoints || routeData.waypoints) {
        const waypoints = data.waypoints || routeData.waypoints || []
        // Only use first and last waypoint (start and end)
        const startEndWaypoints = waypoints.length > 0 
          ? [waypoints[0], waypoints[waypoints.length - 1]].filter((wp, idx, arr) => 
              // Remove duplicate if start and end are the same
              idx === 0 || wp.location !== arr[0].location
            )
          : []
        
        const waypointMarkers = startEndWaypoints.map((wp: any, idx: number) => ({
          id: `waypoint-${idx}-${wp.location || wp.coordinates?.join(",") || "unknown"}`,
          coordinates: wp.coordinates,
          type: "waypoint",
          data: { ...wp, label: idx === 0 ? "Start" : "End" }
        }))
        console.log(`   ✅ Added ${waypointMarkers.length} waypoint markers (start and end only)`)
        setMapMarkers((prev) => {
          // Remove old waypoint markers and add new ones
          const filtered = prev.filter(m => m.type !== "waypoint")
          return [...filtered, ...waypointMarkers]
        })
      }
    }
  }

  // Itinerary handlers
  const handleAddToItinerary = useCallback((item: ItineraryItem) => {
    setItinerary((prev) => {
      // Prevent duplicates
      if (prev.some((i) => i.id === item.id)) {
        return prev
      }
      return [...prev, item]
    })
  }, [])

  const handleRemoveFromItinerary = useCallback((itemId: string) => {
    setItinerary((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const handleClearItinerary = useCallback(() => {
    setItinerary([])
  }, [])

  const handleReorderItinerary = useCallback((newItems: ItineraryItem[]) => {
    setItinerary(newItems)
  }, [])

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
      <div className="w-1/2 border-r border-border overflow-hidden relative">
        {room && <VideoConference room={room} />}
        
        {/* Agent Thinking State Overlay */}
        {agentState === "thinking" && agentThinkingMessage && (
          <div className="absolute bottom-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-gray-900/95 backdrop-blur-sm border border-blue-500/50 rounded-lg p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-blue-400">🤖 Agent Thinking</span>
                    {currentTool && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                        {currentTool.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300">{agentThinkingMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Agent Speaking Indicator */}
        {agentState === "speaking" && (
          <div className="absolute bottom-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-green-900/95 backdrop-blur-sm border border-green-500/50 rounded-lg p-3 shadow-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-400">🤖 Agent Speaking</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Side: Mapbox Map */}
      <div className="w-1/2 overflow-hidden relative">
        <MapboxMap 
          route={mapRoute} 
          markers={mapMarkers} 
          onAddToItinerary={handleAddToItinerary}
        />
        
        {/* Itinerary Panel */}
        <ItineraryPanel
          items={itinerary}
          onRemoveItem={handleRemoveFromItinerary}
          onClearAll={handleClearItinerary}
          onReorder={handleReorderItinerary}
        />
      </div>
    </div>
  )
}

