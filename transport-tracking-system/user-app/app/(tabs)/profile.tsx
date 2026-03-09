import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import { useAuth } from '../../src/context/AuthContext'

export default function ProfileScreen() {
  const { profile, signOut } = useAuth()

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    )
  }

  const initial = profile?.name
    ? profile.name.charAt(0).toUpperCase()
    : profile?.phone?.slice(-1) ?? '?'

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile?.name ?? 'Passenger'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Passenger</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>{profile?.phone ?? '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Role</Text>
            <Text style={styles.rowValue}>Passenger</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Member Since</Text>
            <Text style={styles.rowValue}>{memberSince}</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>CityTransit v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#dbeafe',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#172554',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e40af',
  },
  roleText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  card: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 16,
  },
  signOutBtn: {
    width: '100%',
    backgroundColor: '#450a0a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    marginBottom: 24,
  },
  signOutText: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '700',
  },
  version: {
    color: '#334155',
    fontSize: 12,
  },
})
