"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// Custom CSS for markers and popups
const customStyles = `
  @keyframes markerFadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  
  @keyframes markerInnerPop {
    0% {
      transform: scale(0);
    }
    60% {
      transform: scale(1.15);
    }
    100% {
      transform: scale(1);
    }
  }
  
  .custom-popup .mapboxgl-popup-content {
    background: linear-gradient(145deg, #1f1f2e 0%, #151521 100%);
    border-radius: 12px;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
  }
  
  .custom-popup .mapboxgl-popup-tip {
    border-top-color: #1f1f2e;
    border-bottom-color: #1f1f2e;
  }
  
  .custom-popup .mapboxgl-popup-close-button {
    color: #9ca3af;
    font-size: 18px;
    padding: 4px 8px;
    right: 4px;
    top: 4px;
    border-radius: 50%;
    transition: all 0.2s;
  }
  
  .custom-popup .mapboxgl-popup-close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
`

// Itinerary item type for callback
export interface ItineraryItem {
  id: string
  name: string
  type: "restaurant" | "hotel" | "activity"
  estimatedCost: number
  costLabel: string
  location?: string
  coordinates?: [number, number]
}

interface FlyToTarget {
  coordinates: [number, number] // [lat, lng]
  name?: string
  zoom?: number
}

interface MapboxMapProps {
  route: any
  markers: any[]
  onAddToItinerary?: (item: ItineraryItem) => void
  flyToTarget?: FlyToTarget | null
}

