import * as SecureStore from 'expo-secure-store'
import type { TokenCache } from '@clerk/clerk-expo/dist/cache'

const createTokenCache = (): TokenCache => {
  return {
    getToken: (key: string) => {
      try {
        return SecureStore.getItemAsync(key)
      } catch (err) {
        return null
      }
    },
    saveToken: (key: string, value: string) => {
      try {
        return SecureStore.setItemAsync(key, value)
      } catch (err) {
        return Promise.resolve()
      }
    },
    clearToken: (key: string) => {
      try {
        return SecureStore.deleteItemAsync(key)
      } catch (err) {
        return Promise.resolve()
      }
    },
  }
}

// SecureStore is not supported on the web
export const tokenCache =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'
    ? undefined
    : createTokenCache()
