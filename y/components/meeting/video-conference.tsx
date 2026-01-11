"use client"

import { useEffect, useRef, useState } from "react"
import { Room, Participant, Track, RemoteVideoTrack, LocalVideoTrack, ParticipantKind, RemoteAudioTrack } from "livekit-client"

interface VideoConferenceProps {
  room: Room
}

export function VideoConference({ room }: VideoConferenceProps) {
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

  // Simple audio renderer
  const AudioRenderer = ({ track }: { track: RemoteAudioTrack }) => {
    const audioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
      if (audioRef.current && track) {
        track.attach(audioRef.current)
        return () => { track.detach() }
      }
    }, [track])

    return <audio ref={audioRef} autoPlay playsInline />
  }

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

    const audioTrack = Array.from(participant.audioTrackPublications.values())
      .find((pub) => pub.track)?.track as RemoteAudioTrack | null

    const rawName = participant.name || participant.identity || "Unknown"
    const isAgent = 
      participant.kind === ParticipantKind.AGENT ||
      participant.identity?.toLowerCase().includes("agent") || 
      rawName?.toLowerCase().includes("nomad")
    
    const participantName = isAgent ? "Nomad" : rawName

    return (
      <div
        key={participant.identity}
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
              {audioTrack && <p className="text-xs text-green-400 mt-1">🔊 Audio</p>}
            </div>
          </div>
        )}
        
        {isAgent && (
          <div className="absolute top-2 left-2 bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5">
            <img src="/deepgram-logo.png" alt="" className="w-4 h-4 rounded-full" />
            Nomad
          </div>
        )}

        {audioTrack && !audioTrack.isMuted && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">Live</span>
          </div>
        )}
        
        {/* Render audio for remote participants */}
        {!isLocal && audioTrack && <AudioRenderer track={audioTrack} />}
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
