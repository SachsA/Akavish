import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#09090b' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#09090b' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* An `article/[slug]` screen used to be declared here without the route
            file existing, which makes Expo Router warn on every launch. Add the
            screen back together with app/article/[slug].tsx (mobile feature
            parity, PROGRESS.md §7). */}
      </Stack>
    </SafeAreaProvider>
  )
}
