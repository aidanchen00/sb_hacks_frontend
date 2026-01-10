"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

interface MapboxMapProps {
  route: any
  markers: any[]
}

export function MapboxMap({ route, markers }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  
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
      style: "mapbox://styles/mapbox/satellite-streets-v12", // Use satellite for better 3D effect
      center: [-122.4194, 37.7749], // San Francisco default
      zoom: 10,
      pitch: 60, // 3D tilt angle (0-60 degrees)
      bearing: 0, // Rotation angle
      accessToken: token,  // Also pass as option for redundancy
      antialias: true // Enable antialiasing for smoother 3D rendering
    })

      map.current.on("style.load", () => {
        console.log("Mapbox style loaded, adding 3D features...")
        
        // Add 3D terrain DEM source
        if (!map.current!.getSource("mapbox-dem")) {
          map.current!.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14
          })
        }
        
        // Set terrain with exaggeration for 3D effect
        map.current!.setTerrain({
          source: "mapbox-dem",
          exaggeration: 1.5
        })
        
        // Add 3D buildings layer using composite source
        if (!map.current!.getLayer("3d-buildings")) {
          map.current!.addLayer({
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#aaa",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.6
            }
          })
        }
        
        // Add sky layer for atmosphere
        if (!map.current!.getLayer("sky")) {
          map.current!.addLayer({
            id: "sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 0.0],
              "sky-atmosphere-sun-intensity": 15
            }
          })
        }
        
        console.log("✅ 3D terrain, buildings, and sky added successfully")
      })

      map.current.on("load", () => {
        console.log("Mapbox map loaded successfully")
        
        // Add navigation controls
        map.current!.addControl(new mapboxgl.NavigationControl(), "top-right")
        
        setIsLoaded(true)
      })
      
      map.current.on("error", (e) => {
        console.error("Mapbox error:", e)
        setIsLoaded(false)
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
    if (!map.current || !isLoaded || !route) return

    const mapInstance = map.current

    // Remove existing route source if it exists
    if (mapInstance.getSource("route")) {
      mapInstance.removeLayer("route")
      mapInstance.removeSource("route")
    }

    // Add route path
    if (route.path && route.path.length > 0) {
      const coordinates = route.path.map((coord: number[]) => [coord[1], coord[0]]) // [lng, lat]

      mapInstance.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates
          }
        }
      })

      mapInstance.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round"
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 4
        }
      })

      // Fit map to route bounds
      if (route.bounds) {
        const bounds = new mapboxgl.LngLatBounds(
          [route.bounds.west, route.bounds.south],
          [route.bounds.east, route.bounds.north]
        )
        mapInstance.fitBounds(bounds, { padding: 50 })
      }
    }
  }, [route, isLoaded])

  // Update markers when markers change
  useEffect(() => {
    if (!map.current || !isLoaded) return

    const mapInstance = map.current

    // Remove existing markers
    markers.forEach((marker) => {
      if (marker.markerInstance) {
        marker.markerInstance.remove()
      }
    })

    // Add new markers
    markers.forEach((markerData) => {
      if (!markerData.coordinates) return

      const [lat, lng] = markerData.coordinates
      const el = document.createElement("div")
      el.className = "marker"

      // Different colors for different types
      const colors: Record<string, string> = {
        restaurant: "#ef4444",
        activity: "#10b981",
        hotel: "#3b82f6",
        waypoint: "#f59e0b"
      }

      el.style.width = "20px"
      el.style.height = "20px"
      el.style.borderRadius = "50%"
      el.style.backgroundColor = colors[markerData.type] || "#6b7280"
      el.style.border = "2px solid white"
      el.style.cursor = "pointer"

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${markerData.data?.name || markerData.id}</h3>
              ${markerData.data?.rating ? `<p>⭐ ${markerData.data.rating}</p>` : ""}
              ${markerData.data?.address ? `<p class="text-sm text-gray-600">${markerData.data.address}</p>` : ""}
            </div>
          `)
        )
        .addTo(mapInstance)

      markerData.markerInstance = marker
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

