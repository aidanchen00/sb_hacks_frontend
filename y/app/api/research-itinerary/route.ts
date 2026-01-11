import { NextRequest, NextResponse } from "next/server"

interface ItineraryItem {
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

// Research database - in production, this would call an LLM API
const getResearchForItem = async (item: ItineraryItem): Promise<ResearchResult> => {
  // Simulate API delay for realistic loading
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700))
  
  const typeSpecificInfo = {
    restaurant: {
      bestTimeToVisit: "Weekdays 6-7 PM for shorter wait times",
      estimatedDuration: "1-2 hours for a full dining experience",
      gettingThere: item.location ? `Located at ${item.location}. Street parking available nearby, or use rideshare for convenience.` : "Check Google Maps for directions and parking options.",
      tips: [
        "Make reservations in advance, especially for weekends",
        "Check the menu online before visiting",
        "Ask about daily specials and chef's recommendations",
        "Consider visiting during happy hour for better deals"
      ],
      nearbyAttractions: [
        "Local shops and boutiques within walking distance",
        "Parks and scenic areas nearby for a post-meal walk"
      ],
      reservationRequired: true,
      accessibility: "Most restaurants offer wheelchair access. Call ahead to confirm specific accommodations."
    },
    hotel: {
      bestTimeToVisit: "Check-in typically after 3 PM, check-out by 11 AM",
      estimatedDuration: "Overnight stay",
      gettingThere: item.location ? `Address: ${item.location}. Most hotels offer airport shuttle service.` : "Request shuttle service or use rideshare from the airport.",
      tips: [
        "Book directly with hotel for best rate guarantee",
        "Join loyalty program for free upgrades",
        "Request early check-in or late checkout if needed",
        "Ask about complimentary amenities (breakfast, WiFi, parking)"
      ],
      nearbyAttractions: [
        "Ask concierge for local recommendations",
        "Many hotels are near business districts and attractions"
      ],
      reservationRequired: true,
      accessibility: "ADA-compliant rooms available upon request. Contact hotel directly for specific needs."
    },
    activity: {
      bestTimeToVisit: "Early morning or late afternoon to avoid crowds",
      estimatedDuration: "2-4 hours depending on interest level",
      gettingThere: item.location ? `Located at ${item.location}. Public transit and rideshare are convenient options.` : "Check the venue website for transportation options and parking.",
      tips: [
        "Purchase tickets online to skip the line",
        "Wear comfortable walking shoes",
        "Bring water and snacks for longer visits",
        "Download the venue's app for maps and guides"
      ],
      nearbyAttractions: [
        "Check for combo tickets with nearby attractions",
        "Plan to explore the surrounding neighborhood"
      ],
      reservationRequired: false,
      accessibility: "Most attractions offer accessibility accommodations. Check website or call ahead."
    }
  }

  const info = typeSpecificInfo[item.type]

  return {
    itemId: item.id,
    itemName: item.name,
    itemType: item.type,
    research: {
      ...info,
      // Customize based on item details
      gettingThere: item.coordinates 
        ? `GPS: ${item.coordinates[0].toFixed(4)}, ${item.coordinates[1].toFixed(4)}. ${info.gettingThere}`
        : info.gettingThere
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json() as { items: ItineraryItem[] }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No itinerary items provided" },
        { status: 400 }
      )
    }

    console.log(`📋 Researching ${items.length} itinerary items...`)

    // Create a streaming response for progress updates
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const results: ResearchResult[] = []

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          
          // Send progress update
          controller.enqueue(encoder.encode(
            JSON.stringify({
              type: "progress",
              current: i + 1,
              total: items.length,
              itemName: item.name,
              status: "researching"
            }) + "\n"
          ))

          try {
            const research = await getResearchForItem(item)
            results.push(research)

            // Send item completion
            controller.enqueue(encoder.encode(
              JSON.stringify({
                type: "item_complete",
                current: i + 1,
                total: items.length,
                itemName: item.name,
                research: research
              }) + "\n"
            ))
          } catch (error) {
            console.error(`Error researching ${item.name}:`, error)
            controller.enqueue(encoder.encode(
              JSON.stringify({
                type: "item_error",
                current: i + 1,
                total: items.length,
                itemName: item.name,
                error: "Failed to research this item"
              }) + "\n"
            ))
          }
        }

        // Send final results
        controller.enqueue(encoder.encode(
          JSON.stringify({
            type: "complete",
            results: results,
            totalItems: items.length
          }) + "\n"
        ))

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    })
  } catch (error) {
    console.error("Error in research API:", error)
    return NextResponse.json(
      { error: "Failed to research itinerary" },
      { status: 500 }
    )
  }
}

