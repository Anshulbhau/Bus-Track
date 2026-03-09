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
import type { Booking } from '../../src/types/database'

type BookingWithDetails = Booking & {
  trips: {
    id: string
    status: 'scheduled' | 'running' | 'completed'
    start_time: string
    end_time: string | null
    buses: { bus_number: string } | null
    routes: { route_name: string; start_location: string; end_location: string } | null
  } | null
}

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: '#f59e0b', bg: '#451a03' },
  running: { label: 'Running', color: '#22c55e', bg: '#052e16' },
  completed: { label: 'Completed', color: '#64748b', bg: '#1e293b' },
}

export default function BookingsScreen() {
  const { profile, supabaseClient } = useAuth()
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    if (!profile || !supabaseClient) return
    const { data, error } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        trips (
          id,
          status,
          start_time,
          end_time,
          buses ( bus_number ),
          routes ( route_name, start_location, end_location )
        )
      `)
      .eq('passenger_id', profile.id)
      .order('created_at', { ascending: false })

    if (!error && data) setBookings(data as BookingWithDetails[])
    setLoading(false)
    setRefreshing(false)
  }, [profile, supabaseClient])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const onRefresh = () => {
    setRefreshing(true)
    fetchBookings()
  }

  const handleCancel = (bookingId: string, tripStatus: string) => {
    if (tripStatus !== 'scheduled') {
      Alert.alert('Cannot Cancel', 'Only scheduled trips can be cancelled.')
      return
    }
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            if (!supabaseClient) return
            setCancellingId(bookingId)
            const { error } = await supabaseClient
              .from('bookings')
              .delete()
              .eq('id', bookingId)
            setCancellingId(null)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setBookings((prev) => prev.filter((b) => b.id !== bookingId))
            }
          },
        },
      ]
    )
  }

  const renderBooking = ({ item }: { item: BookingWithDetails }) => {
    const trip = item.trips
    if (!trip) return null

    const cfg = STATUS_CONFIG[trip.status]
    const startDate = new Date(trip.start_time)
    const dateStr = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const timeStr = startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    const bookedOn = new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const isCancelling = cancellingId === item.id

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.busTag}>
            <Text style={styles.busText}>🚌 {trip.buses?.bus_number ?? 'N/A'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <Text style={styles.routeName}>{trip.routes?.route_name ?? 'Unknown Route'}</Text>

        <View style={styles.routeFlow}>
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>🟢</Text>
            <Text style={styles.routeLocation} numberOfLines={1}>
              {trip.routes?.start_location ?? '—'}
            </Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>🔴</Text>
            <Text style={styles.routeLocation} numberOfLines={1}>
              {trip.routes?.end_location ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaText}>Trip: {dateStr} • {timeStr}</Text>
          <Text style={styles.metaText}>Booked on: {bookedOn}</Text>
        </View>

        {trip.status === 'scheduled' && (
          <TouchableOpacity
            style={[styles.cancelBtn, isCancelling && styles.cancelBtnDisabled]}
            onPress={() => handleCancel(item.id, trip.status)}
            disabled={isCancelling}
            activeOpacity={0.85}
          >
            {isCancelling ? (
              <ActivityIndicator color="#fca5a5" size="small" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Booking</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
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
              <Text style={styles.emptyIcon}>🎟</Text>
              <Text style={styles.emptyText}>No bookings yet.</Text>
              <Text style={styles.emptySubtext}>Book a trip from the Trips tab.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
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
  routeFlow: { marginBottom: 12, gap: 6 },
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
  meta: { gap: 2, marginBottom: 14 },
  metaText: { color: '#475569', fontSize: 12 },
  cancelBtn: {
    backgroundColor: '#450a0a',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  cancelBtnDisabled: { opacity: 0.6 },
  cancelBtnText: { color: '#fca5a5', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#475569', fontSize: 13, marginTop: 4 },
})
