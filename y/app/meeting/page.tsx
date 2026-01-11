"use client"

import { useEffect, useRef, useState } from "react"
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, DataPacket_Kind } from "livekit-client"
import { VideoConference } from "@/components/meeting/video-conference"
import { MapboxMap } from "@/components/meeting/mapbox-map"

interface MCPStatus {
  yelp: {
    available: boolean
    api_key_configured: boolean
    mcp_module_loaded: boolean
    description: string
  }
  mapbox: {
    available: boolean
    api_key_configured: boolean
    description: string
  }
}

export default function MeetingPage() {
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [mapRoute, setMapRoute] = useState<any>(null)
  const [mapMarkers, setMapMarkers] = useState<any[]>([])
  const [agentState, setAgentState] = useState<string>("idle")
  const [agentThinkingMessage, setAgentThinkingMessage] = useState<string | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null)
  const [showStatusPanel, setShowStatusPanel] = useState(false)

  // Fetch MCP status on mount
  useEffect(() => {
    const fetchMCPStatus = async () => {
      try {
        const response = await fetch("http://localhost:8000/status")
        if (response.ok) {
          const data = await response.json()
          setMcpStatus(data.integrations)
        }
      } catch (error) {
        console.error("Failed to fetch MCP status:", error)
        setMcpStatus({
          yelp: { available: false, api_key_configured: false, mcp_module_loaded: false, description: "Connection failed" },
          mapbox: { available: false, api_key_configured: false, description: "Connection failed" }
        })
      }
    }
    fetchMCPStatus()
    // Refresh status every 30 seconds
    const interval = setInterval(fetchMCPStatus, 30000)
    return () => clearInterval(interval)
  }, [])

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
        <MapboxMap route={mapRoute} markers={mapMarkers} />
        
        {/* MCP Status Indicator */}
        <div className="absolute top-4 left-4 z-50">
          <button 
            onClick={() => setShowStatusPanel(!showStatusPanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm shadow-lg transition-all ${
              mcpStatus?.yelp?.available 
                ? "bg-green-900/90 border border-green-500/50 hover:bg-green-800/90" 
                : "bg-red-900/90 border border-red-500/50 hover:bg-red-800/90"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${
              mcpStatus?.yelp?.available ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`} />
            <span className="text-xs font-medium text-white">
              Yelp MCP {mcpStatus?.yelp?.available ? "Connected" : "Offline"}
            </span>
          </button>
          
          {/* Expanded Status Panel */}
          {showStatusPanel && mcpStatus && (
            <div className="mt-2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4 shadow-xl min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span>🔌</span> Integration Status
              </h3>
              
              {/* Yelp Status */}
              <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200 flex items-center gap-2">
                    <span>🍽️</span> Yelp Fusion AI
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    mcpStatus.yelp?.available 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {mcpStatus.yelp?.available ? "✓ Active" : "✗ Inactive"}
                  </span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>• API Key: {mcpStatus.yelp?.api_key_configured ? "✓ Configured" : "✗ Missing"}</p>
                  <p>• MCP Module: {mcpStatus.yelp?.mcp_module_loaded ? "✓ Loaded" : "✗ Not loaded"}</p>
                </div>
                <p className="text-xs text-gray-500 mt-2">{mcpStatus.yelp?.description}</p>
              </div>
              
              {/* Mapbox Status */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200 flex items-center gap-2">
                    <span>🗺️</span> Mapbox
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    mcpStatus.mapbox?.available 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {mcpStatus.mapbox?.available ? "✓ Active" : "✗ Inactive"}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  <p>• API Key: {mcpStatus.mapbox?.api_key_configured ? "✓ Configured" : "✗ Missing"}</p>
                </div>
                <p className="text-xs text-gray-500 mt-2">{mcpStatus.mapbox?.description}</p>
              </div>
              
              {/* Services List */}
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-xs font-medium text-gray-400 mb-2">Available Services:</p>
                <div className="flex flex-wrap gap-1">
                  {mcpStatus.yelp?.available && (
                    <>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Restaurants</span>
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">Activities</span>
                      <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">Hotels</span>
                    </>
                  )}
                  {mcpStatus.mapbox?.available && (
                    <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">Routes</span>
                  )}
                  {!mcpStatus.yelp?.available && !mcpStatus.mapbox?.available && (
                    <span className="text-xs text-red-400">No services available - check API keys</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

