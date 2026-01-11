"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { motion, AnimatePresence } from "framer-motion"
import { Wallet, X } from "lucide-react"
import { useEffect } from "react"

interface WalletConnectOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function WalletConnectOverlay({ isOpen, onClose }: WalletConnectOverlayProps) {
  const { connected } = useWallet()

  // Auto-close overlay when wallet is connected
  useEffect(() => {
    if (connected && isOpen) {
      // Small delay to show "Connected!" state
      const timer = setTimeout(() => {
        onClose()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [connected, isOpen, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-md mx-4"
        >
          {/* Glowing border effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-2xl blur-lg opacity-75 animate-pulse" />
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-gray-900 via-purple-900/50 to-gray-900 rounded-2xl border border-purple-500/30 p-8">
            {/* Dismiss button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
                <Wallet className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-white mb-2">
              {connected ? "✓ Wallet Connected!" : "Connect Your Wallet"}
            </h2>

            {/* Description */}
            <p className="text-gray-400 text-center mb-8 text-sm">
              {connected 
                ? "Ready to book and pay for your trip!" 
                : "Connect your Solana wallet to enable seamless payments for bookings during your trip planning."}
            </p>

            {/* Wallet Button */}
            <div className="flex justify-center">
              <WalletMultiButton 
                style={{
                  background: connected 
                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                    : 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  border: 'none',
                  boxShadow: connected 
                    ? '0 0 20px rgba(34, 197, 94, 0.4)'
                    : '0 0 20px rgba(147, 51, 234, 0.4)',
                }}
              />
            </div>

            {/* Skip option */}
            {!connected && (
              <button
                onClick={onClose}
                className="w-full mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Skip for now — you can connect later
              </button>
            )}

            {/* Features list */}
            {!connected && (
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <p className="text-xs text-gray-500 text-center mb-3">Why connect?</p>
                <div className="flex justify-center gap-6 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="text-green-400">✓</span> Fast checkout
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-green-400">✓</span> Secure payments
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-green-400">✓</span> Devnet SOL
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
