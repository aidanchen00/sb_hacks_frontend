"use client"

import { useEffect, useRef, useState } from "react"
import { Room, Participant, RemoteVideoTrack, LocalVideoTrack, ParticipantKind } from "livekit-client"

// Transcript message interface
interface TranscriptMessage {
  id: string
  role: "assistant" | "user"
  text: string
  timestamp: number
}

interface VideoConferenceProps {
  room: Room
  transcript?: TranscriptMessage[]
  onClearTranscript?: () => void
}

export function VideoConference({ room, transcript = [], onClearTranscript }: VideoConferenceProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null)

  useEffect(() => {
    const updateParticipants = () => {
      setParticipants(Array.from(room.remoteParticipants.values()))
      setLocalParticipant(room.localParticipant)
    }

    updateParticipants()

    room.on("participantConnected", updateParticipants)
    room.on("participantDisconnected", updateParticipants)
    room.on("trackSubscribed", updateParticipants)
    room.on("trackUnsubscribed", updateParticipants)

    const intervalId = setInterval(updateParticipants, 3000)

    return () => {
      clearInterval(intervalId)
      room.off("participantConnected", updateParticipants)
      room.off("participantDisconnected", updateParticipants)
      room.off("trackSubscribed", updateParticipants)
      room.off("trackUnsubscribed", updateParticipants)
    }
  }, [room])

  // NOTE: Audio is handled DIRECTLY in meeting/page.tsx via TrackSubscribed events
  // This component only handles VIDEO rendering - no AudioRenderer needed here

  // Simple video renderer
  const VideoRenderer = ({ track, isLocal }: { track: RemoteVideoTrack | LocalVideoTrack, isLocal?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
      if (videoRef.current && track) {
        track.attach(videoRef.current)
        return () => { track.detach() }
      }
    }, [track])

    return (
      <video 
        ref={videoRef} 
        className="w-full h-full object-cover" 
        autoPlay 
        playsInline 
        muted={isLocal}
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
    )
  }

  const renderParticipant = (participant: Participant, isLocal: boolean = false) => {
    const videoTrack = Array.from(participant.videoTrackPublications.values())
      .find((pub) => pub.track)?.track as RemoteVideoTrack | LocalVideoTrack | null

    // Check if participant has audio (for UI indicator only - actual audio handled in page.tsx)
    const hasAudio = Array.from(participant.audioTrackPublications.values())
      .some((pub) => pub.track && !pub.isMuted)

    const rawName = participant.name || participant.identity || "Unknown"
    const isAgent = 
      participant.kind === ParticipantKind.AGENT ||
      participant.identity?.toLowerCase().includes("agent") || 
      rawName?.toLowerCase().includes("nomad")
    
    const participantName = isAgent ? "Nomad" : rawName

    return (
      <div key={participant.identity} className="flex flex-col gap-2">
        <div
          className={`relative bg-gray-900 rounded-lg overflow-hidden aspect-video ${
            isLocal ? "ring-2 ring-primary" : ""
          } ${isAgent ? "ring-2 ring-blue-500" : ""}`}
        >
          {videoTrack ? (
            <VideoRenderer track={videoTrack} isLocal={isLocal} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2 overflow-hidden">
                  {isAgent ? (
                    <img src="/deepgram-logo.png" alt="Nomad" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{participantName?.charAt(0).toUpperCase() || "?"}</span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{participantName}</p>
                {hasAudio && <p className="text-xs text-green-400 mt-1">🔊 Audio</p>}
              </div>
            </div>
          )}
          
          {isAgent && (
            <div className="absolute top-2 left-2 bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5">
              <img src="/deepgram-logo.png" alt="" className="w-4 h-4 rounded-full" />
              Nomad
            </div>
          )}

          {hasAudio && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400">Live</span>
            </div>
          )}
          
          {/* AUDIO IS NOW HANDLED DIRECTLY IN page.tsx - NOT HERE */}
        </div>
        
        {/* Transcript Panel - Only shown under Nomad's box */}
        {isAgent && transcript.length > 0 && (
          <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/50 rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700/50 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Nomad Says</span>
              </div>
              {onClearTranscript && (
                <button
                  onClick={onClearTranscript}
                  className="text-gray-500 hover:text-gray-300 text-xs px-1"
                  title="Clear transcript"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Messages */}
            <div className="max-h-24 overflow-y-auto p-2 space-y-1">
              {transcript.slice(-3).map((msg) => (
                <p key={msg.id} className="text-xs text-gray-300 leading-relaxed">
                  {msg.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const agentParticipant = participants.find(p => 
    p.kind === ParticipantKind.AGENT ||
    p.identity?.toLowerCase().includes("agent") || 
    p.name?.toLowerCase().includes("nomad")
  )

  const allParticipants = [
    ...(localParticipant ? [localParticipant] : []),
    ...participants
  ]
  const gridCols = allParticipants.length <= 1 ? 1 : allParticipants.length <= 4 ? 2 : 3

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold">Meeting Room</h2>
        <p className="text-sm text-gray-400">{allParticipants.length} participants</p>
        {agentParticipant && (
          <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
            <img src="/deepgram-logo.png" alt="" className="w-3 h-3 rounded-full" />
            Nomad connected
          </p>
        )}
      </div>

      <div className={`flex-1 p-4 grid gap-4 ${gridCols === 1 ? 'grid-cols-1' : gridCols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {allParticipants.map((p) => renderParticipant(p, p === localParticipant))}
      </div>

      <div className="p-4 border-t border-border flex items-center justify-center gap-4">
        <button
          onClick={() => room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"
        >
          {room.localParticipant.isMicrophoneEnabled ? "🔊 Mic On" : "🔇 Mic Off"}
        </button>
        <button
          onClick={() => room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"
        >
          {room.localParticipant.isCameraEnabled ? "📹 Camera On" : "📷 Camera Off"}
        </button>
        <button
          onClick={() => room.disconnect()}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
