import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native'
import { useAuth } from '../../src/context/AuthContext'

type PasswordMode = 'login' | 'signup'

export default function LoginScreen() {
  const { signInWithPassword, signUpWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('login')

  const handlePasswordAuth = async () => {
    const cleaned = email.trim().toLowerCase()
    if (!cleaned || !cleaned.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }
    if (!password || password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    if (passwordMode === 'login') {
      const { error } = await signInWithPassword(cleaned, password)
      setLoading(false)
      if (error) {
        Alert.alert('Login Failed', error)
      }
    } else {
      // Signup mode
      if (!confirmPassword || password !== confirmPassword) {
        Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.')
        setLoading(false)
        return
      }
      const { error } = await signUpWithPassword(cleaned, password)
      setLoading(false)
      if (error) {
        Alert.alert('Signup Failed', error)
      } else {
        Alert.alert('Signup Successful', 'Your account has been created. You can now log in.')
        setPasswordMode('login')
        setPassword('')
        setConfirmPassword('')
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🚌</Text>
          </View>
          <Text style={styles.title}>CityTransit</Text>
          <Text style={styles.subtitle}>Passenger Portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {passwordMode === 'login' ? 'Sign In' : 'Create Account'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {passwordMode === 'login'
              ? 'Enter your email and password to login'
              : 'Create a new account with your email and password'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>Minimum 6 characters</Text>
          </View>

          {passwordMode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handlePasswordAuth}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {passwordMode === 'login' ? 'Sign In ✓' : 'Create Account ✓'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setPasswordMode(passwordMode === 'login' ? 'signup' : 'login')
              setPassword('')
              setConfirmPassword('')
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              {passwordMode === 'login'
                ? "Don't have an account? Sign Up →"
                : 'Already have an account? Sign In →'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          ✓ Anyone can register to track buses and book trips
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
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
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 28,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  linkText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 20,
  },
})