export function MapboxMap({ route, markers, onAddToItinerary, flyToTarget }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const [hasRoute, setHasRoute] = useState(false)
  const rotationAnimationRef = useRef<number | null>(null)
  
  // Inject custom styles on mount
  useEffect(() => {
    const styleId = "mapbox-custom-marker-styles"
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement("style")
      styleElement.id = styleId
      styleElement.textContent = customStyles
      document.head.appendChild(styleElement)
    }
    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])
  
  // Check token on mount
  useEffect(() => {
    const checkToken = async () => {
      try {
        const res = await fetch("/api/mapbox-token")
        const data = await res.json()
        if (!data.configured) {
          setTokenError("Token not configured")
        }
      } catch (e) {
        console.error("Error checking token:", e)
      }
    }
    checkToken()
  }, [])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Get token from environment - must be available at runtime
    // In Next.js, NEXT_PUBLIC_ vars are injected at build time
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    
    console.log("Mapbox token check:", {
      exists: !!token,
      length: token?.length || 0,
      startsWith: token?.substring(0, 3) || "none"
    })
    
    if (!token || token === "" || !token.startsWith("pk.")) {
      const errorMsg = !token 
        ? "Token not found - set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local"
        : !token.startsWith("pk.")
        ? "Invalid token format - should start with 'pk.'"
        : "Token is empty"
      console.error("Mapbox token error:", errorMsg)
      setTokenError(errorMsg)
      setIsLoaded(false)
      return
    }
    
    // Set access token before creating map
    mapboxgl.accessToken = token

    try {
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard", // Modern standard style with 3D support
      center: [0, 20], // Center on Atlantic for nice globe view
      zoom: 1.5, // Zoomed out to show full globe
      pitch: 0, // Flat view for globe
      bearing: 0, // Rotation angle
      accessToken: token,
      antialias: true,
      projection: "globe", // Globe projection for rotating earth effect
      config: {
        basemap: {
          lightPreset: "night" // Dark theme with night lighting
        }
      }
    })

      map.current.on("style.load", () => {
        console.log("Mapbox style loaded, adding modern 3D features...")
        
        // Add 3D terrain DEM source
        if (!map.current!.getSource("mapbox-dem")) {
          map.current!.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14
          })
        }
        
        // Set terrain with exaggeration for dramatic 3D effect
        map.current!.setTerrain({
          source: "mapbox-dem",
          exaggeration: 2.0 // Increased for more dramatic terrain
        })
        
        // Add dark theme fog/atmosphere effect for globe view
        map.current!.setFog({
          color: "rgb(20, 30, 48)", // Lower atmosphere - dark blue-gray
          "high-color": "rgb(8, 15, 30)", // Upper atmosphere - very dark blue
          "horizon-blend": 0.4, // More atmosphere for globe view
          "space-color": "rgb(5, 5, 15)", // Deep space background
          "star-intensity": 1.0 // Stars visible in space
        })
        
        // Start globe rotation animation
        const spinGlobe = () => {
          if (!map.current || hasRoute) return
          
          const center = map.current.getCenter()
          center.lng += 0.05 // Rotate slowly (half speed)
          map.current.setCenter(center)
          
          rotationAnimationRef.current = requestAnimationFrame(spinGlobe)
        }
        
        // Start spinning after a brief delay
        setTimeout(() => {
          if (!hasRoute) {
            spinGlobe()
          }
        }, 1000)
        
        // Find the label layer to insert buildings before it
        const layers = map.current!.getStyle().layers
        const labelLayerId = layers.find(
          (layer: any) => layer.type === "symbol" && layer.layout?.["text-field"]
        )?.id
        
        // Add modern 3D buildings with smooth transitions
        if (!map.current!.getLayer("3d-buildings")) {
          map.current!.addLayer(
            {
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              filter: ["==", "extrude", "true"],
              type: "fill-extrusion",
              minzoom: 13, // Show buildings earlier
              paint: {
                // Dark theme gradient color based on height
                "fill-extrusion-color": [
                  "interpolate",
                  ["linear"],
                  ["get", "height"],
                  0,
                  "#2a2a3a", // Dark gray-blue for low buildings
                  50,
                  "#1a1a2e", // Darker blue-gray
                  100,
                  "#0f0f1e", // Very dark for tall buildings
                  200,
                  "#050510" // Almost black for very tall buildings
                ],
                // Smooth height transition with zoom
                "fill-extrusion-height": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  13,
                  0,
                  13.05,
                  ["get", "height"]
                ],
                "fill-extrusion-base": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  13,
                  0,
                  13.05,
                  ["get", "min_height"]
                ],
                "fill-extrusion-opacity": 0.8 // More visible
              }
            },
            labelLayerId // Insert before labels
          )
        }
        
        // Add dark sky layer for night atmosphere
        if (!map.current!.getLayer("sky")) {
          map.current!.addLayer({
            id: "sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 0.0], // Sun position
              "sky-atmosphere-sun-intensity": 5 // Dimmer for night theme
            }
          })
        }
        
        // Ensure night preset is applied (in case it wasn't set during init)
        try {
          map.current!.setConfigProperty("basemap", "lightPreset", "night")
          console.log("✅ Dark theme (night preset) applied")
        } catch (e) {
          console.log("⚠️ Could not set light preset (may not be supported):", e)
        }
        
        console.log("✅ Modern 3D terrain, buildings, fog, and sky added successfully")
      })

      map.current.on("load", () => {
        console.log("Mapbox map loaded successfully")
        
        // Add modern navigation controls with compass
        map.current!.addControl(
          new mapboxgl.NavigationControl({
            showCompass: true,
            showZoom: true,
            visualizePitch: true // Show pitch visualization
          }),
          "top-right"
        )
        
        // Add fullscreen control for better UX
        map.current!.addControl(
          new mapboxgl.FullscreenControl(),
          "top-right"
        )
        
        setIsLoaded(true)
      })
      
      map.current.on("error", (e: any) => {
        // Only log meaningful errors, ignore common warnings
        if (e.error && e.error.message) {
          const errorMsg = e.error.message.toLowerCase()
          // Ignore common non-critical errors that don't affect functionality
          if (!errorMsg.includes("style") && !errorMsg.includes("source") && !errorMsg.includes("layer")) {
            console.error("Mapbox error:", e.error.message, e.error)
          }
        } else if (e.error) {
          // Log if there's an error object but no message
          console.warn("Mapbox warning:", e.error)
        }
        // Don't set isLoaded to false on errors - map might still be functional
      })

      return () => {
        // Stop rotation animation on cleanup
        if (rotationAnimationRef.current) {
          cancelAnimationFrame(rotationAnimationRef.current)
          rotationAnimationRef.current = null
        }
        if (map.current) {
          map.current.remove()
          map.current = null
        }
      }
    } catch (error) {
      console.error("Failed to initialize Mapbox map:", error)
      setIsLoaded(false)
    }
  }, [])

  // Update route when route data changes
  useEffect(() => {
    if (!map.current || !isLoaded) {
      return
    }

    const mapInstance = map.current

    // If no route, remove existing route if it exists
    if (!route || !route.path || route.path.length === 0) {
      if (mapInstance.getSource("route")) {
        if (mapInstance.getLayer("route")) {
          mapInstance.removeLayer("route")
        }
        if (mapInstance.getLayer("route-border")) {
          mapInstance.removeLayer("route-border")
        }
        if (mapInstance.getLayer("route-glow")) {
          mapInstance.removeLayer("route-glow")
        }
        mapInstance.removeSource("route")
      }
      return
    }
    
    // Stop globe rotation when route is added
    if (rotationAnimationRef.current) {
      cancelAnimationFrame(rotationAnimationRef.current)
      rotationAnimationRef.current = null
    }
    setHasRoute(true)

    // Process route path coordinates
    const coordinates = route.path
      .map((coord: number[]) => {
        // Ensure coord is [lat, lng] and convert to [lng, lat] for Mapbox
        if (Array.isArray(coord) && coord.length >= 2) {
          const lat = typeof coord[0] === 'number' ? coord[0] : parseFloat(String(coord[0]))
          const lng = typeof coord[1] === 'number' ? coord[1] : parseFloat(String(coord[1]))
          // Validate coordinates are within valid ranges
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return [lng, lat] as [number, number] // [lng, lat] for Mapbox
          }
        }
        return null
      })
      .filter((coord: [number, number] | null): coord is [number, number] => coord !== null)

    if (coordinates.length < 2) {
      console.warn("Route has insufficient coordinates:", coordinates.length)
      return
    }

    // Create GeoJSON feature
    const routeFeature = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates
      }
    }

    // Route style configuration - Google Maps inspired
    const ROUTE_COLOR = "#4285F4" // Google blue
    const ROUTE_BORDER_COLOR = "#1a53b0" // Darker blue border
    const ROUTE_WIDTH = 8 // Main line width
    const ROUTE_BORDER_WIDTH = 12 // Border/casing width

    // Update or add route source
    const routeSource = mapInstance.getSource("route") as mapboxgl.GeoJSONSource
    if (routeSource) {
      // Update existing source data
      routeSource.setData(routeFeature as any)
      // Also update the paint properties in case they changed
      if (mapInstance.getLayer("route")) {
        mapInstance.setPaintProperty("route", "line-color", ROUTE_COLOR)
        mapInstance.setPaintProperty("route", "line-width", ROUTE_WIDTH)
      }
      if (mapInstance.getLayer("route-border")) {
        mapInstance.setPaintProperty("route-border", "line-color", ROUTE_BORDER_COLOR)
        mapInstance.setPaintProperty("route-border", "line-width", ROUTE_BORDER_WIDTH)
      }
      if (mapInstance.getLayer("route-glow")) {
        mapInstance.setPaintProperty("route-glow", "line-color", ROUTE_COLOR)
      }
    } else {
      // Add new source
      mapInstance.addSource("route", {
        type: "geojson",
        data: routeFeature as any
      })

      // Add route layers - Google Maps style with border/casing
      if (!mapInstance.getLayer("route")) {
        // Layer 1: Outer glow for visibility
        mapInstance.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": ROUTE_COLOR,
            "line-width": 20,
            "line-opacity": 0.15,
            "line-blur": 8
          }
        })

        // Layer 2: Dark border/casing (like Google Maps)
        mapInstance.addLayer({
          id: "route-border",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": ROUTE_BORDER_COLOR,
            "line-width": ROUTE_BORDER_WIDTH,
            "line-opacity": 1
          }
        })

        // Layer 3: Main route line on top
        mapInstance.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": ROUTE_COLOR,
            "line-width": ROUTE_WIDTH,
            "line-opacity": 1
          }
        })
      }
    }

    // Fit map to route bounds with dramatic transition from globe
    const fitOptions = {
      padding: { top: 80, bottom: 80, left: 80, right: 80 },
      duration: 3000, // Longer duration for dramatic zoom from globe
      maxZoom: 14,
      pitch: 60, // Add 3D tilt when zooming in
      bearing: 0,
      essential: true
    }
    
    if (route.bounds && route.bounds.north && route.bounds.south && route.bounds.east && route.bounds.west) {
      const bounds = new mapboxgl.LngLatBounds(
        [route.bounds.west, route.bounds.south],
        [route.bounds.east, route.bounds.north]
      )
      mapInstance.fitBounds(bounds, fitOptions)
    } else if (coordinates.length > 0) {
      // If no bounds provided, calculate from path coordinates
      const lngs = coordinates.map((c: [number, number]) => c[0])
      const lats = coordinates.map((c: [number, number]) => c[1])
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      )
      mapInstance.fitBounds(bounds, fitOptions)
    } else if (route.waypoints && route.waypoints.length > 0) {
      // Fallback: calculate bounds from waypoints
      const waypointCoords = route.waypoints
        .map((wp: any) => wp.coordinates)
        .filter((coord: any) => coord && coord.length === 2)
      
      if (waypointCoords.length > 0) {
        const lngs = waypointCoords.map((c: number[]) => c[1]) // lng is second
        const lats = waypointCoords.map((c: number[]) => c[0]) // lat is first
        const bounds = new mapboxgl.LngLatBounds(
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        )
        mapInstance.fitBounds(bounds, fitOptions)
      }
    }
  }, [route, isLoaded])

  // Update markers when markers change
  useEffect(() => {
    if (!map.current || !isLoaded) return

    const mapInstance = map.current

    // Remove markers that are no longer in the list
    const currentMarkerIds = new Set(markers.map(m => m.id))
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    // Add or update markers
    markers.forEach((markerData) => {
      if (!markerData.coordinates || !Array.isArray(markerData.coordinates) || markerData.coordinates.length < 2) {
        return
      }

      const [lat, lng] = markerData.coordinates
      
      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return
      }

      // Check if marker already exists
      if (markersRef.current.has(markerData.id)) {
        const existingMarker = markersRef.current.get(markerData.id)!
        existingMarker.setLngLat([lng, lat])
        return
      }

      // Create marker element with modern styling
      const el = document.createElement("div")
      el.className = "custom-marker"

      // Modern SVG icons for different marker types (circular design for accurate positioning)
      const markerConfig: Record<string, { color: string; gradient: string; iconSvg: string; size: number }> = {
        restaurant: { 
          color: "#ef4444", 
          gradient: "linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 50%, #dc2626 100%)",
          iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
            <path d="M7 2v20"/>
            <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>
          </svg>`,
          size: 44
        },
        activity: { 
          color: "#10b981", 
          gradient: "linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)",
          iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>`,
          size: 44
        },
        hotel: { 
          color: "#3b82f6", 
          gradient: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)",
          iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/>
            <path d="m9 16 .348-.24c1.465-1.013 3.84-1.013 5.304 0L15 16"/>
            <path d="M8 7h.01"/><path d="M16 7h.01"/>
            <path d="M12 7h.01"/><path d="M12 11h.01"/>
            <path d="M16 11h.01"/><path d="M8 11h.01"/>
          </svg>`,
          size: 44
        },
        waypoint: { 
          color: "#f59e0b", 
          gradient: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
          iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2"/>
            <path d="M12 20v2"/>
            <path d="M2 12h2"/>
            <path d="M20 12h2"/>
          </svg>`,
          size: 32
        }
      }

      const config = markerConfig[markerData.type] || markerConfig.waypoint
      const isWaypoint = markerData.type === "waypoint"

      // Create outer container - NO transforms here to not interfere with Mapbox positioning
      el.style.cssText = `
        width: ${config.size}px;
        height: ${config.size}px;
        cursor: pointer;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
        animation: markerFadeIn 0.3s ease-out forwards;
      `

      // Create inner marker with gradient background - circular design for reliable positioning
      const inner = document.createElement("div")
      inner.className = "marker-inner"
      inner.style.cssText = `
        width: 100%;
        height: 100%;
        background: ${config.gradient};
        border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 
          inset 0 2px 4px rgba(255, 255, 255, 0.3), 
          inset 0 -2px 4px rgba(0, 0, 0, 0.2),
          0 2px 8px rgba(0, 0, 0, 0.3);
        animation: markerInnerPop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      `

      // Create SVG icon container
      const iconContainer = document.createElement("div")
      iconContainer.style.cssText = `
        width: ${isWaypoint ? "16px" : "22px"};
        height: ${isWaypoint ? "16px" : "22px"};
        display: flex;
        align-items: center;
        justify-content: center;
      `
      iconContainer.innerHTML = config.iconSvg
      inner.appendChild(iconContainer)
      el.appendChild(inner)
      
      // Add price badge if cost data is available
      const costPerPerson = markerData.data?.estimated_cost_per_person
      const costPerNight = markerData.data?.estimated_cost_per_night
      const displayCost = costPerPerson || costPerNight
      
      if (displayCost && !isWaypoint) {
        const priceBadge = document.createElement("div")
        priceBadge.className = "price-badge"
        priceBadge.style.cssText = `
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 8px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
          z-index: 10;
        `
        priceBadge.textContent = `~$${displayCost}`
        el.appendChild(priceBadge)
      }

      // Add hover effect - only modify the inner element, not the outer
      el.addEventListener("mouseenter", () => {
        inner.style.transform = "scale(1.15)"
        inner.style.boxShadow = `
          inset 0 2px 4px rgba(255, 255, 255, 0.4), 
          inset 0 -2px 4px rgba(0, 0, 0, 0.2),
          0 4px 16px rgba(0, 0, 0, 0.4)`
        el.style.filter = "drop-shadow(0 8px 24px rgba(0, 0, 0, 0.6))"
        el.style.zIndex = "1000"
      })
      el.addEventListener("mouseleave", () => {
        inner.style.transform = "scale(1)"
        inner.style.boxShadow = `
          inset 0 2px 4px rgba(255, 255, 255, 0.3), 
          inset 0 -2px 4px rgba(0, 0, 0, 0.2),
          0 2px 8px rgba(0, 0, 0, 0.3)`
        el.style.filter = "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))"
        el.style.zIndex = "auto"
      })

      // Build rich popup content
      const data = markerData.data || {}
      const name = data.name || data.location || markerData.id
      const rating = data.rating
      const reviewCount = data.review_count
      const price = data.price
      const address = data.address
      const phone = data.phone
      const categories = data.categories?.join(", ") || ""
      const imageUrl = data.image_url || data.photo_url
      const yelpUrl = data.yelp_url
      const reviewHighlight = data.review_highlight
      
      // Cost estimation fields from agent
      const estimatedCostPerPerson = data.estimated_cost_per_person
      const estimatedCostPerNight = data.estimated_cost_per_night
      const estimatedTotal = data.estimated_total
      const numGuests = data.num_guests
      const numRooms = data.num_rooms
      const nights = data.nights

      // Create popup HTML with beautiful styling
      const popupHTML = `
        <div class="marker-popup" style="
          min-width: 280px;
          max-width: 320px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          ${imageUrl && !imageUrl.includes("placeholder") ? `
            <div style="
              width: 100%;
              height: 140px;
              background-image: url('${imageUrl}');
              background-size: cover;
              background-position: center;
              border-radius: 8px 8px 0 0;
              margin: -10px -10px 12px -10px;
              width: calc(100% + 20px);
            "></div>
          ` : ""}
          
          <div style="padding: 0 4px;">
            <h3 style="
              margin: 0 0 8px 0;
              font-size: 17px;
              font-weight: 600;
              color: #ffffff;
              line-height: 1.3;
            ">${name}</h3>
            
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
              flex-wrap: wrap;
            ">
              ${rating ? `
                <span style="
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  background: rgba(251, 191, 36, 0.2);
                  padding: 4px 8px;
                  border-radius: 12px;
                  font-size: 13px;
                  font-weight: 500;
                  color: #fbbf24;
                ">
                  ⭐ ${rating}${reviewCount ? ` <span style="color: #9ca3af; font-weight: 400;">(${reviewCount})</span>` : ""}
                </span>
              ` : ""}
              ${price ? `
                <span style="
                  background: rgba(34, 197, 94, 0.2);
                  padding: 4px 8px;
                  border-radius: 12px;
                  font-size: 13px;
                  color: #22c55e;
                  font-weight: 500;
                ">${price}</span>
              ` : ""}
            </div>
            
            ${(estimatedCostPerPerson || estimatedCostPerNight) ? `
              <div style="
                margin: 10px 0;
                padding: 12px;
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1));
                border-radius: 10px;
                border: 1px solid rgba(139, 92, 246, 0.3);
              ">
                <div style="
                  font-size: 11px;
                  color: #a78bfa;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 6px;
                  font-weight: 600;
                ">💰 Estimated Cost</div>
                ${estimatedCostPerPerson ? `
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: ${estimatedTotal ? '4px' : '0'};
                  ">
                    <span style="font-size: 13px; color: #d4d4d8;">Per person:</span>
                    <span style="
                      font-size: 16px;
                      font-weight: 600;
                      color: #c4b5fd;
                    ">~$${estimatedCostPerPerson}</span>
                  </div>
                ` : ""}
                ${estimatedCostPerNight ? `
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: ${estimatedTotal ? '4px' : '0'};
                  ">
                    <span style="font-size: 13px; color: #d4d4d8;">Per night${numRooms > 1 ? '/room' : ''}:</span>
                    <span style="
                      font-size: 16px;
                      font-weight: 600;
                      color: #c4b5fd;
                    ">~$${estimatedCostPerNight}</span>
                  </div>
                ` : ""}
                ${estimatedTotal ? `
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 8px;
                    margin-top: 6px;
                    border-top: 1px solid rgba(139, 92, 246, 0.2);
                  ">
                    <span style="
                      font-size: 13px;
                      font-weight: 500;
                      color: #e4e4e7;
                    ">
                      Total${numGuests > 1 ? ` (${numGuests} guests${numRooms > 1 ? `, ${numRooms} rooms` : ''}${nights > 1 ? `, ${nights} nights` : ''})` : ''}:
                    </span>
                    <span style="
                      font-size: 18px;
                      font-weight: 700;
                      color: #a78bfa;
                    ">~$${estimatedTotal}</span>
                  </div>
                ` : ""}
              </div>
            ` : ""}
            
            ${categories ? `
              <p style="
                margin: 0 0 8px 0;
                font-size: 12px;
                color: #a1a1aa;
                display: flex;
                align-items: center;
                gap: 4px;
              ">
                🏷️ ${categories}
              </p>
            ` : ""}
            
            ${address ? `
              <p style="
                margin: 0 0 6px 0;
                font-size: 13px;
                color: #d4d4d8;
                display: flex;
                align-items: flex-start;
                gap: 6px;
                line-height: 1.4;
              ">
                <span style="flex-shrink: 0;">📍</span>
                <span>${address}</span>
              </p>
            ` : ""}
            
            ${phone ? `
              <p style="
                margin: 0 0 6px 0;
                font-size: 13px;
                color: #d4d4d8;
                display: flex;
                align-items: center;
                gap: 6px;
              ">
                📞 ${phone}
              </p>
            ` : ""}
            
            ${reviewHighlight ? `
              <div style="
                margin: 10px 0;
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border-left: 3px solid ${config.color};
              ">
                <p style="
                  margin: 0;
                  font-size: 12px;
                  color: #e4e4e7;
                  font-style: italic;
                  line-height: 1.5;
                ">"${reviewHighlight}"</p>
              </div>
            ` : ""}
            
            <div style="
              display: flex;
              gap: 8px;
              margin-top: 12px;
              flex-wrap: wrap;
            ">
              ${yelpUrl ? `
                <a href="${yelpUrl}" target="_blank" rel="noopener noreferrer" style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  padding: 8px 12px;
                  background: ${config.gradient};
                  color: white;
                  text-decoration: none;
                  border-radius: 8px;
                  font-size: 13px;
                  font-weight: 500;
                  transition: opacity 0.2s;
                " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                  View on Yelp →
                </a>
              ` : ""}
              
              ${markerData.type !== "waypoint" ? `
                <button 
                  class="add-to-itinerary-btn"
                  data-marker-id="${markerData.id}"
                  style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                  " 
                  onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 12px rgba(139, 92, 246, 0.4)'"
                  onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'"
                >
                  ➕ Add to Itinerary
                </button>
              ` : ""}
            </div>
          </div>
        </div>
      `

      // Create popup
      const popup = new mapboxgl.Popup({
        className: "custom-popup",
        closeButton: true,
        closeOnClick: false,
        maxWidth: "340px",
        offset: [0, -config.size / 2 - 5] // Popup appears above the marker
      }).setHTML(popupHTML)

      // Create and add marker - anchor at center for circular markers
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center"
      })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapInstance)

      // Add event listener for "Add to Itinerary" button after popup opens
      popup.on("open", () => {
        const popupEl = popup.getElement()
        const addBtn = popupEl?.querySelector(".add-to-itinerary-btn")
        if (addBtn && onAddToItinerary) {
          addBtn.addEventListener("click", (e) => {
            e.preventDefault()
            e.stopPropagation()
            
            // Determine cost label and estimated cost
            const costPerPerson = data.estimated_cost_per_person
            const costPerNight = data.estimated_cost_per_night
            const estimatedTotal = data.estimated_total || costPerPerson || costPerNight || 0
            
            let costLabel = ""
            if (costPerPerson) {
              costLabel = `~$${costPerPerson}/person`
            } else if (costPerNight) {
              costLabel = `~$${costPerNight}/night`
            } else if (data.price) {
              costLabel = data.price
            }
            
            const itineraryItem: ItineraryItem = {
              id: `${markerData.type}-${name.toLowerCase().replace(/\s+/g, "-")}`,
              name: name,
              type: markerData.type as "restaurant" | "hotel" | "activity",
              estimatedCost: estimatedTotal,
              costLabel: costLabel,
              location: address,
              coordinates: [lat, lng]
            }
            
            onAddToItinerary(itineraryItem)
            
            // Visual feedback - change button to "Added"
            const btn = e.target as HTMLButtonElement
            btn.innerHTML = "✓ Added!"
            btn.style.background = "linear-gradient(135deg, #22c55e, #16a34a)"
            btn.disabled = true
          })
        }
      })

      markersRef.current.set(markerData.id, marker)
    })
  }, [markers, isLoaded])

  // Fly to target location when flyToTarget changes
  useEffect(() => {
    if (!map.current || !isLoaded || !flyToTarget) return

    const { coordinates, zoom = 16 } = flyToTarget
    if (!coordinates || coordinates.length < 2) return

    const [lat, lng] = coordinates
    
    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return

    // Fly to the location with a smooth animation
    map.current.flyTo({
      center: [lng, lat],
      zoom: zoom,
      duration: 2000,
      essential: true,
      curve: 1.5,
      easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 // easeInOutCubic
    })
  }, [flyToTarget, isLoaded])

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="h-full w-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            {tokenError || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN === "" ? (
              <>
                <div className="text-red-500 mb-4 text-4xl">⚠️</div>
                <p className="text-red-500 font-semibold text-lg">Mapbox token not configured</p>
                <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
                  {tokenError || "Please create"} <code className="bg-gray-200 px-2 py-1 rounded">.env.local</code> in <code>sb_hacks_frontend/y/</code> with:
                </p>
                <pre className="text-xs bg-gray-200 p-3 rounded mt-2 max-w-md mx-auto text-left">
                  NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token-here
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  Then restart the Next.js dev server (npm run dev)
                </p>
                {tokenError && (
                  <p className="text-xs text-red-500 mt-2 font-semibold">
                    Error: {tokenError}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading map...</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

