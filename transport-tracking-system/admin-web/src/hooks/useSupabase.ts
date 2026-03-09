import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Bus, Route, Trip, Profile, Stop } from '../types/database'

/* ── Generic fetch hook ── */
function useQuery<T>(
  fetcher: () => PromiseLike<{ data: T[] | null; error: any }>,
  deps: any[] = []
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await fetcher()
    if (error) setError(error.message)
    else setData(data ?? [])
    setLoading(false)
  }, deps)

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

/* ── Buses ── */
export function useBuses() {
  return useQuery<Bus & { profiles: Profile | null }>(() =>
    supabase
      .from('buses')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false })
  )
}

/* ── Routes ── */
export function useRoutes() {
  return useQuery<Route>(() =>
    supabase
      .from('routes')
      .select('*')
      .order('route_name', { ascending: true })
  )
}

/* ── Trips (with joins) ── */
export function useTrips() {
  return useQuery<Trip & { buses: Bus | null; routes: Route | null; profiles: Profile | null }>(
    () =>
      supabase
        .from('trips')
        .select('*, buses(*), routes(*), profiles(*)')
        .order('start_time', { ascending: false })
  )
}

/* ── Drivers (profiles with role = driver) ── */
export function useDrivers() {
  return useQuery<Profile>(() =>
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
      .order('name', { ascending: true })
  )
}

/* ── Stops ── */
export function useStops() {
  return useQuery<Stop>(() =>
    supabase
      .from('stops')
      .select('*')
      .order('stop_name', { ascending: true })
  )
}

/* ── Dashboard aggregate counts ── */
export function useDashboardStats() {
  const [stats, setStats] = useState({
    totalBuses: 0,
    activeTrips: 0,
    totalRoutes: 0,
    driversOnline: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [busRes, tripRes, routeRes, driverRes] = await Promise.all([
        supabase.from('buses').select('id', { count: 'exact', head: true }),
        supabase.from('trips').select('id', { count: 'exact', head: true }).eq('status', 'running'),
        supabase.from('routes').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'driver'),
      ])
      setStats({
        totalBuses: busRes.count ?? 0,
        activeTrips: tripRes.count ?? 0,
        totalRoutes: routeRes.count ?? 0,
        driversOnline: driverRes.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  return { stats, loading }
}
