import React, { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, SafeAreaView } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { useAuth } from '../context/AuthContext'
import type { BusLocation } from '../types/database'

interface MapModalProps {
  visible: boolean
  onClose: () => void
  busId: string
  busNumber: string
  routeName: string
}

export default function MapModal({ visible, onClose, busId, busNumber, routeName }: MapModalProps) {
  const { supabaseClient } = useAuth()
  const [busLocation, setBusLocation] = useState<{ lat: number; lng: number; speed: number | null; updatedAt: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const mapRef = useRef<MapView>(null)

  useEffect(() => {
    if (!visible || !supabaseClient || !busId) return

    const fetchAndSubscribe = async () => {
      setLoading(true)
      try {
        // Fetch latest location
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
      } catch (error) {
        console.log('Error fetching location:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAndSubscribe()

    // Subscribe to realtime updates
    const channel = supabaseClient
      .channel(`bus-location-modal-${busId}`)
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
  }, [visible, busId, supabaseClient])

  const speedKmh = busLocation?.speed != null
    ? (busLocation.speed * 3.6).toFixed(1)
    : '—'

  const defaultRegion = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 15,
    longitudeDelta: 15,
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>📍 Bus Location</Text>
            <Text style={styles.subtitle}>{busNumber}</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

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
                title={busNumber}
                description={routeName}
              >
                <View style={styles.busMarker}>
                  <Text style={styles.busMarkerText}>🚌</Text>
                </View>
              </Marker>
            )}
          </MapView>

          {loading && (
            <View style={styles.mapOverlay}>
              <ActivityIndicator color="#3b82f6" size="large" />
              <Text style={styles.mapOverlayText}>Fetching location...</Text>
            </View>
          )}

          {!loading && !busLocation && (
            <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayIcon}>📡</Text>
              <Text style={styles.mapOverlayText}>Waiting for driver to share location...</Text>
            </View>
          )}
        </View>

        {/* Info panel */}
        {busLocation && !loading && (
          <View style={styles.infoPanel}>
            <View style={styles.infoPanelHeader}>
              <Text style={styles.infoPanelRoute}>{routeName}</Text>
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
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerContent: { alignItems: 'center', flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  closeBtn: { fontSize: 24, color: '#94a3b8', fontWeight: '600' },
  mapContainer: { flex: 1, position: 'relative' },
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
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 16,
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
