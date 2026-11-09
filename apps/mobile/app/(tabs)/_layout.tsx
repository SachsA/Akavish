import Ionicons from '@expo/vector-icons/Ionicons'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import type { ColorValue } from 'react-native'
import { Wordmark } from '../../src/components/Wordmark'
import { colors } from '../../src/theme'

type IconName = ComponentProps<typeof Ionicons>['name']

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    // The tints set below are plain strings; Ionicons doesn't take the
    // platform colour objects React Navigation's type also allows.
    return (
      <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />
    )
  }
  return TabIcon
}

// Four tabs for the busiest sections, plus "Sections" for the rest (Previews,
// Conferences, Esport) and the site links. Tab titles come from the shared
// category list where they're sections, so they match the web's navigation.
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => <Wordmark />,
          tabBarIcon: icon('home'),
        }}
      />
      <Tabs.Screen name="news" options={{ title: 'News', tabBarIcon: icon('newspaper') }} />
      <Tabs.Screen name="leaks" options={{ title: 'Leaks', tabBarIcon: icon('flame') }} />
      <Tabs.Screen name="reviews" options={{ title: 'Reviews', tabBarIcon: icon('star') }} />
      <Tabs.Screen name="sections" options={{ title: 'Sections', tabBarIcon: icon('grid') }} />
    </Tabs>
  )
}
