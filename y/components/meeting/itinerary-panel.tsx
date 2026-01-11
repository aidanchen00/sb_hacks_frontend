"use client"

import { useState, useCallback } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useWallet } from "@solana/wallet-adapter-react"

export interface ItineraryItem {
  id: string
  name: string
  type: "restaurant" | "hotel" | "activity"
  estimatedCost: number
  costLabel: string
  location?: string
  coordinates?: [number, number]
}

// SOL price for display (actual transaction is always 0.5 SOL on devnet)
const SOL_USD_RATE = 150 // 1 SOL ≈ $150 for display purposes

interface ItineraryPanelProps {
  items: ItineraryItem[]
  onRemoveItem: (itemId: string) => void
  onClearAll: () => void
  onReorder: (items: ItineraryItem[]) => void
  onCheckout?: () => void
  isProcessingPayment?: boolean
}

// Sortable item component
function SortableItem({ item, onRemove }: { item: ItineraryItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const iconMap = {
    restaurant: "🍽️",
    hotel: "🏨",
    activity: "🎯",
  }

  const colorMap = {
    restaurant: "from-red-500/20 to-red-600/10 border-red-500/30",
    hotel: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    activity: "from-green-500/20 to-green-600/10 border-green-500/30",
  }

  // Convert USD to SOL for display
  const solAmount = (item.estimatedCost / SOL_USD_RATE).toFixed(3)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r ${colorMap[item.type]} border backdrop-blur-sm group transition-all duration-200 hover:scale-[1.02]`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      {/* Icon */}
      <span className="text-xl">{iconMap[item.type]}</span>

      {/* Name and cost label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{item.name}</p>
        <p className="text-xs text-gray-400">{item.costLabel}</p>
      </div>

      {/* Cost - USD and SOL */}
      <div className="text-right">
        <p className="text-sm font-semibold text-purple-300">${item.estimatedCost}</p>
        <p className="text-xs text-gray-500">{solAmount} SOL</p>
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
        title="Remove from itinerary"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ItineraryPanel({ items, onRemoveItem, onClearAll, onReorder, onCheckout, isProcessingPayment }: ItineraryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { connected, connecting } = useWallet()
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      const newItems = arrayMove(items, oldIndex, newIndex)
      onReorder(newItems)
    }
  }, [items, onReorder])

  const totalCostUSD = items.reduce((sum, item) => sum + item.estimatedCost, 0)
  const totalCostSOL = (totalCostUSD / SOL_USD_RATE).toFixed(3)
  
  // Actual payment amount (always 0.5 SOL on devnet for demo)
  const paymentAmountSOL = 0.5

  // Count by type
  const counts = items.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  if (items.length === 0) {
    return null // Don't show panel if no items
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-40">
      <div className="bg-gray-900/95 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div>
              <h3 className="text-sm font-semibold text-white">Your Itinerary</h3>
              <p className="text-xs text-gray-400">
                {items.length} item{items.length !== 1 ? "s" : ""}
                {counts.restaurant ? ` • ${counts.restaurant} 🍽️` : ""}
                {counts.hotel ? ` • ${counts.hotel} 🏨` : ""}
                {counts.activity ? ` • ${counts.activity} 🎯` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Total cost */}
            <div className="text-right">
              <p className="text-xs text-gray-400">Total (Estimated)</p>
              <p className="text-lg font-bold text-purple-400">${totalCostUSD.toLocaleString()}</p>
              <p className="text-xs text-gray-500">≈ {totalCostSOL} SOL</p>
            </div>

            {/* Expand/collapse */}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-purple-500/20">
            {/* Items list */}
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {items.map((item) => (
                    <SortableItem key={item.id} item={item} onRemove={() => onRemoveItem(item.id)} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Payment summary */}
            <div className="mx-3 mb-3 p-3 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Expected Cost</span>
                <span className="text-sm font-semibold text-white">${totalCostUSD.toLocaleString()} ≈ {totalCostSOL} SOL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Demo Payment (Devnet)</span>
                <span className="text-sm font-bold text-green-400">{paymentAmountSOL} SOL</span>
              </div>
            </div>

            {/* Footer with clear and checkout buttons */}
            <div className="flex items-center justify-between p-3 border-t border-purple-500/20 bg-black/20">
              <button
                onClick={onClearAll}
                className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
              >
                Clear All
              </button>
              
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">Drag to reorder</p>
                
                {/* Checkout button */}
                <button
                  onClick={onCheckout}
                  disabled={!connected || isProcessingPayment}
                  className={`
                    px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200
                    ${connected && !isProcessingPayment
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    }
                  `}
                >
                  {isProcessingPayment ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : !connected ? (
                    "Connect Wallet to Checkout"
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Checkout</span>
                      <span className="text-xs opacity-75">({paymentAmountSOL} SOL)</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
