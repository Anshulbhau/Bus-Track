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
async function snapCoordinatesToRoad(lat: number, lng: number): Promise<{ latitude: number, longitude: number }> {
  try {
    const osrmUrl = `http://router.project-osrm.org/nearest/v1/driving/${lng},${lat}`;
    const response = await fetch(osrmUrl);
    if (!response.ok) {
      console.warn(`OSRM Nearest API failed for ${lat},${lng}:`, await response.text());
      return { latitude: lat, longitude: lng }; // Fallback
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
      const snappedLng = data.waypoints[0].location[0];
      const snappedLat = data.waypoints[0].location[1];
      console.log(`✅ Snapped coordinates: (${lat}, ${lng}) -> (${snappedLat}, ${snappedLng})`);
      return { latitude: snappedLat, longitude: snappedLng };
    }
    
    console.warn(`OSRM Nearest API returned no waypoints for ${lat},${lng}. Using original coordinates.`);
    return { latitude: lat, longitude: lng }; // Fallback
  } catch (error) {
    console.error('Error in snapCoordinatesToRoad:', error);
    return { latitude: lat, longitude: lng }; // Fallback
  }
}

export async function insertStop(data: { stop_name: string; latitude: number; longitude: number }) {
  const snappedCoords = await snapCoordinatesToRoad(data.latitude, data.longitude);
  const finalData = { ...data, ...snappedCoords };
  return supabase.from('stops').insert(finalData).select().single()
}

export async function updateStop(id: string, data: Partial<{ stop_name: string; latitude: number; longitude: number }>) {
  const finalData = { ...data };
  
  if (data.latitude !== undefined && data.longitude !== undefined) {
    const snappedCoords = await snapCoordinatesToRoad(data.latitude, data.longitude);
    finalData.latitude = snappedCoords.latitude;
    finalData.longitude = snappedCoords.longitude;
  } else if (data.latitude !== undefined || data.longitude !== undefined) {
    // If only one coordinate is provided, fetch the other from DB to snap properly
    const { data: existingStop } = await supabase.from('stops').select('latitude, longitude').eq('id', id).single();
    if (existingStop) {
      const latToSnap = data.latitude !== undefined ? data.latitude : existingStop.latitude;
      const lngToSnap = data.longitude !== undefined ? data.longitude : existingStop.longitude;
      const snappedCoords = await snapCoordinatesToRoad(latToSnap, lngToSnap);
      finalData.latitude = snappedCoords.latitude;
      finalData.longitude = snappedCoords.longitude;
    }
  }

  return supabase.from('stops').update(finalData).eq('id', id).select().single()
}

export async function insertRouteStop(data: { route_id: string; stop_id: string; stop_order: number }) {
  return supabase.from('route_stops').insert(data).select().single()
}

export async function deleteRouteStop(id: string) {
  return supabase.from('route_stops').delete().eq('id', id)
}

// ── Distances & ETA (OSRM Integration) ──
export async function calculateAndStoreRouteDistances(routeId: string, force = false) {
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
    
    // Handle case where route has less than 2 stops: distance is 0
    if (!routeStops || routeStops.length < 2) {
      await supabase.from('routes').update({ distance_km: 0 }).eq('id', routeId)
      return
    }

    // Optimization: If force = false, check if we can skip
    if (!force) {
      let allCalculated = true
      for (let i = 1; i < routeStops.length; i++) {
        if (routeStops[i].distance_from_prev_km === null) {
          allCalculated = false
          break
        }
      }
      if (allCalculated) return
    }

    // Extract valid stops and coordinates
    const validStops = []
    const coordinates: string[] = []
    
    for (const stop of routeStops) {
      const stopData = Array.isArray(stop.stops) ? stop.stops[0] : stop.stops
      if (stopData && stopData.longitude !== undefined && stopData.latitude !== undefined) {
        coordinates.push(`${stopData.longitude},${stopData.latitude}`)
        validStops.push(stop)
      }
    }

    if (validStops.length < 2) return

    // 2. Call OSRM API using ALL stops in ONE request
    const coordsString = coordinates.join(';')
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`
    
    const response = await fetch(osrmUrl)
    if (!response.ok) {
      console.error(`OSRM API Error for route ${routeId}:`, await response.text())
      return
    }

    const data = await response.json()
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      
      // 3. Update routes table with total route distance
      const totalDistanceKm = Number((route.distance / 1000).toFixed(2))
      const { error: routeUpdateError } = await supabase
        .from('routes')
        .update({ distance_km: totalDistanceKm })
        .eq('id', routeId)

      if (routeUpdateError) {
        console.error(`Error updating total distance for route ${routeId}:`, routeUpdateError.message)
      }

      // 4. Extract legs and update route_stops for each segment
      const legs = route.legs
      if (legs && legs.length === validStops.length - 1) {
        for (let i = 0; i < legs.length; i++) {
          const leg = legs[i]
          const currStop = validStops[i + 1] // legs[i] corresponds to stop[i] -> stop[i+1]

          const segmentDistanceKm = Number((leg.distance / 1000).toFixed(2))
          const segmentDurationMin = Number((leg.duration / 60).toFixed(2))

          const { error: updateError } = await supabase
            .from('route_stops')
            .update({
              distance_from_prev_km: segmentDistanceKm,
              avg_travel_time_minutes: segmentDurationMin
            })
            .eq('id', currStop.id)

          if (updateError) {
            console.error(`Error updating route_stop ${currStop.id}:`, updateError.message)
          }
        }
      } else {
        console.warn(`Mismatch between OSRM legs (${legs?.length}) and stops count (${validStops.length}) for route ${routeId}`)
      }
    }
  } catch (err) {
    console.error('Error in calculateAndStoreRouteDistances:', err)
  }
}

/**
 * Fetches all unique route_ids from route_stops and recalculates 
 * their distances using OSRM, overwriting existing values.
 */
export async function recalculateAllRouteDistances() {
  console.log('🚀 Starting recalculation of all route distances...')
  
  try {
    // Fetch all unique route_ids from route_stops
    const { data, error } = await supabase
      .from('route_stops')
      .select('route_id')

    if (error) throw error
    if (!data) return

    // Get unique route IDs
    const routeIds = Array.from(new Set(data.map(item => item.route_id)))
    console.log(`📌 Found ${routeIds.length} routes to process.`)

    for (const routeId of routeIds) {
      console.log(`⏳ Processing route ID: ${routeId}...`)
      await calculateAndStoreRouteDistances(routeId, true)
      console.log(`✅ Completed route ID: ${routeId}`)
    }

    console.log('🏁 All route distances have been recalculated successfully!')
  } catch (err) {
    console.error('❌ Error in recalculateAllRouteDistances:', err)
    throw err
  }
}
