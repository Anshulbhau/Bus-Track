import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native'
import { useAuth } from '../../src/context/AuthContext'

export default function ProfileScreen() {
  const { profile, signOut } = useAuth()

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  const initial = profile?.name?.charAt(0).toUpperCase() ?? 'D'

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>🚌 Driver</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <InfoRow label="Full Name" value={profile?.name ?? '—'} icon="👤" />
          <View style={styles.divider} />
          <InfoRow label="Phone" value={profile?.phone ?? '—'} icon="📱" />
          <View style={styles.divider} />
          <InfoRow label="Role" value="Driver" icon="🎯" />
          <View style={styles.divider} />
          <InfoRow
            label="Member Since"
            value={
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'
            }
            icon="📅"
          />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>CityTransit Driver v1.0.0</Text>
      </View>
    </SafeAreaView>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  avatarContainer: { alignItems: 'center', marginTop: 32, marginBottom: 28 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  avatarText: { fontSize: 44, color: '#fff', fontWeight: '800' },
  roleBadge: {
    marginTop: 12,
    backgroundColor: '#172554',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  roleText: { color: '#93c5fd', fontWeight: '700', fontSize: 14 },
  infoCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  infoIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  infoText: { flex: 1 },
  infoLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#1e293b', marginHorizontal: 0 },
  signOutBtn: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  signOutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  version: { color: '#334155', fontSize: 12, marginTop: 24 },
})
