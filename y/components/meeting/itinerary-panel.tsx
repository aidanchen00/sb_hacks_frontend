"use client"

import { useState, useCallback } from "react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export interface ItineraryItem {
  id: string
  name: string
  type: "restaurant" | "hotel" | "activity"
  estimatedCost: number
  costLabel: string
  location?: string
  coordinates?: [number, number]
}

interface ItineraryPanelProps {
  items: ItineraryItem[]
  onRemoveItem: (itemId: string) => void
  onClearAll: () => void
  onReorder: (items: ItineraryItem[]) => void
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

      {/* Cost */}
      <div className="text-right">
        <p className="text-sm font-semibold text-purple-300">${item.estimatedCost}</p>
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

export function ItineraryPanel({ items, onRemoveItem, onClearAll, onReorder }: ItineraryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
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

  const totalCost = items.reduce((sum, item) => sum + item.estimatedCost, 0)

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
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-lg font-bold text-purple-400">${totalCost.toLocaleString()}</p>
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

            {/* Footer with clear button */}
            <div className="flex items-center justify-between p-3 border-t border-purple-500/20 bg-black/20">
              <button
                onClick={onClearAll}
                className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
              >
                Clear All
              </button>
              <p className="text-xs text-gray-500">Drag items to reorder</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

