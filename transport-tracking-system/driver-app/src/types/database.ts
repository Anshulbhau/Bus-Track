export type Profile = {
  id: string
  name: string | null
  phone: string | null
  role: 'admin' | 'driver' | 'passenger'
  created_at: string
}

export type Bus = {
  id: string
  bus_number: string
  capacity: number
  driver_id: string | null
  created_at: string
  profiles?: Profile
}

export type Route = {
  id: string
  route_name: string
  start_location: string
  end_location: string
  distance_km: number
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
  stops?: Stop
}

export type Trip = {
  id: string
  bus_id: string
  route_id: string
  driver_id: string
  start_time: string
  end_time: string | null
  status: 'scheduled' | 'running' | 'completed'
  buses?: Bus
  routes?: Route
  profiles?: Profile
}

export type BusLocation = {
  id: string
  bus_id: string
  latitude: number
  longitude: number
  speed: number | null
  recorded_at: string
}
