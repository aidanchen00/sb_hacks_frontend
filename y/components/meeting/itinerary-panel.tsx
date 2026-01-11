"use client"

import { useState, useCallback, useEffect } from "react"
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

interface ResearchResult {
  itemId: string
  itemName: string
  itemType: string
  research: {
    bestTimeToVisit: string
    estimatedDuration: string
    gettingThere: string
    tips: string[]
    nearbyAttractions: string[]
    reservationRequired: boolean
    accessibility: string
  }
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

// Research Modal Component
function ResearchModal({
  isOpen,
  onClose,
  items,
  progress,
  currentItem,
  researchResults,
  isComplete,
  onDownloadPDF
}: {
  isOpen: boolean
  onClose: () => void
  items: ItineraryItem[]
  progress: number
  currentItem: string
  researchResults: ResearchResult[]
  isComplete: boolean
  onDownloadPDF: () => void
}) {
  if (!isOpen) return null

  const iconMap = {
    restaurant: "🍽️",
    hotel: "🏨",
    activity: "🎯",
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={isComplete ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] bg-gradient-to-b from-gray-900 to-gray-950 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-purple-500/20 bg-purple-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center">
                {isComplete ? (
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-purple-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isComplete ? "Research Complete!" : "Compiling Research..."}
                </h2>
                <p className="text-sm text-gray-400">
                  {isComplete 
                    ? `${researchResults.length} items researched`
                    : `Researching logistics for your trip`
                  }
                </p>
              </div>
            </div>
            {isComplete && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Progress Section */}
        {!isComplete && (
          <div className="p-6 border-b border-purple-500/20">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">Progress</span>
              <span className="text-sm font-medium text-purple-400">{progress}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {currentItem && (
              <p className="mt-3 text-sm text-gray-300 animate-pulse">
                🔍 Researching: <span className="font-medium text-white">{currentItem}</span>
              </p>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="p-4 max-h-[40vh] overflow-y-auto">
          <div className="space-y-3">
            {items.map((item, idx) => {
              const result = researchResults.find(r => r.itemId === item.id)
              const isResearched = !!result
              const isCurrentlyResearching = currentItem === item.name && !isComplete

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                    isResearched
                      ? "bg-green-900/20 border-green-500/30"
                      : isCurrentlyResearching
                      ? "bg-purple-900/30 border-purple-500/50 animate-pulse"
                      : "bg-gray-800/50 border-gray-700/50 opacity-50"
                  }`}
                >
                  {/* Status Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isResearched
                      ? "bg-green-500/20"
                      : isCurrentlyResearching
                      ? "bg-purple-500/20"
                      : "bg-gray-700/50"
                  }`}>
                    {isResearched ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isCurrentlyResearching ? (
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-gray-500 text-xs">{idx + 1}</span>
                    )}
                  </div>

                  {/* Item Info */}
                  <span className="text-lg">{iconMap[item.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isResearched ? "text-green-300" : isCurrentlyResearching ? "text-purple-300" : "text-gray-400"
                    }`}>
                      {item.name}
                    </p>
                    {isResearched && result && (
                      <p className="text-xs text-gray-400 truncate">
                        {result.research.estimatedDuration} • {result.research.bestTimeToVisit}
                      </p>
                    )}
                  </div>

                  {/* Status Text */}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isResearched
                      ? "bg-green-500/20 text-green-300"
                      : isCurrentlyResearching
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-gray-700/50 text-gray-500"
                  }`}>
                    {isResearched ? "Done" : isCurrentlyResearching ? "Researching" : "Pending"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Actions */}
        {isComplete && (
          <div className="p-6 border-t border-purple-500/20 bg-black/30">
            <button
              onClick={onDownloadPDF}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-purple-500/40 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF Itinerary
            </button>
            <p className="text-center text-xs text-gray-500 mt-3">
              Your personalized travel guide with logistics and tips
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// PDF Generation Function
async function generatePDF(items: ItineraryItem[], researchResults: ResearchResult[]) {
  // Dynamically import jspdf
  const { jsPDF } = await import("jspdf")
  
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  const iconMap: Record<string, string> = {
    restaurant: "Restaurant",
    hotel: "Hotel",
    activity: "Activity",
  }

  // Helper function to add a new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Title
  doc.setFillColor(88, 28, 135) // Purple
  doc.rect(0, 0, pageWidth, 50, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont("helvetica", "bold")
  doc.text("Your Travel Itinerary", margin, 32)
  
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, margin, 44)

  yPos = 70

  // Summary Box
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 3, 3, 'F')
  
  doc.setTextColor(60, 60, 60)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Trip Overview", margin + 10, yPos + 12)
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const totalCost = items.reduce((sum, item) => sum + item.estimatedCost, 0)
  doc.text(`${items.length} destinations • Estimated Total: $${totalCost.toLocaleString()}`, margin + 10, yPos + 24)

  yPos += 45

  // Items
  items.forEach((item, index) => {
    const research = researchResults.find(r => r.itemId === item.id)
    
    checkNewPage(90)

    // Item Header
    doc.setFillColor(
      item.type === 'restaurant' ? 254 : item.type === 'hotel' ? 59 : 34,
      item.type === 'restaurant' ? 215 : item.type === 'hotel' ? 130 : 197,
      item.type === 'restaurant' ? 215 : item.type === 'hotel' ? 246 : 94
    )
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 2, 2, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(`${index + 1}. ${item.name}`, margin + 5, yPos + 7)
    
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(`${iconMap[item.type]} • $${item.estimatedCost}`, pageWidth - margin - 50, yPos + 7)

    yPos += 15

    if (research) {
      doc.setTextColor(60, 60, 60)
      doc.setFontSize(9)

      // Best Time
      doc.setFont("helvetica", "bold")
      doc.text("Best Time to Visit:", margin + 5, yPos)
      doc.setFont("helvetica", "normal")
      doc.text(research.research.bestTimeToVisit, margin + 45, yPos)
      yPos += 6

      // Duration
      doc.setFont("helvetica", "bold")
      doc.text("Duration:", margin + 5, yPos)
      doc.setFont("helvetica", "normal")
      doc.text(research.research.estimatedDuration, margin + 30, yPos)
      yPos += 6

      // Getting There
      doc.setFont("helvetica", "bold")
      doc.text("Getting There:", margin + 5, yPos)
      yPos += 5
      doc.setFont("helvetica", "normal")
      const gettingThereLines = doc.splitTextToSize(research.research.gettingThere, pageWidth - 2 * margin - 10)
      doc.text(gettingThereLines, margin + 5, yPos)
      yPos += gettingThereLines.length * 4 + 4

      // Tips
      checkNewPage(30)
      doc.setFont("helvetica", "bold")
      doc.text("Tips:", margin + 5, yPos)
      yPos += 5
      doc.setFont("helvetica", "normal")
      research.research.tips.slice(0, 3).forEach(tip => {
        checkNewPage(6)
        doc.text(`• ${tip}`, margin + 8, yPos)
        yPos += 5
      })

      // Reservation note
      if (research.research.reservationRequired) {
        yPos += 3
        doc.setTextColor(180, 0, 0)
        doc.setFont("helvetica", "bold")
        doc.text("⚠ Reservations Recommended", margin + 5, yPos)
        doc.setTextColor(60, 60, 60)
      }

      yPos += 15
    }

    // Separator line
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5)
  })

  // Footer on last page
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text("Generated by Nomad • Your AI Travel Companion", pageWidth / 2, pageHeight - 10, { align: 'center' })

  // Save the PDF
  doc.save(`Nomad-Itinerary-${new Date().toISOString().split('T')[0]}.pdf`)
}

export function ItineraryPanel({ items, onRemoveItem, onClearAll, onReorder }: ItineraryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showResearchModal, setShowResearchModal] = useState(false)
  const [researchProgress, setResearchProgress] = useState(0)
  const [currentResearchItem, setCurrentResearchItem] = useState("")
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([])
  const [isResearchComplete, setIsResearchComplete] = useState(false)
  
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

  const startResearch = async () => {
    setShowResearchModal(true)
    setResearchProgress(0)
    setResearchResults([])
    setIsResearchComplete(false)
    setCurrentResearchItem(items[0]?.name || "")

    try {
      const response = await fetch("/api/research-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter(line => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)

            if (data.type === "progress") {
              setResearchProgress(Math.round((data.current / data.total) * 100))
              setCurrentResearchItem(data.itemName)
            } else if (data.type === "item_complete") {
              setResearchResults(prev => [...prev, data.research])
              setResearchProgress(Math.round((data.current / data.total) * 100))
            } else if (data.type === "complete") {
              setIsResearchComplete(true)
              setResearchProgress(100)
              setCurrentResearchItem("")
            }
          } catch (e) {
            console.error("Error parsing research update:", e)
          }
        }
      }
    } catch (error) {
      console.error("Error during research:", error)
      setIsResearchComplete(true)
    }
  }

  const handleDownloadPDF = async () => {
    await generatePDF(items, researchResults)
  }

  const closeModal = () => {
    setShowResearchModal(false)
    setResearchProgress(0)
    setResearchResults([])
    setIsResearchComplete(false)
  }

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
    <>
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

              {/* Footer with actions */}
              <div className="flex items-center justify-between p-3 border-t border-purple-500/20 bg-black/20">
                <button
                  onClick={onClearAll}
                  className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
                >
                  Clear All
                </button>
                
                {/* Save to PDF Button */}
                <button
                  onClick={startResearch}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Save to PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Research Modal */}
      <ResearchModal
        isOpen={showResearchModal}
        onClose={closeModal}
        items={items}
        progress={researchProgress}
        currentItem={currentResearchItem}
        researchResults={researchResults}
        isComplete={isResearchComplete}
        onDownloadPDF={handleDownloadPDF}
      />
    </>
  )
}
