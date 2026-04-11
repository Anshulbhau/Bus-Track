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
