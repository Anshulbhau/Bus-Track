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
  direction: 'onward' | 'backward'
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

export type DriverRatingStats = {
  driver_id: string
  average_rating: number
  total_reviews: number
  smooth_driving_count: number
  rash_driving_count: number
  sudden_braking_count: number
  overspeeding_count: number
  polite_behavior_count: number
  clean_bus_count: number
  safety_score: number
  updated_at: string
}

export type DriverReview = {
  id: string
  driver_id: string
  user_id: string
  trip_id: string
  vehicle_id: string
  rating: number
  review_text: string | null
  smooth_driving: boolean
  rash_driving: boolean
  sudden_braking: boolean
  overspeeding: boolean
  polite_behavior: boolean
  clean_bus: boolean
  is_deleted: boolean
  is_flagged: boolean
  created_at: string
  updated_at: string
  // joined fields
  reviewer?: Profile
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
      driver_rating_stats: { Row: DriverRatingStats; Insert: Partial<DriverRatingStats>; Update: Partial<DriverRatingStats> }
      driver_reviews: { Row: DriverReview; Insert: Partial<DriverReview>; Update: Partial<DriverReview> }
    }
  }
}
