"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, DataPacket_Kind } from "livekit-client"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { VideoConference } from "@/components/meeting/video-conference"
import { MapboxMap } from "@/components/meeting/mapbox-map"
import { ItineraryPanel, ItineraryItem } from "@/components/meeting/itinerary-panel"
import { WalletConnectOverlay } from "@/components/meeting/wallet-connect-overlay"

// Payment amount in SOL (devnet demo)
const PAYMENT_AMOUNT_SOL = 0.5

// Tool notification interface
interface ToolNotification {
  id: string
  tool: string
  message: string
  icon: string
}

// Map tool names to user-friendly messages and icons
const toolDisplayInfo: Record<string, { message: string; icon: string }> = {
  search_restaurants: { message: "Searching for restaurants...", icon: "🍽️" },
  get_activities: { message: "Finding activities...", icon: "🎯" },
  search_hotels: { message: "Looking for hotels...", icon: "🏨" },
  update_map: { message: "Updating route...", icon: "🗺️" },
  get_location_coordinates: { message: "Finding location...", icon: "📍" },
  add_to_itinerary: { message: "Adding to itinerary...", icon: "📋" },
  remove_from_itinerary: { message: "Removing from itinerary...", icon: "🗑️" },
  clear_itinerary: { message: "Clearing itinerary...", icon: "🧹" },
}

// Default shared room name - change this for your team!
const DEFAULT_ROOM_NAME = process.env.NEXT_PUBLIC_LIVEKIT_ROOM || "nomadsync-team"

