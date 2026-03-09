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

type Step = 'email' | 'code'

export default function LoginScreen() {
  const { sendEmailCode, verifyEmailCode } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendCode = async () => {
    const cleaned = email.trim().toLowerCase()
    if (!cleaned || !cleaned.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }
    setLoading(true)
    const { error } = await sendEmailCode(cleaned)
    setLoading(false)
    if (error) {
      Alert.alert('Failed to Send Code', error)
    } else {
      setStep('code')
    }
  }

  const handleVerifyCode = async () => {
    if (!code || code.length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code.')
      return
    }
    setLoading(true)
    const { error } = await verifyEmailCode(email.trim().toLowerCase(), code.trim())
    setLoading(false)
    if (error) Alert.alert('Verification Failed', error)
  }

  const handleBack = () => {
    setStep('email')
    setCode('')
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
          <Text style={styles.subtitle}>Driver Portal</Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.cardTitle}>Welcome, Driver</Text>
              <Text style={styles.cardSubtitle}>
                Enter your email to receive a sign-in code
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

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Code →</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Check Your Email</Text>
              <Text style={styles.cardSubtitle}>
                Enter the 6-digit code sent to{'\n'}
                <Text style={styles.highlight}>{email.trim().toLowerCase()}</Text>
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                  placeholder="• • • • • •"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Login ✓</Text>
                )}
              </TouchableOpacity>

              <View style={styles.codeActions}>
                <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
                  <Text style={styles.linkText}>← Change Email</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendCode} disabled={loading} activeOpacity={0.7}>
                  <Text style={styles.linkText}>Resend Code</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <Text style={styles.hint}>Only registered drivers can access this app.</Text>
        </View>
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
  highlight: {
    color: '#3b82f6',
    fontWeight: '700',
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
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 12,
    fontWeight: '700',
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
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
