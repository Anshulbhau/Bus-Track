import { supabase } from '../lib/supabase'

/* ═══════════════════════════════════════
   Mutation helpers – insert / update / delete
   ═══════════════════════════════════════ */

// ── Buses ──
export async function insertBus(data: { bus_number: string; capacity: number; driver_id?: string | null }) {
  return supabase.from('buses').insert(data).select().single()
}

export async function updateBus(id: string, data: Partial<{ bus_number: string; capacity: number; driver_id: string | null }>) {
  return supabase.from('buses').update(data).eq('id', id).select().single()
}

export async function deleteBus(id: string) {
  return supabase.from('buses').delete().eq('id', id)
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
  return supabase.from('profiles').insert({ ...data, role: 'driver' }).select().single()
}

export async function updateDriver(id: string, data: Partial<{ name: string; phone: string }>) {
  return supabase.from('profiles').update(data).eq('id', id).select().single()
}

export async function deleteDriver(id: string) {
  return supabase.from('profiles').delete().eq('id', id)
}

// ── Trips ──
export async function insertTrip(data: { bus_id: string; route_id: string; driver_id: string; start_time: string; status: string }) {
  return supabase.from('trips').insert(data).select().single()
}

export async function updateTrip(id: string, data: Partial<{ bus_id: string; route_id: string; driver_id: string; start_time: string; end_time: string; status: string }>) {
  return supabase.from('trips').update(data).eq('id', id).select().single()
}

export async function deleteTrip(id: string) {
  return supabase.from('trips').delete().eq('id', id)
}
