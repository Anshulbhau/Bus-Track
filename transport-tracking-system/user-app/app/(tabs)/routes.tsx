import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  SafeAreaView,
} from 'react-native'
import { useAuth } from '../../src/context/AuthContext'
import type { Route } from '../../src/types/database'

export default function RoutesScreen() {
  const { supabaseClient } = useAuth()
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRoutes = useCallback(async () => {
    if (!supabaseClient) return
    const { data, error } = await supabaseClient
      .from('routes')
      .select('*')
      .order('route_name', { ascending: true })

    if (!error && data) setRoutes(data as Route[])
    setLoading(false)
    setRefreshing(false)
  }, [supabaseClient])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  const onRefresh = () => {
    setRefreshing(true)
    fetchRoutes()
  }

  const renderRoute = ({ item }: { item: Route }) => (
    <View style={styles.card}>
      <Text style={styles.routeName}>{item.route_name}</Text>
      <View style={styles.routeFlow}>
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>🟢</Text>
          <Text style={styles.routeLocation} numberOfLines={1}>
            {item.start_location}
          </Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>🔴</Text>
          <Text style={styles.routeLocation} numberOfLines={1}>
            {item.end_location}
          </Text>
        </View>
      </View>
      <View style={styles.distancePill}>
        <Text style={styles.distanceText}>📏 {item.distance_km} km</Text>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Bus Routes</Text>
        <Text style={styles.subtitle}>{routes.length} routes available</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          renderItem={renderRoute}
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
              <Text style={styles.emptyIcon}>🗺</Text>
              <Text style={styles.emptyText}>No routes available yet.</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh.</Text>
            </View>
          }
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
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
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
  routeName: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  routeFlow: { marginBottom: 14, gap: 6 },
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
  distancePill: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  distanceText: { color: '#94a3b8', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#475569', fontSize: 13, marginTop: 4 },
})
