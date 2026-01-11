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

interface MapboxMapProps {
  route: any
  markers: any[]
}

export function MapboxMap({ route, markers }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  
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
      center: [-122.4194, 37.7749], // San Francisco default
      zoom: 10,
      pitch: 65, // Increased 3D tilt for dramatic effect (0-85 degrees)
      bearing: 0, // Rotation angle
      accessToken: token,  // Also pass as option for redundancy
      antialias: true, // Enable antialiasing for smoother 3D rendering
      projection: "globe", // Enable globe projection for modern 3D effect
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
        
        // Add dark theme fog/atmosphere effect
        map.current!.setFog({
          color: "rgb(20, 30, 48)", // Lower atmosphere - dark blue-gray
          "high-color": "rgb(8, 15, 30)", // Upper atmosphere - very dark blue
          "horizon-blend": 0.15, // Atmosphere thickness
          "space-color": "rgb(0, 0, 10)", // Deep space background - almost black
          "star-intensity": 1.0 // Enhanced star effect for dark theme (max value is 1.0)
        })
        
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
        mapInstance.removeSource("route")
      }
      return
    }

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

    // Route style configuration
    const ROUTE_COLOR = "#346beb" // Vibrant blue

    // Update or add route source
    const routeSource = mapInstance.getSource("route") as mapboxgl.GeoJSONSource
    if (routeSource) {
      // Update existing source data
      routeSource.setData(routeFeature as any)
      // Also update the paint properties in case they changed
      if (mapInstance.getLayer("route")) {
        mapInstance.setPaintProperty("route", "line-color", ROUTE_COLOR)
      }
    } else {
      // Add new source
      mapInstance.addSource("route", {
        type: "geojson",
        data: routeFeature as any
      })

      // Add line layer - insert before any symbol layers so route is visible
      if (!mapInstance.getLayer("route")) {
        // Find the first symbol layer to insert before it
        const layers = mapInstance.getStyle().layers
        const firstSymbolLayer = layers.find(
          (layer) => layer.type === "symbol" && layer.layout?.["text-field"]
        )

        const layerConfig: mapboxgl.LineLayer = {
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round"
          },
          paint: {
            "line-color": ROUTE_COLOR, // Vibrant blue
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              5,
              15,
              7,
              20,
              9
            ],
            "line-opacity": 1,
            "line-blur": 0
          }
        }

        if (firstSymbolLayer) {
          mapInstance.addLayer(layerConfig, firstSymbolLayer.id)
        } else {
          mapInstance.addLayer(layerConfig)
        }
      }
    }

    // Fit map to route bounds (prioritize bounds from waypoints)
    if (route.bounds && route.bounds.north && route.bounds.south && route.bounds.east && route.bounds.west) {
      const bounds = new mapboxgl.LngLatBounds(
        [route.bounds.west, route.bounds.south],
        [route.bounds.east, route.bounds.north]
      )
      mapInstance.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 1000,
        maxZoom: 15
      })
    } else if (coordinates.length > 0) {
      // If no bounds provided, calculate from path coordinates
      const lngs = coordinates.map((c: [number, number]) => c[0])
      const lats = coordinates.map((c: [number, number]) => c[1])
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      )
      mapInstance.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 1000,
        maxZoom: 15
      })
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
        mapInstance.fitBounds(bounds, {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          duration: 1000,
          maxZoom: 15
        })
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

      // Theme colors and icons for different marker types
      const markerConfig: Record<string, { color: string; gradient: string; icon: string; size: number }> = {
        restaurant: { 
          color: "#ef4444", 
          gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          icon: "🍽️",
          size: 44
        },
        activity: { 
          color: "#10b981", 
          gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          icon: "🎯",
          size: 44
        },
        hotel: { 
          color: "#3b82f6", 
          gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          icon: "🏨",
          size: 44
        },
        waypoint: { 
          color: "#f59e0b", 
          gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          icon: "📍",
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
        font-size: ${isWaypoint ? "14px" : "18px"};
        box-shadow: 
          inset 0 2px 4px rgba(255, 255, 255, 0.3), 
          inset 0 -2px 4px rgba(0, 0, 0, 0.2),
          0 2px 8px rgba(0, 0, 0, 0.3);
        animation: markerInnerPop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      `

      // Create icon container
      const iconSpan = document.createElement("span")
      iconSpan.textContent = config.icon
      iconSpan.style.cssText = `display: block;`
      inner.appendChild(iconSpan)
      el.appendChild(inner)

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
            
            ${yelpUrl ? `
              <a href="${yelpUrl}" target="_blank" rel="noopener noreferrer" style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin-top: 8px;
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
          </div>
        </div>
      `

      // Create and add marker - anchor at center for circular markers
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center"
      })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({
            className: "custom-popup",
            closeButton: true,
            closeOnClick: false,
            maxWidth: "340px",
            offset: [0, -config.size / 2 - 5] // Popup appears above the marker
          }).setHTML(popupHTML)
        )
        .addTo(mapInstance)

      markersRef.current.set(markerData.id, marker)
    })
  }, [markers, isLoaded])

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

