"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, DataPacket_Kind } from "livekit-client"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { VideoConference } from "@/components/meeting/video-conference"
import { MapboxMap } from "@/components/meeting/mapbox-map"
import { ItineraryPanel, ItineraryItem } from "@/components/meeting/itinerary-panel"
import { WalletConnectOverlay } from "@/components/meeting/wallet-connect-overlay"

// Payment amount in SOL (devnet demo)
const PAYMENT_AMOUNT_SOL = 0.5

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
  
  // Wallet and payment states
  const { publicKey, sendTransaction, connected: walletConnected } = useWallet()
  const { connection } = useConnection()
  const [showWalletOverlay, setShowWalletOverlay] = useState(true)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
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
              } else if (data.type === "PAYMENT_EXECUTE") {
                // Agent confirmed payment - trigger wallet transaction
                console.log("💳 [PAYMENT] Agent triggered payment execution")
                handleCheckout()
              } else {
                handleMapUpdate(data)
              }
            } catch (e) {
              console.error("❌ [DATA ERROR] Error parsing data channel message:", e)
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

  // Checkout/Payment handler
  const handleCheckout = useCallback(async () => {
    if (!walletConnected || !publicKey || !sendTransaction) {
      setPaymentStatus({ type: "error", message: "Please connect your wallet first" })
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
      setPaymentStatus({
        type: "error",
        message: error.message || "Payment failed. Please try again.",
      })
    } finally {
      setIsProcessingPayment(false)
    }
  }, [walletConnected, publicKey, sendTransaction, connection])

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
      {/* Wallet Connect Overlay - shows on first load if not connected */}
      {showWalletOverlay && !walletConnected && (
        <WalletConnectOverlay onClose={() => setShowWalletOverlay(false)} />
      )}

      {/* Payment Status Toast */}
      {paymentStatus.type && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-5 duration-300">
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

      {/* Wallet Status Indicator */}
      <div className="fixed top-4 left-4 z-40">
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
            <span>{publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}</span>
          ) : (
            <span>Connect Wallet</span>
          )}
        </button>
      </div>

      {/* Left Side: Video Conference */}
      <div className="w-1/2 border-r border-gray-700 overflow-hidden relative">
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
          onCheckout={handleCheckout}
          isProcessingPayment={isProcessingPayment}
        />
      </div>
    </div>
  )
}