export default function MeetingPage() {
  const searchParams = useSearchParams()
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [mapRoute, setMapRoute] = useState<any>(null)
  const [mapMarkers, setMapMarkers] = useState<any[]>([])
  const [agentState, setAgentState] = useState<string>("idle")
  const [agentThinkingMessage, setAgentThinkingMessage] = useState<string | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string>("")
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  
  // Fly to target state (from featuretemp)
  const [flyToTarget, setFlyToTarget] = useState<{ coordinates: [number, number]; name?: string; zoom?: number } | null>(null)
  const [toolNotifications, setToolNotifications] = useState<ToolNotification[]>([])
  const [routeNotification, setRouteNotification] = useState<string | null>(null)
  
  // Wallet and payment states (from Solana feature)
  const { publicKey, sendTransaction, connected: walletConnected } = useWallet()
  const { connection } = useConnection()
  const [showWalletOverlay, setShowWalletOverlay] = useState(true)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  
  // Ref to store handleCheckout for use in data listener
  const handleCheckoutRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const [paymentStatus, setPaymentStatus] = useState<{
    type: "success" | "error" | "pending" | null
    message: string
    signature?: string
  }>({ type: null, message: "" })

  // Check if Phantom is installed
  const [phantomInstalled, setPhantomInstalled] = useState(false)
  
  useEffect(() => {
    // Check for Phantom wallet
    const checkPhantom = () => {
      const phantom = (window as any)?.phantom?.solana
      setPhantomInstalled(!!phantom?.isPhantom)
    }
    checkPhantom()
    
    // Re-check after a short delay (Phantom might load after page)
    const timer = setTimeout(checkPhantom, 500)
    return () => clearTimeout(timer)
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
        
        // Room name priority: URL param > env variable > default
        // Use ?room=my-room in URL to share with teammates
        const urlRoom = searchParams.get("room")
        const newRoomName = urlRoom || DEFAULT_ROOM_NAME
        setRoomName(newRoomName)
        console.log(`🏠 Joining room: ${newRoomName}${urlRoom ? " (from URL)" : " (default)"}`)
        
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: newRoomName,
            participantName: userName
          })
        })
        
        const { token, url, roomName: actualRoomName } = await response.json()
        if (actualRoomName) {
          setRoomName(actualRoomName)
        }
        
        // Simple room with default settings
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        })
        
        // Set up data channel listener for map updates and agent state
        newRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          if (kind === DataPacket_Kind.RELIABLE) {
            try {
              const data = JSON.parse(new TextDecoder().decode(payload))
              
              // Handle agent state updates
              if (data.type === "AGENT_STATE") {
                setAgentState(data.state || "idle")
                setAgentThinkingMessage(data.thinking_message || null)
                setCurrentTool(data.tool_name || null)
                
                // Show snackbar notification when a tool is called
                if (data.tool_name && data.state === "thinking") {
                  const toolInfo = toolDisplayInfo[data.tool_name] || { 
                    message: `Running ${data.tool_name.replace(/_/g, ' ')}...`, 
                    icon: "⚙️" 
                  }
                  const notification: ToolNotification = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    tool: data.tool_name,
                    message: toolInfo.message,
                    icon: toolInfo.icon
                  }
                  setToolNotifications(prev => [...prev.slice(-2), notification]) // Keep max 3
                  // Auto-remove after 3 seconds
                  setTimeout(() => {
                    setToolNotifications(prev => prev.filter(n => n.id !== notification.id))
                  }, 3000)
                }
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
                
                // Fly to the new item's location
                if (newItem.coordinates && newItem.coordinates.length >= 2) {
                  setFlyToTarget({
                    coordinates: newItem.coordinates as [number, number],
                    name: newItem.name,
                    zoom: 17 // High zoom for detailed view
                  })
                }
              } else if (data.type === "ITINERARY_REMOVE") {
                // Remove item from itinerary by name (fuzzy match)
                const itemName = data.item_name?.toLowerCase()
                setItinerary((prev) => prev.filter((i) => !i.name.toLowerCase().includes(itemName)))
              } else if (data.type === "ITINERARY_CLEAR") {
                // Clear all itinerary items
                setItinerary([])
              } else if (data.type === "PAYMENT_EXECUTE") {
                // Agent confirmed payment - trigger wallet transaction
                console.log("💳 [PAYMENT] Agent triggered payment execution")
                // Use ref to get latest handleCheckout function
                handleCheckoutRef.current()
              } else {
                handleMapUpdate(data)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        })
        
        await newRoom.connect(url, token)
        
        // Enable camera and microphone by default (with error handling)
        try {
          await newRoom.localParticipant.setCameraEnabled(true)
        } catch (e) {
          console.warn("⚠️ Camera not available:", e)
        }
        try {
          await newRoom.localParticipant.setMicrophoneEnabled(true)
        } catch (e) {
          console.warn("⚠️ Microphone not available:", e)
        }
        
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
      const routeData = data.route || {
        path: data.path || [],
        waypoints: data.waypoints || [],
        bounds: data.bounds || data.route?.bounds,
        route_type: data.route_type || "driving"
      }
      
      setMapRoute(routeData)
      
      // Only show start and end waypoints
      if (data.waypoints || routeData.waypoints) {
        const waypoints = data.waypoints || routeData.waypoints || []
        const startEndWaypoints = waypoints.length > 0 
          ? [waypoints[0], waypoints[waypoints.length - 1]].filter((wp, idx, arr) => 
              idx === 0 || wp.location !== arr[0].location
            )
          : []
        
        const waypointMarkers = startEndWaypoints.map((wp: any, idx: number) => ({
          id: `waypoint-${idx}-${wp.location || wp.coordinates?.join(",") || "unknown"}`,
          coordinates: wp.coordinates,
          type: "waypoint",
          data: { ...wp, label: idx === 0 ? "Start" : "End" }
        }))
        setMapMarkers((prev) => {
          const filtered = prev.filter(m => m.type !== "waypoint")
          return [...filtered, ...waypointMarkers]
        })
      }
    }
  }

  // Checkout/Payment handler
  const handleCheckout = useCallback(async () => {
    if (!walletConnected || !publicKey || !sendTransaction) {
      // Don't show error - just show the wallet overlay
      setShowWalletOverlay(true)
      return
    }

    setIsProcessingPayment(true)
    setPaymentStatus({ type: "pending", message: "Preparing transaction..." })

    try {
      // Fetch vendor public key from backend
      console.log("💳 [PAYMENT] Fetching vendor wallet...")
      const vendorResponse = await fetch("http://localhost:8000/api/solana/vendor")
      if (!vendorResponse.ok) {
        throw new Error("Failed to get vendor wallet")
      }
      const { vendorPublicKey } = await vendorResponse.json()
      console.log("💳 [PAYMENT] Vendor wallet:", vendorPublicKey)

      const vendorPubKey = new PublicKey(vendorPublicKey)
      const lamports = PAYMENT_AMOUNT_SOL * LAMPORTS_PER_SOL

      // Create transaction
      setPaymentStatus({ type: "pending", message: "Building transaction..." })
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: vendorPubKey,
          lamports,
        })
      )

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Send transaction - Phantom will prompt for confirmation
      setPaymentStatus({ type: "pending", message: "Confirm in your wallet..." })
      console.log("💳 [PAYMENT] Sending transaction...")
      const signature = await sendTransaction(transaction, connection)
      console.log("💳 [PAYMENT] Transaction sent:", signature)

      // Confirm transaction
      setPaymentStatus({ type: "pending", message: "Confirming transaction..." })
      const confirmation = await connection.confirmTransaction(signature, "confirmed")
      
      if (confirmation.value.err) {
        throw new Error("Transaction failed to confirm")
      }

      console.log("✅ [PAYMENT] Transaction confirmed!")
      setPaymentStatus({
        type: "success",
        message: `Payment of ${PAYMENT_AMOUNT_SOL} SOL successful!`,
        signature,
      })

      // Auto-dismiss success message after 10 seconds
      setTimeout(() => {
        setPaymentStatus({ type: null, message: "" })
      }, 10000)

    } catch (error: any) {
      console.error("❌ [PAYMENT] Error:", error)
      
      // Check if user rejected the transaction
      const isUserRejection = 
        error.message?.includes("User rejected") || 
        error.message?.includes("rejected") ||
        error.name === "WalletSendTransactionError"
      
      if (isUserRejection) {
        setPaymentStatus({
          type: "error",
          message: "Payment cancelled. You can try again when ready.",
        })
      } else {
        setPaymentStatus({
          type: "error",
          message: error.message || "Payment failed. Please try again.",
        })
      }
    } finally {
      setIsProcessingPayment(false)
    }
  }, [walletConnected, publicKey, sendTransaction, connection])

  // Update ref when handleCheckout changes (for use in data listener)
  useEffect(() => {
    handleCheckoutRef.current = handleCheckout
  }, [handleCheckout])

  // Itinerary handlers
  const handleAddToItinerary = useCallback((item: ItineraryItem) => {
    setItinerary((prev) => {
      // Prevent duplicates
      if (prev.some((i) => i.id === item.id)) {
        return prev
      }
      return [...prev, item]
    })
    
    // Fly to the added item's location
    if (item.coordinates && item.coordinates.length >= 2) {
      setFlyToTarget({
        coordinates: item.coordinates as [number, number],
        name: item.name,
        zoom: 17
      })
    }
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

  // Update route when itinerary changes (2+ items with coordinates)
  useEffect(() => {
    const itemsWithCoords = itinerary.filter(item => 
      item.coordinates && item.coordinates.length >= 2
    )
    
    if (itemsWithCoords.length >= 2) {
      // Build waypoints from itinerary in order
      const waypoints = itemsWithCoords.map(item => ({
        location: item.name,
        coordinates: item.coordinates
      }))
      
      // Calculate route through all waypoints
      const calculateItineraryRoute = async () => {
        try {
          // Call MCP server to get route
          const response = await fetch("http://localhost:8000/tools/update_map", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              waypoints: itemsWithCoords.map(item => item.location || item.name),
              route_type: "driving"
            })
          })
          
          if (response.ok) {
            const routeData = await response.json()
            if (routeData.path && routeData.path.length > 0) {
              setMapRoute({
                path: routeData.path,
                waypoints: waypoints,
                bounds: routeData.bounds,
                route_type: "driving"
              })
              
              // Show route update notification
              const stopNames = itemsWithCoords.slice(0, 3).map(i => i.name).join(" → ")
              const suffix = itemsWithCoords.length > 3 ? ` + ${itemsWithCoords.length - 3} more` : ""
              setRouteNotification(`Route updated: ${stopNames}${suffix}`)
              setTimeout(() => setRouteNotification(null), 4000)
            }
          }
        } catch (error) {
          // If MCP fails, create a simple direct route from coordinates
          const path = itemsWithCoords.flatMap(item => {
            const [lat, lng] = item.coordinates!
            return [[lat, lng]]
          })
          
          if (path.length >= 2) {
            setMapRoute({
              path: path,
              waypoints: waypoints,
              route_type: "driving"
            })
            
            setRouteNotification(`Route updated with ${itemsWithCoords.length} stops`)
            setTimeout(() => setRouteNotification(null), 4000)
          }
        }
      }
      
      calculateItineraryRoute()
    } else if (itemsWithCoords.length === 1) {
      // Single item - just fly to it, no route
      setFlyToTarget({
        coordinates: itemsWithCoords[0].coordinates as [number, number],
        name: itemsWithCoords[0].name,
        zoom: 15
      })
    } else if (itinerary.length === 0) {
      // Clear route when itinerary is empty
      setMapRoute(null)
    }
  }, [itinerary])

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Connecting to meeting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-900">
      {/* Wallet Connect Overlay - shows on first load if not connected, or when checkout is attempted */}
      <WalletConnectOverlay 
        isOpen={showWalletOverlay && !walletConnected} 
        onClose={() => setShowWalletOverlay(false)} 
      />

      {/* Payment Status Toast */}
      {paymentStatus.type && (
        <div className="fixed top-4 right-20 z-50 animate-in slide-in-from-right-5 duration-300">
          <div className={`
            p-4 rounded-lg border shadow-xl backdrop-blur-sm max-w-sm
            ${paymentStatus.type === "success" ? "bg-green-900/90 border-green-500/50" : ""}
            ${paymentStatus.type === "error" ? "bg-red-900/90 border-red-500/50" : ""}
            ${paymentStatus.type === "pending" ? "bg-blue-900/90 border-blue-500/50" : ""}
          `}>
            <div className="flex items-start gap-3">
              {paymentStatus.type === "pending" && (
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              )}
              {paymentStatus.type === "success" && (
                <span className="text-green-400">✓</span>
              )}
              {paymentStatus.type === "error" && (
                <span className="text-red-400">✕</span>
              )}
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{paymentStatus.message}</p>
                {paymentStatus.signature && (
                  <a
                    href={`https://explorer.solana.com/tx/${paymentStatus.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline mt-1 block"
                  >
                    View on Solana Explorer →
                  </a>
                )}
              </div>
              <button
                onClick={() => setPaymentStatus({ type: null, message: "" })}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room & Wallet Status - Top right corner (offset to avoid Mapbox zoom controls) */}
      <div className="fixed top-4 right-20 z-40 flex flex-col gap-2 items-end">
        {/* Room Name with Share Link */}
        {roomName && (
          <button
            onClick={() => {
              const shareUrl = `${window.location.origin}/meeting?room=${roomName}`
              navigator.clipboard.writeText(shareUrl)
              alert(`Link copied! Share with teammates:\n${shareUrl}`)
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-900/80 border border-purple-500/50 text-purple-300 hover:bg-purple-800/80 transition-all"
            title="Click to copy room link"
          >
            <span>🔗 Room: {roomName}</span>
          </button>
        )}
        
        {/* Wallet Status */}
        <button
          onClick={() => setShowWalletOverlay(true)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
            ${walletConnected 
              ? "bg-green-900/80 border border-green-500/50 text-green-400"
              : "bg-gray-800/80 border border-gray-600/50 text-gray-400 hover:border-purple-500/50 hover:text-purple-400"
            }
          `}
        >
          <span className={`w-2 h-2 rounded-full ${walletConnected ? "bg-green-400" : "bg-gray-500"}`} />
          {walletConnected ? (
            <span>💳 Wallet Connected</span>
          ) : (
            <span>Connect Wallet</span>
          )}
        </button>
      </div>

      {/* Left Side: Video Conference */}
      <div className="w-1/2 border-r border-gray-700 overflow-hidden relative">
        {room && <VideoConference room={room} />}
        
        {/* Agent Thinking State Overlay - Above control buttons (bottom-20 leaves room for controls) */}
        {agentState === "thinking" && agentThinkingMessage && (
          <div className="absolute bottom-20 left-4 right-4 z-30 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
            <div className="bg-gray-900/90 backdrop-blur-sm border border-blue-500/50 rounded-lg p-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-blue-400 flex items-center gap-1.5">
                      <img src="/deepgram-logo.png" alt="" className="w-4 h-4 rounded-full" />
                      Nomad is thinking...
                    </span>
                    {currentTool && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                        {currentTool.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 truncate">{agentThinkingMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Agent Speaking Indicator - Above control buttons */}
        {agentState === "speaking" && (
          <div className="absolute bottom-20 left-4 z-30 animate-in fade-in duration-300 pointer-events-none">
            <div className="bg-green-900/90 backdrop-blur-sm border border-green-500/50 rounded-full px-3 py-1.5 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
                  <img src="/deepgram-logo.png" alt="" className="w-4 h-4 rounded-full" />
                  Nomad is speaking...
                </span>
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
          flyToTarget={flyToTarget}
        />
        
        {/* Tool Notification Snackbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
          {toolNotifications.map((notification, index) => (
            <div
              key={notification.id}
              className="animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto"
              style={{ 
                animationDelay: `${index * 50}ms`,
                opacity: 1 - (index * 0.15)
              }}
            >
              <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/50 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3 min-w-[200px]">
                <span className="text-lg">{notification.icon}</span>
                <span className="text-sm font-medium text-gray-200">{notification.message}</span>
                <div className="ml-auto">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Route Update Notification Snackbar */}
        {routeNotification && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-gradient-to-r from-blue-600/95 to-indigo-600/95 backdrop-blur-md border border-blue-400/30 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-blue-200 uppercase tracking-wide">Route Updated</span>
                <span className="text-sm font-semibold text-white">{routeNotification}</span>
              </div>
              <div className="ml-2 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        )}
        
        {/* Itinerary Panel */}
        <ItineraryPanel
          items={itinerary}
          onRemoveItem={handleRemoveFromItinerary}
          onClearAll={handleClearItinerary}
          onReorder={handleReorderItinerary}
          onCheckout={handleCheckout}
          isProcessingPayment={isProcessingPayment}
        />
      </div>
    </div>
  )
}
