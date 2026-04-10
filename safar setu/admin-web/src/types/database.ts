/* ────────────────────────────────────────────
   Auto-generated-style types matching the
   Supabase tables described by the user.
   ──────────────────────────────────────────── */

export type Profile = {
  id: string
  name: string | null
  phone: string | null
  role: 'admin' | 'driver' | 'passenger'
  created_at: string
}

export type Vehicle = {
  id: string
  vehicle_number: string
  capacity: number
  driver_id: string | null
  vehicle_type: string | null
  created_at: string
  // joined
  profiles?: Profile
}

export type Bus = Vehicle

export type Route = {
  id: string
  route_name: string
  start_location: string
  end_location: string
  distance_km: number
  route_type: 'Express' | 'Feeder' | 'Airport' | 'Ring' | 'General'
  created_at: string
}

export type Stop = {
  id: string
  stop_name: string
  latitude: number
  longitude: number
}

export type RouteStop = {
  id: string
  route_id: string
  stop_id: string
  stop_order: number
  // joined
  stops?: Stop
}

export type Trip = {
  id: string
  vehicle_id: string
  route_id: string
  driver_id: string
  start_time: string
  end_time: string | null
  status: 'scheduled' | 'running' | 'completed'
  // joined
  vehicles?: Vehicle
  routes?: Route
  profiles?: Profile
}

export type VehicleLocation = {
  id: string
  vehicle_id: string
  latitude: number
  longitude: number
  speed: number | null
  recorded_at: string
}

export type Booking = {
  id: string
  passenger_id: string
  trip_id: string
  created_at: string
}

/* Supabase generic DB helper type (minimal) */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      vehicles: { Row: Vehicle; Insert: Partial<Vehicle>; Update: Partial<Vehicle> }
      routes: { Row: Route; Insert: Partial<Route>; Update: Partial<Route> }
      stops: { Row: Stop; Insert: Partial<Stop>; Update: Partial<Stop> }
      route_stops: { Row: RouteStop; Insert: Partial<RouteStop>; Update: Partial<RouteStop> }
      trips: { Row: Trip; Insert: Partial<Trip>; Update: Partial<Trip> }
      vehicle_locations: { Row: VehicleLocation; Insert: Partial<VehicleLocation>; Update: Partial<VehicleLocation> }
      bookings: { Row: Booking; Insert: Partial<Booking>; Update: Partial<Booking> }
    }
  }
}
