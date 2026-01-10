"use client"

import { useEffect, useRef, useState } from "react"
import { Room, Participant, Track, TrackPublication, RemoteVideoTrack, LocalVideoTrack, ParticipantKind } from "livekit-client"

interface VideoConferenceProps {
  room: Room
}

export function VideoConference({ room }: VideoConferenceProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null)

  useEffect(() => {
    const updateParticipants = () => {
      const remote = Array.from(room.remoteParticipants.values())
      setParticipants(remote)
      setLocalParticipant(room.localParticipant)
      
      // Log participants for debugging
      console.log("Participants updated:", {
        local: room.localParticipant.identity,
        remote: remote.map(p => ({ 
          identity: p.identity, 
          name: p.name, 
          kind: p.kind,
          hasVideo: !!Array.from(p.videoTrackPublications.values()).find(pub => pub.track),
          hasAudio: !!Array.from(p.audioTrackPublications.values()).find(pub => pub.track)
        }))
      })
    }

    // Initial update
    updateParticipants()

    // Listen to all participant events - use named functions for proper cleanup
    const handleParticipantConnected = (participant: Participant) => {
      console.log("Participant connected:", participant.identity, participant.name, participant.kind)
      updateParticipants()
    }
    
    const handleParticipantDisconnected = (participant: Participant) => {
      console.log("Participant disconnected:", participant.identity)
      updateParticipants()
    }
    
    const handleTrackSubscribed = (track: Track, publication: TrackPublication, participant: Participant) => {
      console.log("Track subscribed:", track.kind, "from", participant.identity, participant.name)
      updateParticipants()
    }
    
    const handleTrackUnsubscribed = (track: Track, publication: TrackPublication, participant: Participant) => {
      console.log("Track unsubscribed:", track.kind, "from", participant.identity)
      updateParticipants()
    }

    room.on("participantConnected", handleParticipantConnected)
    room.on("participantDisconnected", handleParticipantDisconnected)
    room.on("trackSubscribed", handleTrackSubscribed)
    room.on("trackUnsubscribed", handleTrackUnsubscribed)
    
    // Also listen for local track events
    const handleLocalTrackPublished = () => {
      console.log("Local track published")
      updateParticipants()
    }
    room.localParticipant.on("trackPublished", handleLocalTrackPublished)

    // Periodic check for participants (in case events are missed)
    const intervalId = setInterval(() => {
      updateParticipants()
    }, 2000)

    return () => {
      clearInterval(intervalId)
      room.off("participantConnected", handleParticipantConnected)
      room.off("participantDisconnected", handleParticipantDisconnected)
      room.off("trackSubscribed", handleTrackSubscribed)
      room.off("trackUnsubscribed", handleTrackUnsubscribed)
      room.localParticipant.off("trackPublished", handleLocalTrackPublished)
    }
  }, [room])

  const VideoRenderer = ({ track, participant, name }: { track: RemoteVideoTrack | LocalVideoTrack | null, participant: Participant, name: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
      if (videoRef.current && track) {
        track.attach(videoRef.current)
        return () => {
          track.detach()
        }
      }
    }, [track])

    if (!track) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">
                {name?.charAt(0).toUpperCase() || "?"}
              </span>
            </div>
            <p className="text-sm text-gray-400">{name}</p>
          </div>
        </div>
      )
    }

    return <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
  }

  const renderParticipant = (participant: Participant, isLocal: boolean = false) => {
    const videoPublication = Array.from(participant.videoTrackPublications.values())
      .find((pub) => pub.track)

    const videoTrack = videoPublication?.track as RemoteVideoTrack | LocalVideoTrack | null

    const audioPublication = Array.from(participant.audioTrackPublications.values())
      .find((pub) => pub.track)
    
    const audioTrack = audioPublication?.track

    // Get participant name from metadata, name, or identity
    const participantName = 
      participant.name || 
      participant.identity || 
      "Unknown"
    
    // Check if this is the agent (audio-only participant, usually named "agent" or contains "agent")
    const isAgent = 
      participant.identity?.toLowerCase().includes("agent") || 
      participantName?.toLowerCase().includes("agent") ||
      participantName?.toLowerCase().includes("nomadsync") ||
      participant.kind === ParticipantKind.AGENT

    // Show participant even if no video (agent is audio-only)
    const hasVideo = !!videoTrack
    const hasAudio = !!audioTrack

    return (
      <div
        key={participant.identity}
        className={`relative bg-gray-900 rounded-lg overflow-hidden aspect-video ${
          isLocal ? "ring-2 ring-primary" : ""
        } ${isAgent ? "ring-2 ring-blue-500" : ""}`}
      >
        {hasVideo ? (
          <VideoRenderer track={videoTrack} participant={participant} name={participantName} />
        ) : (
          // Show placeholder for audio-only participants (like agent)
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                {isAgent ? (
                  <span className="text-3xl">🤖</span>
                ) : (
                  <span className="text-2xl">
                    {participantName?.charAt(0).toUpperCase() || "?"}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{participantName}</p>
              {hasAudio && (
                <p className="text-xs text-green-400 mt-1">🔊 Audio</p>
              )}
            </div>
          </div>
        )}
        
        {/* Agent indicator */}
        {isAgent && (
          <div className="absolute top-2 left-2 bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-semibold">
            🤖 NomadSync Agent
          </div>
        )}

        {/* Audio indicator */}
        {hasAudio && !audioTrack?.isMuted && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">Live</span>
          </div>
        )}
      </div>
    )
  }

  // Grid layout for participants
  const gridCols = participants.length <= 1 ? 1 : participants.length <= 4 ? 2 : 3
  const totalParticipants = participants.length + (localParticipant ? 1 : 0)

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold">Meeting Room</h2>
        <p className="text-sm text-gray-400">{totalParticipants} participants</p>
      </div>

      <div
        className={`flex-1 p-4 grid gap-4 ${
          gridCols === 1
            ? "grid-cols-1"
            : gridCols === 2
            ? "grid-cols-2"
            : "grid-cols-3"
        }`}
      >
        {localParticipant && renderParticipant(localParticipant, true)}
        {participants.map((p) => renderParticipant(p, false))}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-border flex items-center justify-center gap-4">
        <button
          onClick={() => {
            room.localParticipant.setMicrophoneEnabled(
              !room.localParticipant.isMicrophoneEnabled
            )
          }}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"
        >
          {room.localParticipant.isMicrophoneEnabled ? "🔊 Mic On" : "🔇 Mic Off"}
        </button>
        <button
          onClick={() => {
            room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)
          }}
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

