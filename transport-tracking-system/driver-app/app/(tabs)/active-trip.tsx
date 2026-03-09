import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import * as Location from 'expo-location'
import { useAuth } from '../../src/context/AuthContext'
import type { Trip } from '../../src/types/database'

type ActiveTrip = Trip & {
  buses: { id: string; bus_number: string } | null
  routes: {
    route_name: string
    start_location: string
    end_location: string
    distance_km: number
  } | null
}

export default function ActiveTripScreen() {
  const { profile, supabaseClient } = useAuth()
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null)
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number
    lng: number
    speed: number | null
  } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const locationSubRef = useRef<Location.LocationSubscription | null>(null)

  const fetchActiveTrip = useCallback(async () => {
    if (!profile || !supabaseClient) return
    const { data, error } = await supabaseClient
      .from('trips')
      .select('*, buses(id, bus_number), routes(route_name, start_location, end_location, distance_km)')
      .eq('driver_id', profile.id)
      .eq('status', 'running')
      .single()

    if (!error && data) {
      setActiveTrip(data as ActiveTrip)
    } else {
      setActiveTrip(null)
    }
    setLoading(false)
  }, [profile, supabaseClient])

  useEffect(() => {
    fetchActiveTrip()
    if (!supabaseClient) return

    // Subscribe to realtime changes on trips table
    const channel = supabaseClient
      .channel('active-trip-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips' },
        () => fetchActiveTrip()
      )
      .subscribe()

    return () => {
      supabaseClient.removeChannel(channel)
    }
  }, [fetchActiveTrip, supabaseClient])

  // Start live location tracking
  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      setLocationError('Location permission denied. Please enable it in Settings.')
      return
    }

    setTracking(true)
    setLocationError(null)

    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,    // every 5 seconds
        distanceInterval: 10,  // or every 10 meters
      },
      async (loc) => {
        const { latitude, longitude, speed } = loc.coords
        setCurrentLocation({ lat: latitude, lng: longitude, speed: speed ?? null })

        if (activeTrip?.buses?.id && supabaseClient) {
          await supabaseClient.from('bus_locations').insert({
            bus_id: activeTrip.buses.id,
            latitude,
            longitude,
            speed: speed ?? null,
            recorded_at: new Date().toISOString(),
          })
        }
      }
    )
  }

  const stopTracking = () => {
    locationSubRef.current?.remove()
    locationSubRef.current = null
    setTracking(false)
    setCurrentLocation(null)
  }

  const handleEndTrip = () => {
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: async () => {
            stopTracking()
            if (!supabaseClient) return
            const { error } = await supabaseClient
              .from('trips')
              .update({
                status: 'completed',
                end_time: new Date().toISOString(),
              })
              .eq('id', activeTrip!.id)
            if (error) Alert.alert('Error', error.message)
            else fetchActiveTrip()
          },
        },
      ]
    )
  }

  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 100 }} />
      </SafeAreaView>
    )
  }

  if (!activeTrip) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.noTripContainer}>
          <Text style={styles.noTripIcon}>🚏</Text>
          <Text style={styles.noTripTitle}>No Active Trip</Text>
          <Text style={styles.noTripSubtext}>
            Start a trip from the My Trips tab to begin tracking.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const speedKmh =
    currentLocation?.speed != null
      ? (currentLocation.speed * 3.6).toFixed(1)
      : '—'

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>ACTIVE TRIP</Text>
            <Text style={styles.headerRoute}>{activeTrip.routes?.route_name}</Text>
          </View>
          <View style={styles.liveIndicator}>
            {tracking && <View style={styles.liveDot} />}
            <Text style={[styles.liveText, { color: tracking ? '#22c55e' : '#475569' }]}>
              {tracking ? 'LIVE' : 'IDLE'}
            </Text>
          </View>
        </View>

        {/* Bus Card */}
        <View style={styles.busCard}>
          <Text style={styles.busLabel}>🚌 Bus</Text>
          <Text style={styles.busNumber}>{activeTrip.buses?.bus_number ?? 'N/A'}</Text>
        </View>

        {/* Route Details */}
        <View style={styles.routeCard}>
          <Text style={styles.cardTitle}>Route Details</Text>
          <View style={styles.routeRow}>
            <Text style={styles.routeIcon}>🟢</Text>
            <View style={styles.routeTextBlock}>
              <Text style={styles.routePointLabel}>FROM</Text>
              <Text style={styles.routePointValue}>{activeTrip.routes?.start_location}</Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <Text style={styles.routeIcon}>🔴</Text>
            <View style={styles.routeTextBlock}>
              <Text style={styles.routePointLabel}>TO</Text>
              <Text style={styles.routePointValue}>{activeTrip.routes?.end_location}</Text>
            </View>
          </View>
          <View style={styles.distancePill}>
            <Text style={styles.distanceText}>
              📏 {activeTrip.routes?.distance_km ?? 0} km total
            </Text>
          </View>
        </View>

        {/* Location Display */}
        {currentLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.cardTitle}>Current Position</Text>
            <View style={styles.locationGrid}>
              <View style={styles.locationStat}>
                <Text style={styles.locationStatValue}>
                  {currentLocation.lat.toFixed(5)}°
                </Text>
                <Text style={styles.locationStatLabel}>Latitude</Text>
              </View>
              <View style={styles.locationDivider} />
              <View style={styles.locationStat}>
                <Text style={styles.locationStatValue}>
                  {currentLocation.lng.toFixed(5)}°
                </Text>
                <Text style={styles.locationStatLabel}>Longitude</Text>
              </View>
              <View style={styles.locationDivider} />
              <View style={styles.locationStat}>
                <Text style={styles.locationStatValue}>{speedKmh}</Text>
                <Text style={styles.locationStatLabel}>km/h</Text>
              </View>
            </View>
          </View>
        )}

        {locationError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {locationError}</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {!tracking ? (
            <TouchableOpacity style={styles.trackBtn} onPress={startTracking} activeOpacity={0.85}>
              <Text style={styles.trackBtnText}>📍 Start Location Sharing</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopTrackBtn} onPress={stopTracking} activeOpacity={0.85}>
              <Text style={styles.stopTrackBtnText}>⏸ Pause Location Sharing</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.endBtn} onPress={handleEndTrip} activeOpacity={0.85}>
            <Text style={styles.endBtnText}>🏁 End Trip</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 1.5,
  },
  headerRoute: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', marginTop: 4 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  liveText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  busCard: {
    backgroundColor: '#172554',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  busLabel: { color: '#93c5fd', fontSize: 14 },
  busNumber: { color: '#dbeafe', fontSize: 22, fontWeight: '800' },
  routeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeIcon: { fontSize: 12 },
  routeTextBlock: {},
  routePointLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  routePointValue: { color: '#e2e8f0', fontSize: 15, fontWeight: '600', marginTop: 2 },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#334155',
    marginLeft: 5,
    marginVertical: 6,
    borderRadius: 2,
  },
  distancePill: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  distanceText: { color: '#94a3b8', fontSize: 13 },
  locationCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationStat: { flex: 1, alignItems: 'center' },
  locationStatValue: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  locationStatLabel: { color: '#475569', fontSize: 11, marginTop: 4 },
  locationDivider: { width: 1, height: 36, backgroundColor: '#334155' },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  errorText: { color: '#fca5a5', fontSize: 13 },
  controls: { gap: 12, marginTop: 8 },
  trackBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stopTrackBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stopTrackBtnText: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  endBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  endBtnText: { color: '#fca5a5', fontSize: 16, fontWeight: '700' },
  noTripContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noTripIcon: { fontSize: 64, marginBottom: 16 },
  noTripTitle: { color: '#94a3b8', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  noTripSubtext: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
})
