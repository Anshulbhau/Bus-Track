import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useBuses } from '../hooks/useSupabase'
import type { Trip, RouteStop, Stop, Route } from '../types/database'

type LocationMap = Record<string, {
  lat: number
  lng: number
  speed: number | null
  recorded_at: string
}>

type RouteWithStops = Route & {
  route_stops: (RouteStop & { stops: Stop })[]
}

type TripData = Trip & {
  routes: {
    route_name: string
    start_location: string
    end_location: string
    route_stops: (RouteStop & { stops: Stop })[]
  }
}

function getMapCenter() {
  try {
    const saved = localStorage.getItem('transit_map_center')
    if (saved) return JSON.parse(saved) as { lat: number; lng: number; zoom: number }
  } catch { /* ignore */ }
  return { lat: 32.7266, lng: 74.8570, zoom: 12 }
}

const busIcon = new L.DivIcon({
  className: 'custom-bus-marker',
  html: `<div style="background:var(--color-primary);color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,0,0,0.5);border:2px solid white;font-size:18px;">🚌</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
})

export default function LiveMap() {
  const { data: buses } = useBuses()
  const [locations, setLocations] = useState<LocationMap>({})
  const [activeTrips, setActiveTrips] = useState<TripData[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [allStops, setAllStops] = useState<Stop[]>([])
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [allRoutes, setAllRoutes] = useState<RouteWithStops[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [osrmRouteCache, setOsrmRouteCache] = useState<Record<string, [number, number][]>>({})
  const osrmCacheRef = useRef<Record<string, [number, number][]>>({})
  const mapCenter = getMapCenter()

  // Fetch OSRM road-following route between waypoints
  async function fetchOSRMRoute(waypoints: [number, number][]): Promise<[number, number][]> {
    if (waypoints.length < 2) return waypoints
    // OSRM expects lng,lat format
    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';')
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
      )
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
        // GeoJSON returns [lng, lat], convert to [lat, lng] for Leaflet
        return data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        )
      }
    } catch (e) {
      console.warn('OSRM fetch failed, falling back to straight lines', e)
    }
    return waypoints // fallback to straight lines
  }

  // Fetch active trips and their routes/stops
  const fetchActiveTrips = async () => {
    const { data: trips } = await supabase
      .from('trips')
      .select('*, routes(*, route_stops(*, stops(*)))')
      .eq('status', 'running')

    if (trips) {
      // Sort route_stops for each trip and handle potential array structure
      const processed: TripData[] = (trips as any[]).map(trip => {
        const route = Array.isArray(trip.routes) ? trip.routes[0] : trip.routes
        return {
          ...trip,
          routes: {
            ...route,
            route_stops: (route?.route_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order)
          }
        }
      })
      setActiveTrips(processed)
    }
  }

  // Fetch all stops and all routes with their stops
  useEffect(() => {
    async function fetchAllStops() {
      const { data } = await supabase
        .from('stops')
        .select('*')
      if (data) setAllStops(data)
    }
    async function fetchAllRoutes() {
      const { data } = await supabase
        .from('routes')
        .select('*, route_stops(*, stops(*))')
      if (data) {
        // Sort route_stops by stop_order for each route
        const processed = (data as any[]).map((route) => ({
          ...route,
          route_stops: (route.route_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order)
        }))
        setAllRoutes(processed as RouteWithStops[])
      }
    }
    fetchAllStops()
    fetchAllRoutes()
  }, [])

  // Fetch OSRM routes for all routes and active trips
  useEffect(() => {
    let cancelled = false

    async function loadAllOSRM() {
      const cache = { ...osrmCacheRef.current }
      let updated = false

      // Load OSRM for all routes
      for (const route of allRoutes) {
        if (cancelled) return
        const cacheKey = `route-${route.id}`
        if (cache[cacheKey]) continue
        const waypoints = (route.route_stops || [])
          .filter((rs: any) => rs.stops?.latitude && rs.stops?.longitude)
          .map((rs: any) => [Number(rs.stops.latitude), Number(rs.stops.longitude)] as [number, number])
        if (waypoints.length < 2) continue
        cache[cacheKey] = await fetchOSRMRoute(waypoints)
        updated = true
      }

      // Load OSRM for active trips (direction-aware)
      for (const trip of activeTrips) {
        if (cancelled) return
        const isReturn = trip.direction === 'return'
        const cacheKey = `trip-${trip.id}-${isReturn ? 'return' : 'onward'}`
        if (cache[cacheKey]) continue
        const waypoints = getDirectionAwarePositions(trip)
        if (waypoints.length < 2) continue
        cache[cacheKey] = await fetchOSRMRoute(waypoints)
        updated = true
      }

      if (updated && !cancelled) {
        osrmCacheRef.current = cache
        setOsrmRouteCache({ ...cache })
      }
    }

    loadAllOSRM()
    return () => { cancelled = true }
  }, [allRoutes, activeTrips])

  useEffect(() => {
    fetchActiveTrips()
    
    // Real-time subscription for trip status changes
    const tripChannel = supabase
      .channel('trip_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        fetchActiveTrips()
      })
      .subscribe()
    async function fetchLatestLocations() {
      const { data } = await supabase
        .from('vehicle_locations')
        .select('vehicle_id, latitude, longitude, speed, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(100) // Optimization: Only fetch recent points to avoid massive data load

      if (data) {
        const map: LocationMap = {}
        for (const loc of data) {
          if (!map[loc.vehicle_id]) {
            map[loc.vehicle_id] = {
              lat: loc.latitude,
              lng: loc.longitude,
              speed: loc.speed,
              recorded_at: loc.recorded_at,
            }
          }
        }
        setLocations(map)
        if (data.length > 0) setLastUpdate(new Date())
      }
    }

    fetchLatestLocations()

    // Real-time subscription for new location pings
    const channel = supabase
      .channel('bus_locations_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_locations' }, (payload: any) => {
        const loc = payload.new
        setLocations(prev => ({
          ...prev,
          [loc.vehicle_id]: {
            lat: loc.latitude,
            lng: loc.longitude,
            speed: loc.speed,
            recorded_at: loc.recorded_at,
          },
        }))
        setLastUpdate(new Date())
      })
      .subscribe()

    return () => { 
      supabase.removeChannel(channel)
      supabase.removeChannel(tripChannel)
    }
  }, [])

  // Find all routes that pass through the selected stop
  const highlightedRouteIds = useMemo(() => {
    if (!selectedStopId) return new Set<string>()
    const ids = new Set<string>()
    activeTrips.forEach(trip => {
      const route = trip.routes
      if (!route?.route_stops) return
      const found = route.route_stops.some((rs: any) => rs.stops?.id === selectedStopId)
      if (found) ids.add(trip.id)
    })
    return ids
  }, [selectedStopId, activeTrips])

  // Helper: for a trip, get direction-aware stops (reversed for return trips)
  function getDirectionAwareStops(trip: TripData) {
    const route = trip.routes
    if (!route?.route_stops) return []
    const stops = [...route.route_stops]
    if (trip.direction === 'return') {
      stops.reverse()
    }
    return stops
  }

  // Helper: get direction-aware positions for polyline
  function getDirectionAwarePositions(trip: TripData): [number, number][] {
    const stops = getDirectionAwareStops(trip)
    return stops
      .filter(rs => rs.stops && rs.stops.latitude && rs.stops.longitude)
      .map(rs => [Number(rs.stops.latitude), Number(rs.stops.longitude)] as [number, number])
  }

  // Helper: get start/end location labels based on direction
  function getDirectionLabels(trip: TripData) {
    const route = trip.routes
    const isReturn = trip.direction === 'return'
    return {
      toLabel: isReturn ? route?.start_location : route?.end_location,
      directionBadge: isReturn ? '↩ Return' : '→ Onward',
      isReturn,
    }
  }

  const selectedTrip = activeTrips.find(t => t.id === selectedTripId)
  const activeTripToDisplay = selectedTrip || (!selectedRouteId && activeTrips.length > 0 ? activeTrips[0] : null)
  const selectedRoute = allRoutes.find(r => r.id === selectedRouteId)
  const totalLocations = Object.keys(locations).length

  // Helper: calculate distance between two lat/lng points (in km)
  function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // Helper: find the nearest stop index to the bus location for a trip
  function findNearestStopIndex(trip: TripData): number {
    const loc = locations[trip.vehicle_id]
    if (!loc) return -1
    const stops = getDirectionAwareStops(trip)
    let nearest = -1
    let minDist = Infinity
    stops.forEach((rs, idx) => {
      if (!rs.stops?.latitude || !rs.stops?.longitude) return
      const d = haversineDistance(loc.lat, loc.lng, Number(rs.stops.latitude), Number(rs.stops.longitude))
      if (d < minDist) { minDist = d; nearest = idx }
    })
    return nearest
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Live Map</h2>
          <p>Real-time bus tracking across the transit network</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: totalLocations > 0 ? 'var(--color-success)' : 'var(--color-text-muted)',
            display: 'inline-block',
            boxShadow: totalLocations > 0 ? '0 0 6px var(--color-success)' : 'none',
          }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Waiting for data…'}
          </span>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card--accent">
          <div className="stat-card__header"><div className="stat-card__icon">🚌</div></div>
          <div className="stat-card__value">{buses.length}</div>
          <div className="stat-card__label">Total Fleet</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__icon">📍</div></div>
          <div className="stat-card__value">{totalLocations}</div>
          <div className="stat-card__label">Broadcasting Location</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__header"><div className="stat-card__icon">📡</div></div>
          <div className="stat-card__value">{buses.length - totalLocations}</div>
          <div className="stat-card__label">Offline</div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel__header">
          <h3 className="glass-panel__title">Transit Network Map</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedStopId && (
              <button
                onClick={() => setSelectedStopId(null)}
                style={{
                  fontSize: 'var(--font-size-xs)', color: '#3b82f6',
                  background: 'rgba(59, 130, 246, 0.1)', padding: '4px 10px',
                  borderRadius: 20, border: '1px solid rgba(59, 130, 246, 0.3)',
                  cursor: 'pointer',
                }}
              >
                ✕ Clear stop filter
              </button>
            )}
            <span style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
              background: 'var(--color-bg-glass)', padding: '4px 10px',
              borderRadius: 20, border: '1px solid var(--color-border)',
            }}>
              OpenStreetMap · Live
            </span>
          </div>
        </div>
        <div style={{ height: 500, position: 'relative' }}>
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={mapCenter.zoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Render dark route lines for ALL routes using OSRM road geometry */}
            {allRoutes.map(route => {
              const cacheKey = `route-${route.id}`
              const positions = osrmRouteCache[cacheKey]
              if (!positions || positions.length < 2) return null

              // Check if this route is part of any active trip
              const hasActiveTrip = activeTrips.some(t => {
                const r = t.routes
                return r?.route_name === route.route_name
              })
              if (hasActiveTrip) return null

              return (
                <Polyline
                  key={`route-${route.id}`}
                  positions={positions}
                  pathOptions={{
                    color: selectedRouteId === route.id ? '#1d4ed8' : '#2563eb',
                    weight: selectedRouteId === route.id ? 6 : 4,
                    opacity: selectedRouteId === route.id ? 1 : 0.8,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedRouteId(prev => prev === route.id ? null : route.id)
                      setSelectedTripId(null)
                    }
                  }}
                />
              )
            })}

            {/* Render Route Polylines for active trips using OSRM road geometry */}
            {activeTrips.map(trip => {
              const isReturn = trip.direction === 'return'
              const cacheKey = `trip-${trip.id}-${isReturn ? 'return' : 'onward'}`
              const positions = osrmRouteCache[cacheKey] || getDirectionAwarePositions(trip)
              if (positions.length < 2) return null
              
              const isSelected = selectedTripId === trip.id
              const isHighlighted = highlightedRouteIds.has(trip.id)
              const dimmed = (selectedStopId || selectedRouteId) && !isHighlighted && !isSelected

              return (
                <Polyline
                  key={trip.id}
                  positions={positions}
                  pathOptions={{
                    color: isHighlighted ? '#60a5fa' : isSelected ? 'var(--color-accent)' : '#2563eb',
                    weight: isHighlighted ? 5 : isSelected ? 4 : 3,
                    opacity: dimmed ? 0.15 : isHighlighted ? 1 : isSelected ? 1 : 0.7,
                    dashArray: undefined
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedTripId(trip.id)
                      setSelectedRouteId(null)
                    }
                  }}
                />
              )
            })}

            {/* Render ALL stops from the stops table as blue markers */}
            {allStops.map(stop => {
              if (!stop.latitude || !stop.longitude) return null
              // Check if this stop is a start/end of any active trip (to avoid overlap)
              const isActiveEndpoint = activeTrips.some(trip => {
                const dirStops = getDirectionAwareStops(trip)
                if (!dirStops.length) return false
                const firstStopId = dirStops[0]?.stops?.id
                const lastStopId = dirStops[dirStops.length - 1]?.stops?.id
                return stop.id === firstStopId || stop.id === lastStopId
              })
              if (isActiveEndpoint) return null

              const isSelectedStop = selectedStopId === stop.id
              const isOnHighlightedRoute = highlightedRouteIds.size > 0 && activeTrips.some(trip => {
                if (!highlightedRouteIds.has(trip.id)) return false
                const route = trip.routes
                return route?.route_stops?.some((rs: any) => rs.stops?.id === stop.id)
              })

              return (
                <CircleMarker
                  key={`stop-${stop.id}`}
                  center={[Number(stop.latitude), Number(stop.longitude)]}
                  radius={isSelectedStop ? 8 : isOnHighlightedRoute ? 6 : 5}
                  pathOptions={{
                    fillColor: isSelectedStop ? '#f59e0b' : isOnHighlightedRoute ? '#60a5fa' : '#3b82f6',
                    fillOpacity: isSelectedStop ? 1 : isOnHighlightedRoute ? 1 : 0.9,
                    color: 'white',
                    weight: isSelectedStop ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedStopId(prev => prev === stop.id ? null : stop.id)
                    }
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: 12 }}>
                      <strong>🔵 {stop.stop_name}</strong>
                      <div style={{ color: '#666', marginTop: 2 }}>Bus Stop</div>
                      {isOnHighlightedRoute && (
                        <div style={{ color: '#3b82f6', marginTop: 4, fontWeight: 600 }}>On highlighted route</div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* Render Stops for all active trips (direction-aware) */}
            {activeTrips.map(trip => {
              const dirStops = getDirectionAwareStops(trip)
              if (!dirStops.length) return null
              const isReturn = trip.direction === 'return'

              return dirStops.map((rs, idx) => {
                const stop = rs.stops
                if (!stop || !stop.latitude || !stop.longitude) return null

                const isFirst = idx === 0
                const isLast = idx === dirStops.length - 1
                const isSelected = selectedTripId === trip.id
                const isStopSelected = selectedStopId === stop.id
                
                // Show all stops for the selected trip, otherwise just start/end for other trips
                if (!isSelected && !isFirst && !isLast) return null 

                // For return trips: swap green/red colors
                let fillColor: string
                if (isFirst) {
                  fillColor = isReturn ? 'var(--color-danger)' : 'var(--color-success)'
                } else if (isLast) {
                  fillColor = isReturn ? 'var(--color-success)' : 'var(--color-danger)'
                } else {
                  fillColor = '#3498db'
                }

                return (
                  <CircleMarker
                    key={`trip-stop-${trip.id}-${rs.id}`}
                    center={[Number(stop.latitude), Number(stop.longitude)]}
                    radius={isFirst || isLast ? (isStopSelected ? 9 : 6) : (isStopSelected ? 7 : 4)}
                    pathOptions={{
                      fillColor: isStopSelected ? '#f59e0b' : fillColor,
                      fillOpacity: 1,
                      color: 'white',
                      weight: isStopSelected ? 3 : 2,
                    }}
                    eventHandlers={{
                      click: () => {
                        setSelectedStopId(prev => prev === stop.id ? null : stop.id)
                      }
                    }}
                  >
                    <Popup>
                      <div style={{ fontSize: 12 }}>
                        <strong>{stop.stop_name}</strong>
                        <div style={{ color: 'var(--color-text-muted)' }}>
                          {isFirst ? (isReturn ? 'Return Start (was End)' : 'Departure Point') : 
                           isLast ? (isReturn ? 'Return End (was Start)' : 'Final Destination') : 
                           `Stop Order: ${rs.stop_order}`}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })
            })}

            {buses.map(bus => {
              const loc = locations[bus.id]
              if (!loc) return null
              const trip = activeTrips.find(t => t.vehicle_id === bus.id)
              
              return (
                <Marker 
                  key={bus.id} 
                  position={[loc.lat, loc.lng]} 
                  icon={busIcon}
                  eventHandlers={{
                    click: () => trip && setSelectedTripId(trip.id)
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong style={{ fontSize: 14 }}>🚌 {bus.vehicle_number}</strong>
                      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: '#444' }}>
                        <div>Driver: <strong>{(bus as any).profiles?.name ?? 'Unassigned'}</strong></div>
                        <div>Route: <strong>{trip?.routes?.route_name ?? 'No active trip'}</strong></div>
                        {trip && <div>Direction: <strong>{trip.direction === 'return' ? '↩ Return' : '→ Onward'}</strong></div>}
                        <div>Speed: <strong>{loc.speed != null ? `${loc.speed} km/h` : 'N/A'}</strong></div>
                        <div>Updated: {new Date(loc.recorded_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>

          {/* Map Legend */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 500,
            background: 'rgba(15, 20, 35, 0.85)', backdropFilter: 'blur(8px)',
            borderRadius: 10, padding: '10px 14px', fontSize: 11,
            color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            <div style={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Legend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} /> Departure
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }} /> Destination
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> Bus Stop
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Selected Stop
            </div>
          </div>

          {totalLocations === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(11,15,26,0.75)', zIndex: 500, gap: 12,
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: '2.5rem' }}>📡</span>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                No bus locations available yet
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Locations will appear once drivers start broadcasting
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Route details panel for NON-ACTIVE routes */}
      {selectedRoute && !selectedTripId && (() => {
        const stops = (selectedRoute.route_stops || []) as any[]
        return (
          <div className="trip-details-grid">
            <div className="glass-panel trip-info-panel">
              <div className="glass-panel__header">
                <div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                    fontSize: 'var(--font-size-xs)', fontWeight: 600,
                    background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb',
                    marginBottom: 8,
                  }}>Route</span>
                  <h3 className="glass-panel__title">{selectedRoute.route_name}</h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {selectedRoute.start_location} → {selectedRoute.end_location}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800 }}>{stops.length}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Stops</div>
                  {selectedRoute.distance_km && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>{selectedRoute.distance_km} km</div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: '8px 0', borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
                No live buses on this route
              </div>

              <div className="trip-timeline">
                {stops.map((rs: any, idx: number) => {
                  const isFirst = idx === 0
                  const isLast = idx === stops.length - 1
                  return (
                    <div key={rs.id} className="timeline-item">
                      <div className="timeline-marker">
                        <div className={`marker-dot ${isFirst ? 'start' : isLast ? 'end' : ''}`} />
                        {idx < stops.length - 1 && <div className="marker-line" />}
                      </div>
                      <div className="timeline-content">
                        <div className="stop-name">{rs.stops?.stop_name || 'Unknown Stop'}</div>
                        <div className="stop-meta">
                          {isFirst ? 'Departure Point' : isLast ? 'Final Destination' : `Stop #${rs.stop_order}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="glass-panel active-buses-panel">
              <div className="glass-panel__header">
                <h3 className="glass-panel__title">Route Info</h3>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Type</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{selectedRoute.route_type || 'General'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Distance</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{selectedRoute.distance_km ? `${selectedRoute.distance_km} km` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>From</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{selectedRoute.start_location}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>To</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{selectedRoute.end_location}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Total Stops</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{stops.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Status</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>No Active Trip</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Trip details panel for ACTIVE trips */}
      {activeTripToDisplay && (() => {
        const dirStops = getDirectionAwareStops(activeTripToDisplay)
        const { toLabel, directionBadge, isReturn } = getDirectionLabels(activeTripToDisplay)
        const nearestStopIdx = findNearestStopIndex(activeTripToDisplay)
        const busLoc = locations[activeTripToDisplay.vehicle_id]
        
        return (
          <div className="trip-details-grid">
            <div className="glass-panel trip-info-panel">
              <div className="glass-panel__header">
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span className="badge badge--success" style={{ display: 'inline-block' }}>Running</span>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                      fontSize: 'var(--font-size-xs)', fontWeight: 600,
                      background: isReturn ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: isReturn ? '#ef4444' : '#22c55e',
                    }}>
                      {directionBadge}
                    </span>
                  </div>
                  <h3 className="glass-panel__title">{activeTripToDisplay.routes.route_name}</h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    To {toLabel}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800 }}>{buses.find(b => b.id === activeTripToDisplay.vehicle_id)?.vehicle_number}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Bus ID</div>
                </div>
              </div>

              {/* Bus progress indicator */}
              {busLoc && nearestStopIdx >= 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', margin: '0 0 8px',
                  background: 'rgba(37, 99, 235, 0.08)', borderRadius: 8, border: '1px solid rgba(37, 99, 235, 0.2)',
                }}>
                  <span style={{ fontSize: 20 }}>🚌</span>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                      Near: {dirStops[nearestStopIdx]?.stops?.stop_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {nearestStopIdx + 1} of {dirStops.length} stops · {busLoc.speed != null ? `${busLoc.speed} km/h` : 'Speed N/A'}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="trip-timeline">
                {dirStops.map((rs, idx) => {
                  const isFirst = idx === 0
                  const isLast = idx === dirStops.length - 1
                  const isBusHere = idx === nearestStopIdx
                  const isPassed = nearestStopIdx >= 0 && idx < nearestStopIdx
                  const isUpcoming = nearestStopIdx >= 0 && idx > nearestStopIdx
                  
                  // For return trips, swap class names for marker colors
                  let dotClass = ''
                  if (isFirst) dotClass = isReturn ? 'end' : 'start'
                  else if (isLast) dotClass = isReturn ? 'start' : 'end'
                  
                  let label: string
                  if (isFirst) label = isReturn ? 'Return Start (was Destination)' : 'Departure Point'
                  else if (isLast) label = isReturn ? 'Return End (was Departure)' : 'Final Destination'
                  else label = `Stop #${rs.stop_order}`

                  // Add status to label
                  if (isBusHere) label += ' · 🚌 Bus is here'
                  else if (isPassed) label += ' · ✓ Passed'

                  return (
                    <div key={rs.id} className="timeline-item" style={{ opacity: isUpcoming ? 0.5 : 1 }}>
                      <div className="timeline-marker">
                        <div
                          className={`marker-dot ${dotClass}`}
                          style={isBusHere ? {
                            background: '#2563eb',
                            boxShadow: '0 0 8px rgba(37, 99, 235, 0.6)',
                            width: 14, height: 14,
                            marginLeft: -2, marginTop: -2,
                          } : isPassed ? {
                            background: 'var(--color-success)',
                            opacity: 0.7,
                          } : undefined}
                        />
                        {idx < dirStops.length - 1 && (
                          <div className="marker-line" style={isPassed ? {
                            background: 'var(--color-success)',
                            opacity: 0.5,
                          } : undefined} />
                        )}
                      </div>
                      <div className="timeline-content">
                        <div className="stop-name" style={{ fontWeight: isBusHere ? 700 : 500 }}>{rs.stops?.stop_name || 'Unknown Stop'}</div>
                        <div className="stop-meta" style={{ color: isBusHere ? '#2563eb' : undefined }}>{label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="glass-panel active-buses-panel">
              <div className="glass-panel__header">
                <h3 className="glass-panel__title">Running Fleet</h3>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bus</th>
                      <th>Route</th>
                      <th>Dir</th>
                      <th>Speed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrips.map(trip => {
                      const bus = buses.find(b => b.id === trip.vehicle_id)
                      const loc = locations[trip.vehicle_id]
                      const isSel = selectedTripId === trip.id
                      const tripDir = trip.direction === 'return' ? '↩' : '→'
                      return (
                        <tr 
                          key={trip.id} 
                          onClick={() => setSelectedTripId(trip.id)}
                          style={{ cursor: 'pointer', background: isSel ? 'var(--color-bg-hover)' : 'transparent' }}
                        >
                          <td>{bus?.vehicle_number}</td>
                          <td>{trip.routes.route_name}</td>
                          <td>
                            <span style={{
                                fontSize: 'var(--font-size-xs)', fontWeight: 600,
                                color: trip.direction === 'return' ? '#ef4444' : '#22c55e',
                              }}>
                                {tripDir}
                              </span>
                          </td>
                          <td>{loc?.speed != null ? `${loc.speed} km/h` : '—'}</td>
                          <td><span className="status-badge status-badge--running"><span className="status-badge__dot" />Live</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
