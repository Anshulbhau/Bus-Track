import { supabase, shadowSupabase } from '../lib/supabase'

/* ═══════════════════════════════════════
   Mutation helpers – insert / update / delete
   ═══════════════════════════════════════ */

// ── Vehicles ──
export async function insertBus(data: { vehicle_number: string; capacity: number; driver_id?: string | null; vehicle_type?: string | null }) {
  return supabase.from('vehicles').insert(data).select().single()
}

export async function updateBus(id: string, data: Partial<{ vehicle_number: string; capacity: number; driver_id: string | null; vehicle_type: string | null }>) {
  return supabase.from('vehicles').update(data).eq('id', id).select().single()
}

export async function deleteBus(id: string) {
  return supabase.from('vehicles').delete().eq('id', id)
}

// ── Routes ──
export async function insertRoute(data: { route_name: string; start_location: string; end_location: string; distance_km: number }) {
  return supabase.from('routes').insert(data).select().single()
}

export async function updateRoute(id: string, data: Partial<{ route_name: string; start_location: string; end_location: string; distance_km: number }>) {
  return supabase.from('routes').update(data).eq('id', id).select().single()
}

export async function deleteRoute(id: string) {
  return supabase.from('routes').delete().eq('id', id)
}

// ── Drivers (profiles) ──
export async function insertDriver(data: { name: string; phone: string }) {
  // Generate a standalone UUID for the driver profile
  const generatedId = crypto.randomUUID();
  
  return supabase.from('profiles').insert({ 
    id: generatedId,
    ...data, 
    role: 'driver' 
  }).select().single()
}

export async function updateDriver(id: string, data: Partial<{ name: string; phone: string }>) {
  return supabase.from('profiles').update(data).eq('id', id).select().single()
}

export async function deleteDriver(id: string) {
  return supabase.from('profiles').delete().eq('id', id)
}

// ── Trips ──
export async function insertTrip(data: { vehicle_id: string; route_id: string; driver_id: string; start_time: string; status: string; direction?: string }) {
  return supabase.from('trips').insert(data).select().single()
}

export async function updateTrip(id: string, data: Partial<{ vehicle_id: string; route_id: string; driver_id: string; start_time: string; end_time: string; status: string; direction: string }>) {
  return supabase.from('trips').update(data).eq('id', id).select().single()
}

export async function deleteTrip(id: string) {
  return supabase.from('trips').delete().eq('id', id)
}

// ── Stops & Route Stops ──
export async function insertStop(data: { stop_name: string; latitude: number; longitude: number }) {
  return supabase.from('stops').insert(data).select().single()
}

export async function updateStop(id: string, data: Partial<{ stop_name: string; latitude: number; longitude: number }>) {
  return supabase.from('stops').update(data).eq('id', id).select().single()
}

export async function insertRouteStop(data: { route_id: string; stop_id: string; stop_order: number }) {
  return supabase.from('route_stops').insert(data).select().single()
}

export async function deleteRouteStop(id: string) {
  return supabase.from('route_stops').delete().eq('id', id)
}

// ── Distances & ETA (OSRM Integration) ──
export async function calculateAndStoreRouteDistances(routeId: string) {
  try {
    // 1. Fetch all route_stops for this route, joined with stops table, ordered by stop_order
    const { data: routeStops, error: fetchError } = await supabase
      .from('route_stops')
      .select(`
        id,
        stop_order,
        distance_from_prev_km,
        avg_travel_time_minutes,
        stops (
          id,
          latitude,
          longitude
        )
      `)
      .eq('route_id', routeId)
      .order('stop_order', { ascending: true })

    if (fetchError) throw fetchError
    if (!routeStops || routeStops.length < 2) return // Need at least 2 stops to calculate distance

    // 2. Loop through consecutive pairs of stops
    for (let i = 1; i < routeStops.length; i++) {
      const prevStop = routeStops[i - 1]
      const currStop = routeStops[i]

      // Optimization: Skip if already calculated
      if (currStop.distance_from_prev_km !== null && currStop.avg_travel_time_minutes !== null) {
        continue
      }

      // Safe access for joined data (handles both single object or array format from Supabase)
      const prevStopData = Array.isArray(prevStop.stops) ? prevStop.stops[0] : prevStop.stops
      const currStopData = Array.isArray(currStop.stops) ? currStop.stops[0] : currStop.stops

      if (!prevStopData || !currStopData) continue

      const lat1 = prevStopData.latitude
      const lng1 = prevStopData.longitude
      const lat2 = currStopData.latitude
      const lng2 = currStopData.longitude

      // 3. Call OSRM API (format: lng,lat)
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`
      
      const response = await fetch(osrmUrl)
      if (!response.ok) {
        console.error('OSRM API Error:', await response.text())
        continue
      }

      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        
        // 4. Parse response
        // OSRM returns distance in meters, duration in seconds
        const distanceKm = Number((route.distance / 1000).toFixed(2))
        const durationMin = Number((route.duration / 60).toFixed(2))

        // 5. Update route_stops
        const { error: updateError } = await supabase
          .from('route_stops')
          .update({
            distance_from_prev_km: distanceKm,
            avg_travel_time_minutes: durationMin
          })
          .eq('id', currStop.id)

        if (updateError) {
          console.error(`Error updating route_stop ${currStop.id}:`, updateError.message)
        }
      }
    }
  } catch (err) {
    console.error('Error in calculateAndStoreRouteDistances:', err)
  }
}
