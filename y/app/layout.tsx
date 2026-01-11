import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { SolanaWalletProvider } from "@/components/providers/solana-wallet-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "NomadSync — Plan trips. Together. In real time.",
  description: "Turn live conversations into a shared itinerary—maps, places, and bookings update as you talk.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#1a1d2e",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
        <Analytics />
      </body>
    </html>
  )
}
