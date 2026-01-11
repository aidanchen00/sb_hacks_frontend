"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, DataPacket_Kind } from "livekit-client"
import { useWallet } from "@solana/wallet-adapter-react"
import { useConnection } from "@solana/wallet-adapter-react"
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { VideoConference } from "@/components/meeting/video-conference"
import { MapboxMap } from "@/components/meeting/mapbox-map"
import { WalletConnectOverlay } from "@/components/meeting/wallet-connect-overlay"
import { PaymentStatus } from "@/components/meeting/payment-status"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type PaymentStatusType = "idle" | "pending_confirmation" | "awaiting_signature" | "sending" | "confirming" | "success" | "error"

interface PaymentState {
  status: PaymentStatusType
  message: string
  amountUsd?: number
  amountSol?: number
  itemDescription?: string
  signature?: string
  error?: string
}

interface PendingTransaction {
  amount_usd: number
  amount_sol?: number
  vendor_key?: string
  item_description?: string
}

export default function MeetingPage() {
  const { publicKey, sendTransaction, connected } = useWallet()
  const { connection } = useConnection()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [mapRoute, setMapRoute] = useState<any>(null)
  const [mapMarkers, setMapMarkers] = useState<any[]>([])
  
  const [paymentState, setPaymentState] = useState<PaymentState>({
    status: "idle",
    message: "",
  })
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | null>(null)

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

  const executePayment = useCallback(async () => {
    if (!publicKey || !connected) {
      setPaymentState({
        status: "error",
        message: "Wallet not connected",
        error: "Please connect your wallet first",
      })
      return
    }

    if (!pendingTransaction) {
      setPaymentState({
        status: "error",
        message: "No pending transaction",
        error: "No payment request found",
      })
      return
    }

    try {
      // Step 1: Fetch vendor public key
      setPaymentState({
        status: "awaiting_signature",
        message: "Fetching vendor wallet address...",
        amountUsd: pendingTransaction.amount_usd,
        itemDescription: pendingTransaction.item_description,
      })

      const vendorResponse = await fetch(`${API_BASE_URL}/api/solana/vendor`)
      if (!vendorResponse.ok) {
        throw new Error("Failed to fetch vendor wallet")
      }
      const { vendorPublicKey } = await vendorResponse.json()
      const vendorPubkey = new PublicKey(vendorPublicKey)

      // Step 2: Build transaction (always 0.1 SOL for devnet testing)
      setPaymentState((prev) => ({
        ...prev,
        message: "Building transaction...",
      }))

      const lamports = 0.1 * LAMPORTS_PER_SOL // Always 0.1 SOL for devnet

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: vendorPubkey,
          lamports,
        })
      )

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed")
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Step 3: Request signature from wallet
      setPaymentState((prev) => ({
        ...prev,
        message: "Please approve the transaction in your wallet...",
      }))

      // Step 4: Send transaction
      const signature = await sendTransaction(transaction, connection)

      setPaymentState((prev) => ({
        ...prev,
        status: "sending",
        message: "Sending transaction...",
        signature,
      }))

      // Step 5: Confirm transaction
      setPaymentState((prev) => ({
        ...prev,
        status: "confirming",
        message: "Confirming transaction...",
      }))

      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      })

      if (confirmation.value.err) {
        throw new Error("Transaction failed to confirm")
      }

      // Success!
      setPaymentState({
        status: "success",
        message: "Payment successful!",
        amountUsd: pendingTransaction.amount_usd,
        itemDescription: pendingTransaction.item_description,
        signature,
      })
      
      // Clear pending transaction
      setPendingTransaction(null)
    } catch (error) {
      console.error("Payment error:", error)
      setPaymentState({
        status: "error",
        message: "Payment failed",
        amountUsd: pendingTransaction.amount_usd,
        itemDescription: pendingTransaction.item_description,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }, [publicKey, connected, sendTransaction, connection, pendingTransaction])

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
    } else if (data.type === "PAYMENT_TRANSACTION") {
      // Handle payment request from agent
      const transaction = data.transaction
      setPendingTransaction(transaction)
      setPaymentState({
        status: "pending_confirmation",
        message: "Awaiting your voice confirmation...",
        amountUsd: transaction.amount_usd,
        itemDescription: transaction.item_description,
      })
    } else if (data.type === "PAYMENT_EXECUTE") {
      // Execute payment after voice confirmation
      executePayment()
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
    <>
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

      {/* Wallet Connect Overlay */}
      <WalletConnectOverlay />

      {/* Payment Status */}
      <PaymentStatus
        status={paymentState.status}
        message={paymentState.message}
        amountUsd={paymentState.amountUsd}
        itemDescription={paymentState.itemDescription}
        signature={paymentState.signature}
        error={paymentState.error}
      />
    </>
  )
}

