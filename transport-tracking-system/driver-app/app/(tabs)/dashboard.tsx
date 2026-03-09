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
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'
import type { Trip } from '../../src/types/database'

type TripWithDetails = Trip & {
  buses: { bus_number: string } | null
  routes: { route_name: string; start_location: string; end_location: string } | null
}

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: '#f59e0b', bg: '#451a03' },
  running: { label: 'Running', color: '#22c55e', bg: '#052e16' },
  completed: { label: 'Completed', color: '#64748b', bg: '#1e293b' },
}

export default function DashboardScreen() {
  const { profile, signOut, supabaseClient } = useAuth()
  const router = useRouter()
  const [trips, setTrips] = useState<TripWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTrips = useCallback(async () => {
    if (!profile || !supabaseClient) return
    const { data, error } = await supabaseClient
      .from('trips')
      .select('*, buses(bus_number), routes(route_name, start_location, end_location)')
      .eq('driver_id', profile.id)
      .order('start_time', { ascending: false })
      .limit(20)

    if (!error && data) setTrips(data as TripWithDetails[])
    setLoading(false)
    setRefreshing(false)
  }, [profile, supabaseClient])

  useEffect(() => {
    fetchTrips()
  }, [fetchTrips])

  const onRefresh = () => {
    setRefreshing(true)
    fetchTrips()
  }

  const handleStartTrip = async (trip: TripWithDetails) => {
    Alert.alert(
      'Start Trip',
      `Start trip on route "${trip.routes?.route_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          style: 'default',
          onPress: async () => {
            if (!supabaseClient) return
            const { error } = await supabaseClient
              .from('trips')
              .update({ status: 'running', start_time: new Date().toISOString() })
              .eq('id', trip.id)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              fetchTrips()
              router.push('/(tabs)/active-trip')
            }
          },
        },
      ]
    )
  }

  const renderTrip = ({ item }: { item: TripWithDetails }) => {
    const cfg = STATUS_CONFIG[item.status]
    const startDate = new Date(item.start_time)
    const dateStr = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const timeStr = startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

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
          <Text style={styles.tripTime}>
            {dateStr} • {timeStr}
          </Text>
          {item.status === 'scheduled' && (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => handleStartTrip(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnText}>Start Trip ▶</Text>
            </TouchableOpacity>
          )}
          {item.status === 'running' && (
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => router.push('/(tabs)/active-trip')}
              activeOpacity={0.85}
            >
              <Text style={styles.trackBtnText}>Track →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
          <Text style={styles.driverName}>{profile?.name ?? 'Driver'}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats pill */}
      <View style={styles.statRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{trips.filter(t => t.status === 'running').length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{trips.filter(t => t.status === 'scheduled').length}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{trips.filter(t => t.status === 'completed').length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Trips</Text>

      {loading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={item => item.id}
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
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No trips assigned yet.</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  greeting: { fontSize: 14, color: '#64748b' },
  driverName: { fontSize: 24, fontWeight: '800', color: '#f1f5f9' },
  logoutBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: { fontSize: 28, fontWeight: '800', color: '#3b82f6' },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  sectionTitle: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
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
  routeName: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
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
  startBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  trackBtn: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  trackBtnText: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#475569', fontSize: 13, marginTop: 4 },
})
