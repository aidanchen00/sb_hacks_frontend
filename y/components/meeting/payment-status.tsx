"use client"

interface PaymentStatusProps {
  status: "idle" | "pending_confirmation" | "awaiting_signature" | "sending" | "confirming" | "success" | "error"
  message: string
  amountUsd?: number
  itemDescription?: string
  signature?: string
  error?: string
}

export function PaymentStatus({
  status,
  message,
  amountUsd,
  itemDescription,
  signature,
  error,
}: PaymentStatusProps) {
  // Don't render if idle
  if (status === "idle") {
    return null
  }

  const getStatusColor = () => {
    switch (status) {
      case "pending_confirmation":
        return "border-yellow-500/50 bg-yellow-500/10"
      case "awaiting_signature":
      case "sending":
      case "confirming":
        return "border-blue-500/50 bg-blue-500/10"
      case "success":
        return "border-green-500/50 bg-green-500/10"
      case "error":
        return "border-red-500/50 bg-red-500/10"
      default:
        return "border-border bg-card"
    }
  }

  const getTextColor = () => {
    switch (status) {
      case "pending_confirmation":
        return "text-yellow-400"
      case "awaiting_signature":
      case "sending":
      case "confirming":
        return "text-blue-400"
      case "success":
        return "text-green-400"
      case "error":
        return "text-red-400"
      default:
        return "text-foreground"
    }
  }

  const getIcon = () => {
    switch (status) {
      case "pending_confirmation":
        return "⏳"
      case "awaiting_signature":
        return "👛"
      case "sending":
      case "confirming":
        return "⌛"
      case "success":
        return "✅"
      case "error":
        return "❌"
      default:
        return "💰"
    }
  }

  return (
    <div className={`fixed bottom-4 right-4 z-40 max-w-sm w-full mx-4 rounded-lg border ${getStatusColor()} p-4 shadow-xl`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getIcon()}</span>
          <h3 className="font-semibold text-lg">Payment</h3>
        </div>

        {/* Amount and Description */}
        {(amountUsd !== undefined || itemDescription) && (
          <div className="text-sm space-y-1">
            {amountUsd !== undefined && (
              <p className="text-muted-foreground">
                Amount: <span className="text-foreground font-medium">${amountUsd.toFixed(2)}</span>
              </p>
            )}
            {itemDescription && (
              <p className="text-muted-foreground">
                For: <span className="text-foreground">{itemDescription}</span>
              </p>
            )}
          </div>
        )}

        {/* Status Message */}
        <div className="space-y-2">
          <p className={`font-medium ${getTextColor()}`}>
            {message}
          </p>

          {/* Spinner for processing states */}
          {(status === "sending" || status === "confirming") && (
            <div className="flex items-center gap-2">
              <span className="animate-spin">⌛</span>
              <span className="text-sm text-muted-foreground">Processing...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 mt-2">
              Error: {error}
            </p>
          )}

          {/* Success with transaction link */}
          {signature && status === "success" && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">
                Transaction:
              </p>
              <a
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-blue-400 hover:underline break-all block"
              >
                {signature.slice(0, 8)}...{signature.slice(-8)}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

