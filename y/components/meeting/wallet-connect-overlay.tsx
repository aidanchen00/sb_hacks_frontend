"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import dynamic from "next/dynamic"

// Dynamically import WalletMultiButton with SSR disabled to prevent hydration mismatch
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
)

export function WalletConnectOverlay() {
  const { connected } = useWallet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't show overlay if wallet is connected or not mounted yet
  if (!mounted || connected) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-xl p-8 max-w-md mx-4">
        <div className="text-center space-y-6">
          {/* DEVNET Badge */}
          <div className="inline-block px-4 py-2 bg-yellow-500/20 border-2 border-yellow-500 rounded-lg">
            <span className="text-yellow-500 font-bold text-lg">DEVNET DEMO</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your Phantom wallet to enable payments during the meeting
            </p>
          </div>

          <div className="flex justify-center">
            <WalletMultiButton />
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-left">
              <li>Click the button above to connect</li>
              <li>Select Phantom wallet</li>
              <li>Switch to Devnet in wallet settings</li>
              <li>Approve the connection</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

