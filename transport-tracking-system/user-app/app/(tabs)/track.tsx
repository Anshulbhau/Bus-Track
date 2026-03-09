import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Platform,
  RefreshControl,
} from 'react-native'
import MapView, { Marker, Region } from 'react-native-maps'
import { useAuth } from '../../src/context/AuthContext'
import type { Trip, BusLocation } from '../../src/types/database'

type RunningTrip = Trip & {
  buses: { id: string; bus_number: string } | null
  routes: { route_name: string; start_location: string; end_location: string } | null
}

export default function TrackScreen() {
  const { supabaseClient } = useAuth()
  const [runningTrips, setRunningTrips] = useState<RunningTrip[]>([])
  const [selectedTrip, setSelectedTrip] = useState<RunningTrip | null>(null)
  const [busLocation, setBusLocation] = useState<{ lat: number; lng: number; speed: number | null; updatedAt: string } | null>(null)
  const [tripsLoading, setTripsLoading] = useState(true)
  const [locationLoading, setLocationLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const mapRef = useRef<MapView>(null)

  const fetchRunningTrips = useCallback(async () => {
    if (!supabaseClient) return
    const { data } = await supabaseClient
      .from('trips')
      .select('*, buses(id, bus_number), routes(route_name, start_location, end_location)')
      .eq('status', 'running')
    if (data) setRunningTrips(data as RunningTrip[])
    setTripsLoading(false)
    setRefreshing(false)
  }, [supabaseClient])

  const refreshLocation = useCallback(async () => {
    if (!selectedTrip || !supabaseClient) return
    const busId = selectedTrip.buses?.id
    if (!busId) return

    setLocationLoading(true)
    try {
      const { data } = await supabaseClient
        .from('bus_locations')
        .select('*')
        .eq('bus_id', busId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        const loc = data as BusLocation
        setBusLocation({ lat: loc.latitude, lng: loc.longitude, speed: loc.speed, updatedAt: loc.recorded_at })
        mapRef.current?.animateToRegion({
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 800)
      }
    } finally {
      setLocationLoading(false)
    }
  }, [selectedTrip, supabaseClient])

  useEffect(() => {
    fetchRunningTrips()
  }, [fetchRunningTrips])

  // When a trip is selected, fetch the latest location and subscribe to realtime
  useEffect(() => {
    if (!selectedTrip || !supabaseClient) return
    const busId = selectedTrip.buses?.id
    if (!busId) return

    setLocationLoading(true)
    setBusLocation(null)

    // Fetch latest location
    supabaseClient
      .from('bus_locations')
      .select('*')
      .eq('bus_id', busId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          const loc = data as BusLocation
          setBusLocation({ lat: loc.latitude, lng: loc.longitude, speed: loc.speed, updatedAt: loc.recorded_at })
          mapRef.current?.animateToRegion({
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 800)
        }
        setLocationLoading(false)
      })

    // Realtime subscription
    const channel = supabaseClient
      .channel(`bus-location-${busId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bus_locations',
          filter: `bus_id=eq.${busId}`,
        },
        (payload) => {
          const loc = payload.new as BusLocation
          setBusLocation({ lat: loc.latitude, lng: loc.longitude, speed: loc.speed, updatedAt: loc.recorded_at })
          mapRef.current?.animateToRegion({
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 800)
        }
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [selectedTrip, supabaseClient])

  const defaultRegion: Region = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 15,
    longitudeDelta: 15,
  }

  const speedKmh = busLocation?.speed != null
    ? (busLocation.speed * 3.6).toFixed(1)
    : '—'

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live Tracking</Text>
          <Text style={styles.subtitle}>Real-time bus locations</Text>
        </View>
        {selectedTrip && (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={refreshLocation}
            disabled={locationLoading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {locationLoading ? (
              <ActivityIndicator color="#3b82f6" size="small" />
            ) : (
              <Text style={styles.refreshIcon}>🔄</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Trip selector */}
      {tripsLoading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
      ) : runningTrips.length === 0 ? (
        <View style={styles.noTripsBox}>
          <Text style={styles.noTripsText}>🚏 No buses are currently running.</Text>
          <TouchableOpacity
            style={styles.refreshGroupBtn}
            onPress={fetchRunningTrips}
            activeOpacity={0.7}
          >
            <Text style={styles.refreshGroupBtnText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorRow}
          scrollEventThrottle={16}
        >
          {runningTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={[
                styles.tripChip,
                selectedTrip?.id === trip.id && styles.tripChipActive,
              ]}
              onPress={() => setSelectedTrip(trip)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tripChipBus, selectedTrip?.id === trip.id && styles.tripChipBusActive]}>
                🚌 {trip.buses?.bus_number ?? 'N/A'}
              </Text>
              <Text style={[styles.tripChipRoute, selectedTrip?.id === trip.id && styles.tripChipRouteActive]} numberOfLines={1}>
                {trip.routes?.route_name ?? 'Unknown'}
              </Text>
              {selectedTrip?.id === trip.id && <View style={styles.tripChipDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={defaultRegion}
          userInterfaceStyle="dark"
        >
          {busLocation && (
            <Marker
              coordinate={{ latitude: busLocation.lat, longitude: busLocation.lng }}
              title={selectedTrip?.buses?.bus_number ?? 'Bus'}
              description={selectedTrip?.routes?.route_name}
            >
              <View style={styles.busMarker}>
                <Text style={styles.busMarkerText}>🚌</Text>
              </View>
            </Marker>
          )}
        </MapView>

        {selectedTrip && locationLoading && (
          <View style={styles.mapOverlay}>
            <ActivityIndicator color="#3b82f6" size="large" />
            <Text style={styles.mapOverlayText}>Fetching bus location...</Text>
          </View>
        )}

        {selectedTrip && !locationLoading && !busLocation && (
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayIcon}>📡</Text>
            <Text style={styles.mapOverlayText}>Waiting for driver to start location sharing...</Text>
          </View>
        )}

        {!selectedTrip && (
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayIcon}>👆</Text>
            <Text style={styles.mapOverlayText}>Select a trip above to see the bus on the map</Text>
          </View>
        )}
      </View>

      {/* Info panel */}
      {selectedTrip && busLocation && (
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelHeader}>
            <Text style={styles.infoPanelRoute}>{selectedTrip.routes?.route_name}</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoStat}>
              <Text style={styles.infoStatValue}>{busLocation.lat.toFixed(4)}°</Text>
              <Text style={styles.infoStatLabel}>Latitude</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoStat}>
              <Text style={styles.infoStatValue}>{busLocation.lng.toFixed(4)}°</Text>
              <Text style={styles.infoStatLabel}>Longitude</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoStat}>
              <Text style={styles.infoStatValue}>{speedKmh}</Text>
              <Text style={styles.infoStatLabel}>km/h</Text>
            </View>
          </View>
          <Text style={styles.updatedAt}>Last updated: {formatTime(busLocation.updatedAt)}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: { fontSize: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  noTripsBox: {
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    gap: 12,
  },
  noTripsText: { color: '#64748b', fontSize: 14 },
  refreshGroupBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshGroupBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  selectorRow: { paddingHorizontal: 20, paddingVertical: 8, gap: 10 },
  tripChip: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 120,
  },
  tripChipActive: {
    backgroundColor: '#172554',
    borderColor: '#3b82f6',
  },
  tripChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginTop: 8,
    alignSelf: 'center',
  },
  tripChipBus: { color: '#94a3b8', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  tripChipBusActive: { color: '#93c5fd' },
  tripChipRoute: { color: '#64748b', fontSize: 12 },
  tripChipRouteActive: { color: '#60a5fa' },
  mapContainer: { flex: 1, margin: 16, marginTop: 8, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  mapOverlayIcon: { fontSize: 40, marginBottom: 12 },
  mapOverlayText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  busMarker: {
    backgroundColor: '#1e40af',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  busMarkerText: { fontSize: 20 },
  infoPanel: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoPanelRoute: { color: '#f1f5f9', fontWeight: '700', fontSize: 16, flex: 1 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#052e16',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  liveText: { color: '#22c55e', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoStat: { flex: 1, alignItems: 'center' },
  infoStatValue: { color: '#3b82f6', fontSize: 14, fontWeight: '700' },
  infoStatLabel: { color: '#475569', fontSize: 11, marginTop: 2 },
  infoDivider: { width: 1, height: 30, backgroundColor: '#334155' },
  updatedAt: { color: '#475569', fontSize: 11, textAlign: 'center' },
})
