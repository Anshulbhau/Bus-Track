import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { useAuth } from '../../src/context/AuthContext'

export default function AuthCallback() {
  const router = useRouter()
  const { session, loading } = useAuth()

  useEffect(() => {
    // Get the deep link URL
    const url = Linking.useURL()

    if (!loading) {
      if (session) {
        // Authenticated, go to main app
        router.replace('/(tabs)/trips')
      } else {
        // Not authenticated, go back to login
        router.replace('/(auth)/login')
      }
    }
  }, [loading, session])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
      <ActivityIndicator color="#3b82f6" size="large" />
    </View>
  )
}
