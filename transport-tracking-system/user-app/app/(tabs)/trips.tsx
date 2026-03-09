import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  SafeAreaView,
} from 'react-native'
import { useAuth } from '../../src/context/AuthContext'
import MapModal from '../../src/components/MapModal'
import type { Trip } from '../../src/types/database'

type TripWithDetails = Trip & {
  buses: { bus_number: string } | null
  routes: { route_name: string; start_location: string; end_location: string } | null
}

type Filter = 'all' | 'running' | 'scheduled'

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: '#f59e0b', bg: '#451a03' },
  running: { label: 'Running', color: '#22c55e', bg: '#052e16' },
  completed: { label: 'Completed', color: '#64748b', bg: '#1e293b' },
}

export default function TripsScreen() {
  const { profile, supabaseClient } = useAuth()
  const [trips, setTrips] = useState<TripWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [bookingIds, setBookingIds] = useState<Set<string>>(new Set())
  const [bookingLoading, setBookingLoading] = useState<string | null>(null)
  const [mapModalVisible, setMapModalVisible] = useState(false)
  const [selectedTripForMap, setSelectedTripForMap] = useState<TripWithDetails | null>(null)

  const fetchTrips = useCallback(async () => {
    if (!supabaseClient) return
    const query = supabaseClient
      .from('trips')
      .select('*, buses(bus_number), routes(route_name, start_location, end_location)')
      .in('status', ['scheduled', 'running'])
      .order('start_time', { ascending: true })

    const { data, error } = await query
    if (!error && data) setTrips(data as TripWithDetails[])
    setLoading(false)
    setRefreshing(false)
  }, [supabaseClient])

  const fetchMyBookings = useCallback(async () => {
    if (!profile || !supabaseClient) return
    const { data } = await supabaseClient
      .from('bookings')
      .select('trip_id')
      .eq('passenger_id', profile.id)
    if (data) setBookingIds(new Set(data.map((b: { trip_id: string }) => b.trip_id)))
  }, [profile, supabaseClient])

  useEffect(() => {
    fetchTrips()
    fetchMyBookings()
  }, [fetchTrips, fetchMyBookings])

  const onRefresh = () => {
    setRefreshing(true)
    fetchTrips()
    fetchMyBookings()
  }

  const handleBook = async (tripId: string) => {
    if (!profile || !supabaseClient) return
    if (bookingIds.has(tripId)) {
      Alert.alert('Already Booked', 'You have already booked this trip.')
      return
    }
    setBookingLoading(tripId)
    const { error } = await supabaseClient.from('bookings').insert({
      passenger_id: profile.id,
      trip_id: tripId,
    })
    setBookingLoading(null)
    if (error) {
      Alert.alert('Booking Failed', error.message)
    } else {
      setBookingIds((prev) => new Set([...prev, tripId]))
      Alert.alert('Booked!', 'Your trip has been booked successfully.')
    }
  }

  const filtered = filter === 'all'
    ? trips
    : trips.filter((t) => t.status === filter)

  const renderTrip = ({ item }: { item: TripWithDetails }) => {
    const cfg = STATUS_CONFIG[item.status]
    const startDate = new Date(item.start_time)
    const dateStr = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const timeStr = startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    const isBooked = bookingIds.has(item.id)
    const isBooking = bookingLoading === item.id
    const isRunning = item.status === 'running'

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.busTag}>
            <Text style={styles.busText}>🚌 {item.buses?.bus_number ?? 'N/A'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <Text style={styles.routeName}>{item.routes?.route_name ?? 'Unknown Route'}</Text>

        <View style={styles.routeFlow}>
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>🟢</Text>
            <Text style={styles.routeLocation} numberOfLines={1}>
              {item.routes?.start_location ?? '—'}
            </Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>🔴</Text>
            <Text style={styles.routeLocation} numberOfLines={1}>
              {item.routes?.end_location ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.tripTime}>{dateStr} • {timeStr}</Text>
          {isRunning && (
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={() => {
                setSelectedTripForMap(item)
                setMapModalVisible(true)
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.locationBtnText}>📍 Track</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionRow}>
          {isBooked ? (
            <View style={styles.bookedBadge}>
              <Text style={styles.bookedText}>✓ Booked</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.bookBtn, isBooking && styles.bookBtnDisabled]}
              onPress={() => handleBook(item.id)}
              disabled={isBooking}
              activeOpacity={0.85}
            >
              {isBooking ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.bookBtnText}>Book →</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Trips</Text>
        <Text style={styles.subtitle}>Find and book your trip</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'running', 'scheduled'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚏</Text>
              <Text style={styles.emptyText}>No trips available.</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh.</Text>
            </View>
          }
        />
      )}

      {selectedTripForMap && (
        <MapModal
          visible={mapModalVisible}
          onClose={() => {
            setMapModalVisible(false)
            setSelectedTripForMap(null)
          }}
          busId={selectedTripForMap.buses?.id ?? ''}
          busNumber={selectedTripForMap.buses?.bus_number ?? 'N/A'}
          routeName={selectedTripForMap.routes?.route_name ?? 'Unknown'}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterTabActive: {
    backgroundColor: '#1e40af',
    borderColor: '#3b82f6',
  },
  filterTabText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#93c5fd' },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  busTag: {
    backgroundColor: '#172554',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  busText: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  routeName: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  routeFlow: { marginBottom: 16, gap: 6 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeIcon: { fontSize: 12 },
  routeLocation: { color: '#94a3b8', fontSize: 14, flex: 1 },
  routeConnector: {
    width: 2,
    height: 10,
    backgroundColor: '#334155',
    marginLeft: 5,
    borderRadius: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripTime: { color: '#475569', fontSize: 12 },
  locationBtn: {
    backgroundColor: '#0369a1',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    marginRight: 8,
  },
  locationBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  bookBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bookedBadge: {
    backgroundColor: '#052e16',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#15803d',
  },
  bookedText: { color: '#22c55e', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#475569', fontSize: 13, marginTop: 4 },
})
